import { useNostr } from "../components/NostrContext";
import { use$ } from "applesauce-react/hooks";
import { useMemo } from "react";
import type { Filter as NostrFilter } from "nostr-tools";
import { map, startWith } from "rxjs";
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
  const { eventStore, pool } = useNostr();

  // Parse query params once so they're stable for use$ deps
  const parsedParams = useMemo(() => {
    if (!query) return undefined;
    try {
      switch (query.type) {
        case "profile": {
          const { pubkey } = parsePubkey(query.pubkey);
          return { type: "profile" as const, pubkey };
        }
        case "event": {
          const parsed = parseEventId(query.id);
          return { type: "event" as const, id: parsed.id };
        }
        case "address": {
          if (!query.kind || !query.pubkey || query.pubkey.length !== 64) return undefined;
          return { type: "address" as const, kind: query.kind, pubkey: query.pubkey, identifier: query.identifier };
        }
        case "timeline": {
          if (!query.filter) return undefined;
          return { type: "timeline" as const, filter: query.filter };
        }
      }
    } catch (e) {
      console.warn("useNostrQuery - Parse error:", e);
      return undefined;
    }
  }, [query]);

  // Stable dep key to avoid unnecessary observable recreation
  const depKey = useMemo(() => {
    if (!parsedParams) return "";
    switch (parsedParams.type) {
      case "profile": return `profile:${parsedParams.pubkey}`;
      case "event": return `event:${parsedParams.id}`;
      case "address": return `address:${parsedParams.kind}:${parsedParams.pubkey}:${parsedParams.identifier ?? ""}`;
      case "timeline": return `timeline:${JSON.stringify(parsedParams.filter)}`;
    }
  }, [parsedParams]);

  return use$(() => {
    if (!parsedParams) return undefined;

    switch (parsedParams.type) {
      case "profile": {
        // eventStore.replaceable auto-triggers the unified loader, checks cache first
        return eventStore.replaceable(0, parsedParams.pubkey).pipe(
          map((event) => {
            if (!event) return event;
            try {
              return { ...event, ...JSON.parse(event.content) };
            } catch {
              return event;
            }
          }),
        );
      }

      case "event": {
        return eventStore.event(parsedParams.id);
      }

      case "address": {
        return eventStore.addressable({
          kind: parsedParams.kind,
          pubkey: parsedParams.pubkey,
          identifier: parsedParams.identifier ?? "",
        });
      }

      case "timeline": {
        // Timeline: subscribe to relay and accumulate in store
        return pool.relay(DEFAULT_RELAYS[0]!).subscription([parsedParams.filter])
          .pipe(
            onlyEvents(),
            mapEventsToStore(eventStore),
            mapEventsToTimeline(),
            map((t) => [...t]),
            startWith([]),
          );
      }

      default:
        return undefined;
    }
  }, [depKey]);
}
