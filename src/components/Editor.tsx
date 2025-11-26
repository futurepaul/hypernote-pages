import { useEffect, useState } from "react";
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
import { Login } from "./Login";
import { DEFAULT_RELAYS } from "@/lib/relays";
import { Link } from "wouter";

const defaultValue = `---
title: My First Page
---

# My First Page

This is my first page.
`;

const defaultAst: AST = await parseMdx(defaultValue);

export function Editor() {
  const nostr = useNostr();
  const { pubkey: userPubkey, isReadonly, logout } = nostr;
  const [value, setValue] = useState(defaultValue);
  const [parsedAst, setParsedAst] = useState<AST>(defaultAst);
  const [parseError, setParseError] = useState<string | null>(null);

  const [showFileBrowser, setShowFileBrowser] = useState(true);
  const [showProperties, setShowProperties] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const pages = usePages(userPubkey ?? undefined);

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

  // Show login if not authenticated
  if (!userPubkey) {
    return <Login />;
  }

  const handlePublish = async () => {
    if (isReadonly) {
      alert("Login with extension to publish");
      return;
    }
    setIsPublishing(true);

    try {
      const frontmatter = parsedAst.children.find((child) => child.type === "frontmatter")?.value;
      if (!frontmatter) {
        throw new Error("Frontmatter not found");
      }
      const meta = yaml.parse(frontmatter);

      const title = meta?.title || 'Untitled';
      const d = slugify(title);
      const version = '1.3.0';
      const content = JSON.stringify(parsedAst);
      const tags: string[][] = [
        ['d', d],
        ['title', title],
        ['status', 'published'],
        ['hypernote', version],
        ['t', 'hypernote'],
        ['t', 'hypernote-page'],
        ['t', 'hypernote-v1.3.0'],
      ];

      const eventTemplate: EventTemplate = {
        kind: 32616,
        content,
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };
      const res = await nostr.signer.signEvent(eventTemplate);

      const verified = validateEvent(res);
      if (!verified) {
        throw new Error("Failed to verify event");
      }

      const published = await nostr.pool.publish(DEFAULT_RELAYS, res);
      if (published.length === 0) {
        throw new Error("Failed to publish event");
      }

      const naddr = nip19.naddrEncode({ pubkey: userPubkey, kind: 32616, identifier: d, relays: DEFAULT_RELAYS });
      alert(`Published: ${naddr}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Publish failed");
    }
    setIsPublishing(false);
  };

  function FileBrowser({ pages }: { pages: NostrEvent[] }) {
    const getTagValue = (event: NostrEvent, tagName: string) => {
      const tag = event.tags.find((t) => t[0] === tagName);
      return tag?.[1];
    };

    const parsed = pages.map((page) => {
      const titleTag = getTagValue(page, 'title');
      const statusTag = getTagValue(page, 'status');
      const ast = JSON.parse(page.content);

      let title = titleTag;
      if (!title) {
        try {
          const fm = ast.children.find((child: any) => child.type === "frontmatter")?.value;
          title = yaml.parse(fm)?.title || 'Untitled';
        } catch {
          title = 'Untitled';
        }
      }

      return {
        id: page.id,
        title,
        source: ast.source,
        status: statusTag || 'published',
      };
    });

    const [selectedPage, setSelectedPage] = useState<string | null>(null);

    const handleSelectPage = (id: string) => {
      setSelectedPage(id);
      setValue(parsed.find((page) => page.id === id)?.source ?? "");
    };

    if (parsed.length === 0) {
      return <div className="text-neutral-500 text-sm p-2">No pages yet</div>;
    }

    return (
      <div className="flex flex-col gap-1">
        {parsed.map((page) => (
          <div
            key={page.id}
            className={`hover:bg-neutral-600 p-2 rounded-md cursor-pointer ${selectedPage === page.id ? "bg-neutral-600" : ""}`}
            onClick={() => handleSelectPage(page.id)}
          >
            <div className="text-sm">{page.title}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded ${page.status === "published" ? "bg-green-600" : "bg-yellow-600"}`}>
                {page.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="bg-neutral-900 text-neutral-200 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-purple-400 hover:text-purple-300">
            &larr; Home
          </Link>
          <h1 className="text-xl font-bold">Editor</h1>
        </div>
        <div className="flex items-center gap-3">
          {isReadonly && <span className="text-yellow-500 text-sm">Read-only</span>}
          <button
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-md transition-colors"
            onClick={handlePublish}
            disabled={isPublishing || isReadonly}
          >
            {isPublishing ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {showFileBrowser && (
          <div className="w-[256px] p-2 flex flex-col">
            <div className="bg-neutral-700 p-2 rounded-md border border-neutral-600 flex-1 overflow-auto">
              <FileBrowser pages={pages ?? []} />
            </div>
            <div className="mt-2 p-2 bg-neutral-800 rounded-md border border-neutral-700">
              <UserProfile pubkey={userPubkey} />
              <button
                onClick={logout}
                className="w-full mt-2 text-sm text-neutral-400 hover:text-neutral-200 py-1"
              >
                Logout
              </button>
            </div>
          </div>
        )}
        <div className="flex-1">
          <MarkdownEditor value={value} onChange={(value) => setValue(value)} />
        </div>
        <div className="flex-1 p-4 flex flex-col items-center gap-4">
          <Preview ast={parsedAst} parseError={parseError} />
        </div>
        {showProperties && (
          <div className="w-[256px] bg-blue-500">Properties Go Here</div>
        )}
      </div>
    </div>
  );
}
