import { useContext, useMemo } from "react";
import { NostrContext } from "../components/NostrContext";
import { useObservableMemo } from "./use-observable-memo";
import { onlyEvents } from "applesauce-relay";
import { mapEventsToStore } from "applesauce-core/observable";
import { first } from "rxjs";
import { nip19 } from "nostr-tools";
import { DEFAULT_RELAYS } from "../lib/relays";

export function useNostr() {
  return useContext(NostrContext);
}

export function usePage(naddr: string) {
  const nostr = useNostr();

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
