import { useNostr } from "@/components/NostrContext";
import { useObservableState } from "observable-hooks";
import { useMemo } from "react";
import type { Filter as NostrFilter } from "nostr-tools";
import { of, map } from "rxjs";
import { parsePubkey, parseEventId, parseAddress } from "@/lib/nip19";

export type NostrQuery =
  | { type: "profile"; pubkey: string }  // accepts npub, nprofile, or hex
  | { type: "event"; id: string }        // accepts nevent, note, or hex
  | { type: "address"; kind: number; pubkey: string; identifier?: string }
  | { type: "timeline"; filter: NostrFilter; limit?: number };

/**
 * ONE HOOK TO RULE THEM ALL
 * Define what you want in frontmatter/props, get the data
 *
 * Works "at the edges" - call this in React components (Preview, custom components)
 * Returns observable data that updates reactively
 *
 * @example
 * // In frontmatter:
 * // profile: "hex_pubkey"
 * const query = { type: "profile", pubkey: frontmatter.profile };
 * const profile = useNostrQuery(query);
 *
 * @example
 * // Timeline query:
 * const query = { type: "timeline", filter: { kinds: [1], limit: 50 } };
 * const events = useNostrQuery(query);
 */
export function useNostrQuery(query: NostrQuery | undefined) {
  const { eventStore, pool, addressLoader, eventLoader } = useNostr();

  // Create observable based on query type
  const observable = useMemo(() => {
    if (!query) return undefined;

    switch (query.type) {
      case "profile": {
        // Parse pubkey from npub, nprofile, or hex
        let pubkey: string;
        try {
          const parsed = parsePubkey(query.pubkey);
          pubkey = parsed.pubkey;
        } catch (e) {
          console.warn("⚠️ useNostrQuery - Invalid pubkey:", e);
          return undefined;
        }

        // Use addressLoader for kind:0 (profiles)
        // Parse the JSON content and merge it into the event object
        return addressLoader({
          kind: 0,
          pubkey,
        }).pipe(
          map((event) => {
            if (!event) return event;

            try {
              const parsedContent = JSON.parse(event.content);
              // Merge parsed content into the event object for easy access
              return { ...event, ...parsedContent };
            } catch (e) {
              console.warn("⚠️ Failed to parse profile content:", e);
              return event;
            }
          })
        );
      }

      case "event": {
        // Parse event id from nevent, note, or hex
        let parsed;
        try {
          parsed = parseEventId(query.id);
        } catch (e) {
          console.warn("⚠️ useNostrQuery - Invalid event ID:", e);
          return undefined;
        }

        // Use eventLoader to fetch event by ID (with relay hints if nevent)
        return eventLoader({
          id: parsed.id,
          relays: parsed.relays,
        });
      }

      case "address": {
        // Validate address components
        if (!query.kind || !query.pubkey || query.pubkey.length !== 64) {
          console.warn("⚠️ useNostrQuery - Invalid address query:", query);
          return undefined;
        }

        // Use addressLoader for parameterized replaceable events
        return addressLoader({
          kind: query.kind,
          pubkey: query.pubkey,
          identifier: query.identifier,
        });
      }

      case "timeline": {
        // Validate filter
        if (!query.filter) {
          console.warn("⚠️ useNostrQuery - No filter provided for timeline query");
          return undefined;
        }

        // Use eventStore timeline with filter
        return eventStore.timeline(query.filter);
      }

      default:
        console.warn("⚠️ useNostrQuery - Unknown query type:", (query as any).type);
        return undefined;
    }
  }, [query, eventStore, pool, addressLoader, eventLoader]);

  // Convert RxJS observable to React state using observable-hooks
  // This will re-render the component when the observable emits new values
  // IMPORTANT: useObservableState requires a non-undefined observable
  // If observable is undefined, provide a default empty observable
  const result = useObservableState(observable ?? of(undefined));

  return result;
}
