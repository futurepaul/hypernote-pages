import { usePages, useProfile } from "@/hooks/nostr";
import { Preview } from "./Preview";
import { nip19, validateEvent, type EventTemplate, type Event as NostrEvent } from "nostr-tools";
import { useNostr } from "./NostrContext";
import { DEFAULT_RELAYS } from "@/lib/relays";
import { useState } from "react";
import { slugify } from "@/lib/utils";
import yaml from "yaml";
import { Link } from "wouter";
import { PenSquare, GitFork, ExternalLink } from "lucide-react";
import { getDisplayName, getProfilePicture } from "applesauce-core/helpers";

function AuthorInfo({ pubkey }: { pubkey: string }) {
  const profile = useProfile(pubkey);
  return (
    <div className="flex items-center gap-2">
      <img
        className="rounded-full w-8 h-8 object-cover"
        src={getProfilePicture(profile, `https://robohash.org/${pubkey}.png`)}
        alt={getDisplayName(profile)}
      />
      <span className="text-xs text-neutral-300 truncate max-w-[80px]">
        {getDisplayName(profile)}
      </span>
    </div>
  );
}

function PageCard({
  page,
  naddr,
  onCopy,
  copying,
  canCopy,
}: {
  page: NostrEvent;
  naddr: string;
  onCopy: () => void;
  copying: boolean;
  canCopy: boolean;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4">
      <div className="flex flex-col gap-2 bg-neutral-800 rounded-lg p-2 border border-neutral-700">
        <AuthorInfo pubkey={page.pubkey} />
        <Link
          href={`/hn/${naddr}`}
          className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
        >
          <ExternalLink className="w-3 h-3" />
          View
        </Link>
        {canCopy && (
          <button
            onClick={onCopy}
            disabled={copying}
            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
          >
            <GitFork className="w-3 h-3" />
            {copying ? "..." : "Fork"}
          </button>
        )}
      </div>
      <div className="min-w-0 overflow-hidden">
        <Preview ast={JSON.parse(page.content)} />
      </div>
    </div>
  );
}

export function Home() {
  const nostr = useNostr();
  const { pubkey, isReadonly, needsUnlock } = nostr;
  const allPages = usePages();
  const [copying, setCopying] = useState<string | null>(null);

  const getTagValue = (event: NostrEvent, tagName: string) => {
    const tag = event.tags.find((t) => t[0] === tagName);
    return tag?.[1];
  };

  // Filter to only show published pages (or pages without status tag for backwards compatibility)
  const pages = allPages?.filter(page => {
    const status = getTagValue(page, 'status');
    return !status || status === 'published';
  });

  const handleCopyToDrafts = async (page: NostrEvent) => {
    if (!pubkey || isReadonly) {
      alert("Login with a signer to copy pages");
      return;
    }
    if (!nostr.factory || needsUnlock) {
      alert("Please unlock your signer first (click the lock icon)");
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

      const signed = await nostr.factory.sign(eventTemplate);
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

  return (
    <div className="min-h-screen bg-neutral-900">
      {pubkey && (
        <Link
          href="/editor"
          className="fixed top-4 right-4 z-50 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-full p-3 transition-colors"
          title="Editor"
        >
          <PenSquare className="w-5 h-5 text-neutral-300" />
        </Link>
      )}

      <div className="p-4 pt-16">
        {(!pages || pages.length === 0) && (
          <div className="text-neutral-500 text-center py-8">No pages found</div>
        )}
        <div className="grid gap-4 max-w-3xl mx-auto">
          {pages?.map((page) => {
            const dTag = getTagValue(page, 'd') || page.id;
            const naddr = nip19.naddrEncode({
              pubkey: page.pubkey,
              kind: 32616,
              identifier: dTag,
              relays: DEFAULT_RELAYS,
            });

            return (
              <PageCard
                key={page.id}
                page={page}
                naddr={naddr}
                onCopy={() => handleCopyToDrafts(page)}
                copying={copying === page.id}
                canCopy={!!pubkey && !isReadonly}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}