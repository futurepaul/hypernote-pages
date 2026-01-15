import { useEffect, useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import { Preview } from "./Preview";
import { PropertiesPanel } from "./PropertiesPanel";
import { MediaInfo } from "./MediaInfo";
import { parseMdxWithPositions, renderMdx } from "@/lib/wasm";
import type { AST } from "zig-mdx";
import { useNostr } from "./NostrContext";
import { nip19, validateEvent, type EventTemplate } from "nostr-tools";
import { slugify } from "@/lib/utils";
import yaml from "yaml";
import { usePages, useUserComponents, useBlossomServers, useHypernoteMedia } from "@/hooks/nostr";
import { uploadBlob, type BlobDescriptor } from "@/hooks/blossom";
import type { Event as NostrEvent } from "nostr-tools";
import { DEFAULT_RELAYS } from "@/lib/relays";
import { Link } from "wouter";
import { BookOpenText, Wand2, Upload, FilePlus, ImageUp, FileText, Puzzle, Image, Globe, FileEdit, EyeOff } from "lucide-react";

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
  const { pubkey: userPubkey, isReadonly, signer, needsUnlock } = nostr;
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
  const blossomServers = useBlossomServers(userPubkey ?? undefined);
  const mediaEvents = useHypernoteMedia(userPubkey ?? undefined);
  const [selectedMedia, setSelectedMedia] = useState<BlobDescriptor | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<NostrEvent | null>(null);
  const [isUnpublishing, setIsUnpublishing] = useState(false);

  // Parse media events into BlobDescriptor-like objects
  const parseMediaEvent = (event: NostrEvent): BlobDescriptor | null => {
    const getTagValue = (name: string) => event.tags.find((t) => t[0] === name)?.[1];
    const sha256 = getTagValue("d");
    const url = getTagValue("url");
    const type = getTagValue("m");
    const size = getTagValue("size");
    if (!sha256 || !url) return null;
    return {
      sha256,
      url,
      type,
      size: size ? parseInt(size, 10) : 0,
      uploaded: event.created_at,
    };
  };

  const media = mediaEvents?.map(parseMediaEvent).filter((m): m is BlobDescriptor => m !== null) ?? [];

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

  // Show message if not authenticated
  if (!userPubkey) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-neutral-400 text-center">
          <p className="mb-2">Login to use the editor</p>
          <p className="text-sm text-neutral-500">Click the login button in the bottom left</p>
        </div>
      </div>
    );
  }

  const handlePublish = async () => {
    if (isReadonly) {
      alert("Login with a signer to publish");
      return;
    }
    if (!signer || needsUnlock) {
      alert("Please unlock your signer first (click the lock icon)");
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
      const res = await signer!.signEvent(eventTemplate);

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

  const handleNewPage = () => {
    setDocType("page");
    setValue(defaultPageValue);
    setSelectedId(null);
    setSelectedEvent(null);
    setSelectedMedia(null);
  };

  const handleNewComponent = () => {
    setDocType("component");
    setValue(defaultComponentValue);
    setSelectedId(null);
    setSelectedEvent(null);
    setSelectedMedia(null);
  };

  const handleUnpublish = async () => {
    if (!selectedEvent) return;
    if (isReadonly) {
      alert("Login with a signer to unpublish");
      return;
    }
    if (!signer || needsUnlock) {
      alert("Please unlock your signer first (click the lock icon)");
      return;
    }

    setIsUnpublishing(true);
    try {
      // Get existing tags and update status to draft
      const newTags = selectedEvent.tags.map(tag => {
        if (tag[0] === 'status') {
          return ['status', 'draft'];
        }
        return tag;
      });

      // If no status tag existed, add one
      if (!newTags.some(tag => tag[0] === 'status')) {
        newTags.push(['status', 'draft']);
      }

      const eventTemplate: EventTemplate = {
        kind: 32616,
        content: selectedEvent.content,
        tags: newTags,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signed = await signer!.signEvent(eventTemplate);
      if (!validateEvent(signed)) {
        throw new Error("Failed to verify event");
      }

      await nostr.pool.publish(DEFAULT_RELAYS, signed);
      alert("Page unpublished (moved to draft)");

      // Update the selected event to reflect new status
      setSelectedEvent({ ...selectedEvent, tags: newTags });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unpublish failed");
    }
    setIsUnpublishing(false);
  };

  const handleUploadMedia = async () => {
    if (isReadonly) {
      alert("Login with a signer to upload");
      return;
    }
    if (!signer || needsUnlock) {
      alert("Please unlock your signer first (click the lock icon)");
      return;
    }
    if (!blossomServers?.length) {
      window.open("https://hzrd149.github.io/applesauce/examples/#blossom/server-manager", "_blank");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
        // Upload to blossom server
        const blob = await uploadBlob(
          blossomServers[0]!.toString(),
          file,
          (draft) => signer!.signEvent(draft)
        );

        // Publish hypernote-media event
        const version = "1.3.0";
        const mediaEvent: EventTemplate = {
          kind: 32616,
          content: "",
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ["d", blob.sha256],
            ["url", blob.url],
            ["m", blob.type || "application/octet-stream"],
            ["size", blob.size.toString()],
            ["t", "hypernote"],
            ["t", "hypernote-media"],
            ["t", `hypernote-v${version}`],
          ],
        };
        const signedEvent = await signer!.signEvent(mediaEvent);
        await nostr.pool.publish(DEFAULT_RELAYS, signedEvent);

        setSelectedMedia(blob);
        setSelectedId(null);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Upload failed");
      }
      setIsUploading(false);
    };
    input.click();
  };

  const handleSelectMedia = (blob: BlobDescriptor) => {
    setSelectedMedia(blob);
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
    setSelectedEvent(event);
    setDocType(type);
    setSelectedMedia(null);
    const parsed = parseEvent(event);
    setValue(parsed.source);
  };

  function FileList({
    events,
    type,
    label,
    icon: Icon,
    onNew,
    newLabel,
    newIcon: NewIcon,
  }: {
    events: NostrEvent[];
    type: DocType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onNew: () => void;
    newLabel: string;
    newIcon: React.ComponentType<{ className?: string }>;
  }) {
    const parsed = events.map(parseEvent);

    return (
      <div className="mb-4">
        <div className="flex items-center gap-1 text-xs uppercase text-neutral-400 mb-1 px-2">
          <Icon className="w-3 h-3" />
          {label}
        </div>
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
                <div className="flex items-center gap-1.5">
                  {item.status === "published" ? (
                    <Globe className="w-3 h-3 text-green-400 flex-shrink-0" title="Published" />
                  ) : (
                    <FileEdit className="w-3 h-3 text-yellow-400 flex-shrink-0" title="Draft" />
                  )}
                  <span className="text-sm truncate">{item.displayName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={onNew}
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 mt-2 px-2 py-1 border border-neutral-600 rounded hover:border-neutral-500"
        >
          <NewIcon className="w-3 h-3" />
          {newLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="bg-neutral-900 text-neutral-200 px-3 py-2 flex justify-between items-center border-b border-neutral-800">
        <Link
          href="/"
          className="p-2 rounded-md hover:bg-neutral-800 transition-colors"
          title="Home"
        >
          <BookOpenText className="w-5 h-5 text-neutral-400" />
        </Link>
        <div className="flex items-center gap-1">
          <button
            className="p-2 rounded-md hover:bg-neutral-800 transition-colors"
            onClick={async () => {
              const formatted = await renderMdx(value);
              setValue(formatted);
            }}
            title="Format"
          >
            <Wand2 className="w-5 h-5 text-neutral-400" />
          </button>
          {selectedEvent && selectedEvent.tags.find(t => t[0] === 'status')?.[1] === 'published' && (
            <button
              className="p-2 rounded-md hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              onClick={handleUnpublish}
              disabled={isUnpublishing || isReadonly}
              title="Unpublish (move to draft)"
            >
              <EyeOff className={`w-5 h-5 ${isUnpublishing ? "text-yellow-400 animate-pulse" : "text-yellow-400"}`} />
            </button>
          )}
          <button
            className="p-2 rounded-md hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            onClick={handlePublish}
            disabled={isPublishing || isReadonly}
            title={isReadonly ? "Read-only mode" : `Publish ${docType}`}
          >
            <Upload className={`w-5 h-5 ${isPublishing ? "text-purple-400 animate-pulse" : "text-purple-400"}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {showFileBrowser && (
          <div className="w-[256px] p-2 flex flex-col">
            <div className="bg-neutral-700 p-2 rounded-md border border-neutral-600 flex-1 overflow-auto">
              <FileList
                events={pages ?? []}
                type="page"
                label="Pages"
                icon={FileText}
                onNew={handleNewPage}
                newLabel="New page"
                newIcon={FilePlus}
              />
              <FileList
                events={components ?? []}
                type="component"
                label="Components"
                icon={Puzzle}
                onNew={handleNewComponent}
                newLabel="New component"
                newIcon={FilePlus}
              />
              <div className="mb-4">
                <div className="flex items-center gap-1 text-xs uppercase text-neutral-400 mb-1 px-2">
                  <Image className="w-3 h-3" />
                  Media
                </div>
                {!blossomServers?.length ? (
                  <div className="text-neutral-500 text-sm px-2">
                    <a
                      href="https://hzrd149.github.io/applesauce/examples/#blossom/server-manager"
                      target="_blank"
                      rel="noopener"
                      className="text-purple-400 hover:text-purple-300"
                    >
                      Set up blossom server
                    </a>
                  </div>
                ) : media.length === 0 ? (
                  <div className="text-neutral-500 text-sm px-2">None</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {media.map((blob) => (
                      <div
                        key={blob.sha256}
                        className={`hover:bg-neutral-600 p-2 rounded-md cursor-pointer ${selectedMedia?.sha256 === blob.sha256 ? "bg-neutral-600" : ""}`}
                        onClick={() => handleSelectMedia(blob)}
                      >
                        <div className="text-sm truncate">{blob.url.split("/").pop()}</div>
                        <div className="text-xs text-neutral-400">{blob.type || "unknown"}</div>
                      </div>
                    ))}
                  </div>
                )}
                {blossomServers?.length ? (
                  <button
                    onClick={handleUploadMedia}
                    disabled={isUploading}
                    className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 disabled:opacity-50 mt-2 px-2 py-1 border border-neutral-600 rounded hover:border-neutral-500"
                  >
                    <ImageUp className="w-3 h-3" />
                    {isUploading ? "Uploading..." : "Upload media"}
                  </button>
                ) : null}
              </div>
              {/* Spacer so we can always see the bottom contents */}
              <div className="h-40"></div>
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
            {selectedMedia ? (
              <MediaInfo blob={selectedMedia} />
            ) : (
              <>
                <div className="text-xs uppercase text-neutral-400 mb-3">Properties</div>
                <PropertiesPanel
                  ast={parsedAst}
                  cursorOffset={cursorOffset}
                  source={value}
                  onSourceChange={setValue}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
