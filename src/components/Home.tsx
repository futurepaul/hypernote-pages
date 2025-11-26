import { usePages } from "@/hooks/nostr";
import { Preview } from "./Preview";
import { nip19, validateEvent, type EventTemplate, type Event as NostrEvent } from "nostr-tools";
import { useNostr } from "./NostrContext";
import { Login } from "./Login";
import { UserProfile } from "./UserProfile";
import { DEFAULT_RELAYS } from "@/lib/relays";
import { useState } from "react";
import { slugify } from "@/lib/utils";
import yaml from "yaml";
import { Link } from "wouter";

export function Home() {
  const nostr = useNostr();
  const { pubkey, isReadonly, logout } = nostr;
  const pages = usePages();
  const [copying, setCopying] = useState<string | null>(null);

  const getTagValue = (event: NostrEvent, tagName: string) => {
    const tag = event.tags.find((t) => t[0] === tagName);
    return tag?.[1];
  };

  const handleCopyToDrafts = async (page: NostrEvent) => {
    if (!pubkey || isReadonly) {
      alert("Login with extension to copy pages");
      return;
    }

    setCopying(page.id);
    try {
      const ast = JSON.parse(page.content);
      let title: string = getTagValue(page, 'title') || 'Untitled';
      if (title === 'Untitled') {
        try {
          const fm = ast.children.find((child: any) => child.type === "frontmatter")?.value;
          title = yaml.parse(fm)?.title || 'Untitled';
        } catch {
          // keep 'Untitled'
        }
      }

      const newIdentifier = `${slugify(title)}-${Date.now()}`;
      const tags: string[][] = [
        ['d', newIdentifier],
        ['title', `${title} (copy)`],
        ['status', 'draft'],
        ['forked-from', page.id],
        ['hypernote', '1.3.0'],
        ['t', 'hypernote'],
        ['t', 'hypernote-page'],
        ['t', 'hypernote-v1.3.0'],
      ];

      const eventTemplate: EventTemplate = {
        kind: 32616,
        content: page.content,
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signed = await nostr.signer.signEvent(eventTemplate);
      if (!validateEvent(signed)) {
        throw new Error("Invalid event");
      }

      await nostr.pool.publish(DEFAULT_RELAYS, signed);
      alert("Copied to your drafts!");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Copy failed");
    }
    setCopying(null);
  };

  if (!pubkey) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      <div className="p-4 border-b border-neutral-700 flex justify-between items-center">
        <h1 className="text-xl font-bold text-neutral-100">Hypernote Pages</h1>
        <div className="flex items-center gap-4">
          <Link href="/editor" className="text-purple-400 hover:text-purple-300">
            Editor
          </Link>
          <UserProfile pubkey={pubkey} />
          <button onClick={logout} className="text-neutral-400 hover:text-neutral-200 text-sm">
            Logout
          </button>
        </div>
      </div>

      <div className="p-4">
        {(!pages || pages.length === 0) && (
          <div className="text-neutral-500 text-center py-8">No pages found</div>
        )}
        <div className="grid gap-4 max-w-2xl mx-auto">
          {pages?.map((page) => {
            const dTag = getTagValue(page, 'd') || page.id;
            const naddr = nip19.naddrEncode({
              pubkey: page.pubkey,
              kind: 32616,
              identifier: dTag,
              relays: DEFAULT_RELAYS,
            });
            const isOwn = page.pubkey === pubkey;

            return (
              <div key={page.id} className="relative">
                <Preview
                  ast={JSON.parse(page.content)}
                  naddr={naddr}
                />
                  <button
                    onClick={() => handleCopyToDrafts(page)}
                    disabled={copying === page.id || isReadonly}
                    className="absolute top-2 right-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs px-3 py-1 rounded transition-colors"
                  >
                    {copying === page.id ? "Copying..." : "Copy to Drafts"}
                  </button>
                {isOwn && (
                  <span className="absolute top-2 right-2 bg-green-600 text-white text-xs px-3 py-1 rounded">
                    Your page
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}