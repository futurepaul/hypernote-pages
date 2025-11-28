import type { ProfileContent } from "applesauce-core/helpers";
import { useContext, useMemo } from "react";
import { useObservableMemo } from "./use-observable-memo";
import { NostrContext } from "@/components/NostrContext";
import { onlyEvents } from "applesauce-relay";
import { mapEventsToStore, mapEventsToTimeline } from "applesauce-core/observable";
import { first, map, startWith, tap } from "rxjs";
import { nip19 } from "nostr-tools";
import { DEFAULT_RELAYS } from "@/lib/relays";

export function useNostr() {
    return useContext(NostrContext);
}

export function useProfile(
    pubkey: string,
    relays?: string[]
  ): ProfileContent | undefined {
    const nostr = useNostr();
    const user = useMemo(
      () => ({ pubkey, relays }),
      [pubkey, relays?.join("|")]
    );
    return useObservableMemo(
      () => nostr?.eventStore.profile(user),
      [pubkey, relays?.join("|")]
    );
  }

export function usePages(authorPubkey?: string) {
  const nostr = useNostr();
  return useObservableMemo(
    () => {
      const filter: any = { kinds: [32616], "#t": ["hypernote-v1.3.0"], limit: 20 };
      if (authorPubkey) {
        filter.authors = [authorPubkey];
      }
      return nostr?.pool.relay(DEFAULT_RELAYS[0]!).subscription([filter])
      .pipe(
        onlyEvents(),
        mapEventsToStore(nostr?.eventStore),
        mapEventsToTimeline(),
        map((t) => [...t]),
        startWith([]),
      );
    },
    [nostr?.eventStore, authorPubkey]
  );
}

export function usePage(naddr: string) {
  const nostr = useNostr();

  // Parse naddr - must do this before hooks to get stable values
  const parsed = useMemo(() => {
    if (!naddr) return null;
    try {
      const decoded = nip19.decode(naddr);
      if (decoded.type !== "naddr") return null;
      const { pubkey, identifier, relays } = decoded.data;
      return { pubkey, identifier, relays: relays?.length ? relays : DEFAULT_RELAYS };
    } catch {
      return null;
    }
  }, [naddr]);

  // Always call the hook - return undefined observable if invalid
  return useObservableMemo(
    () => {
      if (!parsed) return undefined;
      return nostr?.pool.relay(parsed.relays[0]!).subscription([{
        kinds: [32616],
        limit: 1,
        "#d": [parsed.identifier],
        authors: [parsed.pubkey]
      }]).pipe(
        onlyEvents(),
        mapEventsToStore(nostr?.eventStore),
        first(),
      );
    },
    [naddr, parsed]
  );
}

/**
 * Fetch user's published components (hypernote-component tag)
 */
export function useUserComponents(authorPubkey?: string) {
  const nostr = useNostr();
  return useObservableMemo(
    () => {
      const filter: any = { kinds: [32616], "#t": ["hypernote-component"], limit: 20 };
      if (authorPubkey) {
        filter.authors = [authorPubkey];
      }
      return nostr?.pool.relay(DEFAULT_RELAYS[0]!).subscription([filter])
      .pipe(
        onlyEvents(),
        mapEventsToStore(nostr?.eventStore),
        mapEventsToTimeline(),
        map((t) => [...t]),
        startWith([]),
      );
    },
    [nostr?.eventStore, authorPubkey]
  );
}