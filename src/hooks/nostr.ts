import type { ProfileContent } from "applesauce-core/helpers";
import { use$ } from "applesauce-react/hooks";
import { useNostr } from "@/components/NostrContext";
import { onlyEvents } from "applesauce-relay";
import { mapEventsToStore, mapEventsToTimeline } from "applesauce-core/observable";
import { map, startWith } from "rxjs";
import { DEFAULT_RELAYS } from "@/lib/relays";

export { useNostr } from "@/components/NostrContext";

export function useProfile(pubkey: string): ProfileContent | undefined {
  const nostr = useNostr();

  return use$(
    () => {
      if (!pubkey) return undefined;
      return nostr.eventStore.replaceable(0, pubkey).pipe(
        map((event) => {
          if (!event) return undefined;
          try {
            return JSON.parse(event.content) as ProfileContent;
          } catch {
            return undefined;
          }
        }),
      );
    },
    [pubkey],
  );
}

export function usePages(authorPubkey?: string, status?: "published" | "draft") {
  const nostr = useNostr();
  return use$(
    () => {
      const filter: any = { kinds: [32616], "#t": ["hypernote-page"], limit: 20 };
      if (authorPubkey) {
        filter.authors = [authorPubkey];
      }
      if (status) {
        filter["#status"] = [status];
      }
      return nostr.pool.relay(DEFAULT_RELAYS[0]!).subscription([filter])
      .pipe(
        onlyEvents(),
        mapEventsToStore(nostr.eventStore),
        mapEventsToTimeline(),
        map((t) => [...t]),
        startWith([]),
      );
    },
    [nostr.eventStore, authorPubkey, status]
  );
}

/**
 * Fetch user's published components (hypernote-component tag)
 */
export function useUserComponents(authorPubkey?: string) {
  const nostr = useNostr();
  return use$(
    () => {
      const filter: any = { kinds: [32616], "#t": ["hypernote-component"], limit: 20 };
      if (authorPubkey) {
        filter.authors = [authorPubkey];
      }
      return nostr.pool.relay(DEFAULT_RELAYS[0]!).subscription([filter])
      .pipe(
        onlyEvents(),
        mapEventsToStore(nostr.eventStore),
        mapEventsToTimeline(),
        map((t) => [...t]),
        startWith([]),
      );
    },
    [nostr.eventStore, authorPubkey]
  );
}

/**
 * Fetch user's blossom servers from kind 10063 events
 */
export function useBlossomServers(pubkey?: string): URL[] | undefined {
  const nostr = useNostr();

  // Fetch the kind 10063 event from relays and store it
  use$(
    () => {
      if (!pubkey) return undefined;
      return nostr.pool.relay(DEFAULT_RELAYS[0]!).subscription([{
        kinds: [10063],
        authors: [pubkey],
        limit: 1,
      }]).pipe(
        onlyEvents(),
        mapEventsToStore(nostr.eventStore),
      );
    },
    [nostr.eventStore, nostr.pool, pubkey]
  );

  // Subscribe to the replaceable event and parse server tags
  return use$(
    () => {
      if (!pubkey) return undefined;
      return nostr.eventStore.replaceable(10063, pubkey).pipe(
        map((event) => {
          if (!event) return undefined;
          const servers: URL[] = [];
          for (const tag of event.tags) {
            if (tag[0] === "server" && tag[1]) {
              try {
                servers.push(new URL(tag[1]));
              } catch {}
            }
          }
          return servers.length > 0 ? servers : undefined;
        }),
      );
    },
    [nostr.eventStore, pubkey]
  );
}

/**
 * Fetch user's hypernote media (hypernote-media tag)
 */
export function useHypernoteMedia(authorPubkey?: string) {
  const nostr = useNostr();
  return use$(
    () => {
      if (!authorPubkey) return undefined;
      return nostr.pool.relay(DEFAULT_RELAYS[0]!).subscription([{
        kinds: [32616],
        authors: [authorPubkey],
        "#t": ["hypernote-media"],
        limit: 50,
      }]).pipe(
        onlyEvents(),
        mapEventsToStore(nostr.eventStore),
        mapEventsToTimeline(),
        map((t) => [...t]),
        startWith([]),
      );
    },
    [nostr.eventStore, authorPubkey]
  );
}
