import { usePage } from "@/hooks/nostr";
import { Preview } from "./Preview";
import { nip19, type Event as NostrEvent } from "nostr-tools";
import { Link } from "wouter";
import { DEFAULT_RELAYS } from "@/lib/relays";

export function Viewer({ id }: { id: string }) {
  const page = usePage(id);

  const getTagValue = (event: NostrEvent, tagName: string) => {
    const tag = event.tags.find((t) => t[0] === tagName);
    return tag?.[1];
  };

  return (
    <div className="min-h-screen bg-neutral-900">
      <div className="p-4 border-b border-neutral-700 flex justify-between items-center">
        <Link href="/" className="text-purple-400 hover:text-purple-300">
          &larr; Back
        </Link>
        <Link href="/editor" className="text-purple-400 hover:text-purple-300">
          Editor
        </Link>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {!page ? (
          <div className="text-neutral-500 text-center py-8">Loading...</div>
        ) : (
          <Preview
            ast={JSON.parse(page.content)}
            naddr={nip19.naddrEncode({
              pubkey: page.pubkey,
              kind: 32616,
              identifier: getTagValue(page, 'd') || page.id,
              relays: DEFAULT_RELAYS,
            })}
          />
        )}
      </div>
    </div>
  );
}