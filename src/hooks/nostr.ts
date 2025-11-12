import type { ProfileContent } from "applesauce-core/helpers";
import { useContext, useMemo } from "react";
import { useObservableMemo } from "./use-observable-memo";
import { NostrContext } from "@/components/NostrContext";

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