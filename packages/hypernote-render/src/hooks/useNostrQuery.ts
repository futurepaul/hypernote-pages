import { useNostr } from "../components/NostrContext";
import { useObservableState } from "observable-hooks";
import { useMemo } from "react";
import type { Filter as NostrFilter } from "nostr-tools";
import { of, map, startWith } from "rxjs";
import { onlyEvents } from "applesauce-relay";
import { mapEventsToStore, mapEventsToTimeline } from "applesauce-core/observable";
import { parsePubkey, parseEventId } from "../lib/nip19";
import { DEFAULT_RELAYS } from "../lib/relays";

export type NostrQuery =
  | { type: "profile"; pubkey: string }
  | { type: "event"; id: string }
  | { type: "address"; kind: number; pubkey: string; identifier?: string }
  | { type: "timeline"; filter: NostrFilter; limit?: number };

export function useNostrQuery(query: NostrQuery | undefined) {
  const { eventStore, pool, addressLoader, eventLoader } = useNostr();

  const observable = useMemo(() => {
    if (!query) return undefined;

    switch (query.type) {
      case "profile": {
        let pubkey: string;
        try {
          const parsed = parsePubkey(query.pubkey);
          pubkey = parsed.pubkey;
        } catch (e) {
          console.warn("useNostrQuery - Invalid pubkey:", e);
          return undefined;
        }

        return addressLoader({
          kind: 0,
          pubkey,
        }).pipe(
          map((event) => {
            if (!event) return event;
            try {
              const parsedContent = JSON.parse(event.content);
              return { ...event, ...parsedContent };
            } catch (e) {
              console.warn("Failed to parse profile content:", e);
              return event;
            }
          })
        );
      }

      case "event": {
        let parsed;
        try {
          parsed = parseEventId(query.id);
        } catch (e) {
          console.warn("useNostrQuery - Invalid event ID:", e);
          return undefined;
        }

        return eventLoader({
          id: parsed.id,
          relays: parsed.relays,
        });
      }

      case "address": {
        if (!query.kind || !query.pubkey || query.pubkey.length !== 64) {
          console.warn("useNostrQuery - Invalid address query:", query);
          return undefined;
        }

        return addressLoader({
          kind: query.kind,
          pubkey: query.pubkey,
          identifier: query.identifier,
        });
      }

      case "timeline": {
        if (!query.filter) {
          console.warn("useNostrQuery - No filter provided for timeline query");
          return undefined;
        }

        return pool.relay(DEFAULT_RELAYS[0]!).subscription([query.filter])
          .pipe(
            onlyEvents(),
            mapEventsToStore(eventStore),
            mapEventsToTimeline(),
            map((t) => [...t]),
            startWith([]),
          );
      }

      default:
        console.warn("useNostrQuery - Unknown query type:", (query as any).type);
        return undefined;
    }
  }, [query, eventStore, pool, addressLoader, eventLoader]);

  const result = useObservableState(observable ?? of(undefined));
  return result;
}
