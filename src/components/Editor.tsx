import { useEffect, useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import { Preview } from "./Preview";
import { PropertiesPanel } from "./PropertiesPanel";
import { parseMdxWithPositions, renderMdx } from "@/lib/wasm";
import type { AST } from "zig-mdx";
import { useNostr } from "./NostrContext";
import { UserProfile } from "./UserProfile";
import { nip19, validateEvent, type EventTemplate } from "nostr-tools";
import { slugify } from "@/lib/utils";
import yaml from "yaml";
import { usePages, useUserComponents } from "@/hooks/nostr";
import type { Event as NostrEvent } from "nostr-tools";
import { Login } from "./Login";
import { DEFAULT_RELAYS } from "@/lib/relays";
import { Link } from "wouter";

type DocType = "page" | "component";

const defaultPageValue = `---
title: My First Page
---

# My First Page

This is my first page.
`;

const defaultComponentValue = `---
name: MyComponent
---

{props.message}
`;

const defaultPageAst: AST = await parseMdxWithPositions(defaultPageValue);
const defaultComponentAst: AST = await parseMdxWithPositions(defaultComponentValue);

export function Editor() {
  const nostr = useNostr();
  const { pubkey: userPubkey, isReadonly, logout } = nostr;
  const [value, setValue] = useState(defaultPageValue);
  const [parsedAst, setParsedAst] = useState<AST>(defaultPageAst);
  const [parseError, setParseError] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>("page");

  const [showFileBrowser, setShowFileBrowser] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [cursorOffset, setCursorOffset] = useState(0);
  const pages = usePages(userPubkey ?? undefined);
  const components = useUserComponents(userPubkey ?? undefined);

  // TODO: debounce this
  useEffect(() => {
    async function parse() {
      try {
        setParseError(null);
        const ast = await parseMdxWithPositions(value);
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

      // Use title for pages, name for components
      const displayName = docType === "page"
        ? (meta?.title || 'Untitled')
        : (meta?.name || 'Unnamed');
      const d = slugify(displayName);
      const version = '1.3.0';
      const content = JSON.stringify(parsedAst);

      const typeTag = docType === "page" ? "hypernote-page" : "hypernote-component";
      const tags: string[][] = [
        ['d', d],
        [docType === "page" ? 'title' : 'name', displayName],
        ['status', 'published'],
        ['hypernote', version],
        ['t', 'hypernote'],
        ['t', typeTag],
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
      alert(`Published ${docType}: ${naddr}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Publish failed");
    }
    setIsPublishing(false);
  };

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleNewPage = () => {
    setDocType("page");
    setValue(defaultPageValue);
    setSelectedId(null);
  };

  const handleNewComponent = () => {
    setDocType("component");
    setValue(defaultComponentValue);
    setSelectedId(null);
  };

  const parseEvent = (event: NostrEvent) => {
    const getTagValue = (tagName: string) => {
      const tag = event.tags.find((t) => t[0] === tagName);
      return tag?.[1];
    };

    const titleTag = getTagValue('title');
    const nameTag = getTagValue('name');
    const statusTag = getTagValue('status');
    const ast = JSON.parse(event.content);

    let displayName = titleTag || nameTag;
    if (!displayName) {
      try {
        const fm = ast.children.find((child: any) => child.type === "frontmatter")?.value;
        const meta = yaml.parse(fm);
        displayName = meta?.title || meta?.name || 'Untitled';
      } catch {
        displayName = 'Untitled';
      }
    }

    return {
      id: event.id,
      displayName,
      source: ast.source,
      status: statusTag || 'published',
    };
  };

  const handleSelectItem = (event: NostrEvent, type: DocType) => {
    setSelectedId(event.id);
    setDocType(type);
    const parsed = parseEvent(event);
    setValue(parsed.source);
  };

  function FileList({ events, type, label }: { events: NostrEvent[]; type: DocType; label: string }) {
    const parsed = events.map(parseEvent);

    return (
      <div className="mb-4">
        <div className="text-xs uppercase text-neutral-400 mb-1 px-2">{label}</div>
        {parsed.length === 0 ? (
          <div className="text-neutral-500 text-sm px-2">None</div>
        ) : (
          <div className="flex flex-col gap-1">
            {parsed.map((item, i) => (
              <div
                key={item.id}
                className={`hover:bg-neutral-600 p-2 rounded-md cursor-pointer ${selectedId === item.id ? "bg-neutral-600" : ""}`}
                onClick={() => handleSelectItem(events[i]!, type)}
              >
                <div className="text-sm">{item.displayName}</div>
              </div>
            ))}
          </div>
        )}
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
          <span className="text-sm text-neutral-400">
            {docType === "page" ? "Page" : "Component"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isReadonly && <span className="text-yellow-500 text-sm">Read-only</span>}
          <button
            className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-md transition-colors"
            onClick={async () => {
              const formatted = await renderMdx(value);
              setValue(formatted);
            }}
          >
            Format
          </button>
          <button
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-md transition-colors"
            onClick={handlePublish}
            disabled={isPublishing || isReadonly}
          >
            {isPublishing ? "Publishing..." : `Publish ${docType}`}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {showFileBrowser && (
          <div className="w-[256px] p-2 flex flex-col">
            <div className="flex gap-2 mb-2">
              <button
                onClick={handleNewPage}
                className="flex-1 text-sm bg-neutral-700 hover:bg-neutral-600 px-2 py-1 rounded"
              >
                + Page
              </button>
              <button
                onClick={handleNewComponent}
                className="flex-1 text-sm bg-neutral-700 hover:bg-neutral-600 px-2 py-1 rounded"
              >
                + Component
              </button>
            </div>
            <div className="bg-neutral-700 p-2 rounded-md border border-neutral-600 flex-1 overflow-auto">
              <FileList events={pages ?? []} type="page" label="Pages" />
              <FileList events={components ?? []} type="component" label="Components" />
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
        <div className="flex-1 min-w-0">
          <MarkdownEditor
            value={value}
            onChange={(value) => setValue(value)}
            onCursorChange={setCursorOffset}
          />
        </div>
        <div className="flex-1 min-w-0 p-4 flex flex-col items-center gap-4 overflow-hidden">
          <Preview ast={parsedAst} parseError={parseError} />
        </div>
        {showProperties && (
          <div className="w-[256px] p-3 bg-neutral-800 border-l border-neutral-700 overflow-auto">
            <div className="text-xs uppercase text-neutral-400 mb-3">Properties</div>
            <PropertiesPanel
              ast={parsedAst}
              cursorOffset={cursorOffset}
              source={value}
              onSourceChange={setValue}
            />
          </div>
        )}
      </div>
    </div>
  );
}
