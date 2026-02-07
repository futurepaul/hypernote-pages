import { useContext, useMemo } from "react";
import { NostrContext } from "../components/NostrContext";
import { use$ } from "applesauce-react/hooks";
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
      return decoded.data;
    } catch {
      return null;
    }
  }, [naddr]);

  return use$(
    () => {
      if (!parsed || !nostr?.eventStore) return undefined;
      return nostr.eventStore.addressable({
        kind: 32616,
        pubkey: parsed.pubkey,
        identifier: parsed.identifier,
      });
    },
    [parsed?.pubkey, parsed?.identifier],
  );
}
