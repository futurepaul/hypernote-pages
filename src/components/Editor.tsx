import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import { Preview } from "./Preview";
import { parseMdx } from "@/lib/wasm";
import type { AST } from "zig-mdx";
import { useNostr } from "./NostrContext";
import { UserProfile } from "./UserProfile";
import { nip19, validateEvent, type EventTemplate } from "nostr-tools";
import { slugify } from "@/lib/utils";
import yaml from "yaml";
import { usePages } from "@/hooks/nostr";
import type { Event as NostrEvent } from "nostr-tools";

const defaultValue = `---
title: My First Page
---

# My First Page

This is my first page.
`;

const defaultAst: AST = await parseMdx(defaultValue);

export function Editor() {
  const nostr = useNostr();
  const [value, setValue] = useState(defaultValue);
  const [parsedAst, setParsedAst] = useState<AST>(defaultAst);
  const [userPubkey, setUserPubkey] = useState<string | null>(null);
  const [hasExtension, setHasExtension] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [showFileBrowser, setShowFileBrowser] = useState(true);
  const [showProperties, setShowProperties] = useState(false);
  const pages = usePages();

  // TODO: debounce this
  useEffect(() => {
    async function parse() {
      try {
        setParseError(null);
        const ast = await parseMdx(value);
        setParsedAst(ast);
      } catch (error) {
        console.error(error);
        setParseError(error instanceof Error ? error.message : 'Unknown error');
      }
    }
    parse();
  }, [value]);

  useEffect(() => {
    if (typeof window !== "undefined" && "nostr" in window) {
      setHasExtension(true);
      return;
    }

    // Poll for extension with exponential backoff
    const intervals = [100, 200, 400, 800, 1600];
    let timeoutIds: ReturnType<typeof setTimeout>[] = [];

    let totalDelay = 0;
    for (const interval of intervals) {
      totalDelay += interval;
      const timeoutId = setTimeout(() => {
        if (typeof window !== "undefined" && "nostr" in window) {
          setHasExtension(true);
          // Clear remaining timeouts
          timeoutIds.forEach((id) => clearTimeout(id));
          timeoutIds = [];
        }
      }, totalDelay);
      timeoutIds.push(timeoutId);
    }

    // clear timeouts
    return () => {
      timeoutIds.forEach((id) => clearTimeout(id));
      timeoutIds = [];
    };
  }, []);

  useEffect(() => {
    async function getUserPubkey() {
      if (hasExtension && nostr) {
        const pubkey = await nostr.signer.getPublicKey();
        setUserPubkey(pubkey);
      }
    }
    getUserPubkey();
  }, [hasExtension, nostr.signer]);

  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    setIsPublishing(true);

    if (!userPubkey) {
      throw new Error("User pubkey not found");
    }

    const frontmatter = parsedAst.children.find((child) => child.type === "frontmatter")?.value;
    if (!frontmatter) {
      throw new Error("Frontmatter not found");
    }
    const meta = yaml.parse(frontmatter);

    const title = meta?.title || 'Untitled';
    const d = slugify(title)
    const version = '1.3.0'
    const content = JSON.stringify(parsedAst)
    const tags: string[][] = [
      ['d', d],
      ['hypernote', version],
      ['t', 'hypernote'],
      ['t', `hypernote-page`],
      ['t', `hypernote-v1.3.0`],
    ]

    const eventTemplate: EventTemplate = {
      kind: 32616,
      content,
      tags,
      created_at: Math.floor(Date.now() / 1000),
    }
    const res = await nostr.signer.signEvent(eventTemplate)

    const verified = validateEvent(res);
    if (!verified) {
      throw new Error("Failed to verify event");
    } else {
      console.log("Event verified");
    }

    const relays = ["wss://nos.lol"]

    const published = await nostr.pool.publish(relays, res);
    console.log(published);
    if (published.length === 0) {
      throw new Error("Failed to publish event");
    }

    const naddr = nip19.naddrEncode({ pubkey: userPubkey, kind: 32616, identifier: res.id, relays: ["wss://nos.lol"] })
    console.log(naddr);

    alert(`Published to ${naddr}`);
    setIsPublishing(false);
  };

  function FileBrowser({ pages }: { pages: NostrEvent[] }) {
    // TODO: move the title to a tag so we don't need to parse to get it
    // TODO: add a "status" tag
    const parsed = pages.map((page) => {
      const ast = JSON.parse(page.content);
      try {
        const title = ast.children.find((child: any) => child.type === "frontmatter")?.value;
        return {
          id: page.id,
          title: yaml.parse(title).title,
          source: ast.source,
          status: "published"
        }
      } catch (error) {
        console.error(error);
        return {
          id: page.id,
          title: "Untitled",
          source: ast.source,
          status: "draft"
        }
      }
    })
    console.log(parsed);

    const [selectedPage, setSelectedPage] = useState<string | null>(null);

    const handleSelectPage = (id: string) => {
      setSelectedPage(id);
      setValue(parsed.find((page) => page.id === id)?.source ?? "");
    }


    return (
      <div className="flex flex-col">
        {parsed.map((page) => (
          <div className={`hover:bg-neutral-600 p-2 rounded-md cursor-pointer ${selectedPage === page.id ? "bg-neutral-600" : ""}`} onClick={() => handleSelectPage(page.id)}>
            <div>


          <div className="text-sm " key={page.id}>{page.title}</div>
          <div className="text-xs text-neutral-500 truncate max-w-[128px]">{page.id}</div>
          </div>
          {/* Status tag */}
          <div>
            <span className={`text-xs px-2 py-1 rounded-md ${page.status === "published" ? "bg-green-500" : "bg-red-500"}`}>{page.status}</span>
          </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="bg-neutral-900 text-neutral-200 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Hypernote Pages</h1>
        {/* <UserName pubkey="82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2" /> */}
        {!hasExtension && <span>No extension found</span>}
        {hasExtension && userPubkey && <UserProfile pubkey={userPubkey} />}
        <button className="bg-neutral-800 text-neutral-200 p-2 rounded-md" onClick={handlePublish}>
          Publish
        </button>
      </div>

      <div className={"flex-1 flex overflow-hidden"}>
        {showFileBrowser && (
          <div className="w-[256px] p-2">
            <div className="bg-neutral-700 p-2 rounded-md border border-neutral-600">
             <FileBrowser pages={pages ?? []} />
              </div>

          </div>
        )
        
        }
        <div className="flex-1">
          <MarkdownEditor value={value} onChange={(value) => setValue(value)} />
        </div>
        <div className="flex-1 p-4 flex flex-col items-center gap-4">
          {/* <Button onClick={() => {}}>Publish</Button> */}
          {/* a phone-like preview with a fixed aspect ratio of 9:16 */}
          <Preview ast={parsedAst} parseError={parseError} />
        </div>
        {showProperties && (
          <div className="w-[256px] bg-blue-500">Properties Go Here</div>
        )}
      </div>
    </div>
  );
}
