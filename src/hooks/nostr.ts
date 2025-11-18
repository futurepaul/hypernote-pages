import type { ProfileContent } from "applesauce-core/helpers";
import { useContext, useMemo } from "react";
import { useObservableMemo } from "./use-observable-memo";
import { NostrContext } from "@/components/NostrContext";
import { onlyEvents } from "applesauce-relay";
import { mapEventsToStore, mapEventsToTimeline } from "applesauce-core/observable";
import { first, map, startWith, tap } from "rxjs";
import { nip19 } from "nostr-tools";

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

export function usePages() {
  const nostr = useNostr();
  return useObservableMemo(
    () => {
      return nostr?.pool.relay("wss://nos.lol").subscription([{ kinds: [32616], "#t": ["hypernote-v1.3.0"], limit: 10 }])
      .pipe(
        onlyEvents(),
        mapEventsToStore(nostr?.eventStore),
        mapEventsToTimeline(),
        map((t) => [...t]),
        startWith([]),
      );
    },
    [nostr?.eventStore]
  );
}

export function usePage(naddr: string) {
  const nostr = useNostr();

  const decoded = nip19.decode(naddr);
  console.log(decoded);
  if (decoded.type !== "naddr") {
    throw new Error("Invalid naddr");
  }
  const pubkey = decoded.data.pubkey;
  const identifier = decoded.data.identifier;
  const relays = decoded.data.relays; 
  if (!relays || relays.length === 0) {
    throw new Error("Relays not found");
  }
  return useObservableMemo(
    () => nostr?.pool.relay(relays[0]!).subscription([{ kinds: [32616], limit: 1, "#d": [identifier] }])
    .pipe(
      onlyEvents(),
      mapEventsToStore(nostr?.eventStore),
      tap((e) => console.log(e)),
      first(),
    ),
    [naddr]
  );
}