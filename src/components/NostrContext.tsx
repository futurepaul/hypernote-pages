import { EventStore } from "applesauce-core";
import { RelayPool } from "applesauce-relay";
import { ExtensionSigner } from "applesauce-signers";
import {
  createAddressLoader,
  createEventLoader,
  type AddressPointerLoader,
  type EventPointerLoader,
} from "applesauce-loaders/loaders";
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { nip19 } from "nostr-tools";
import { LOOKUP_RELAYS, DEFAULT_RELAYS } from "@/lib/relays";

interface NostrContextValue {
  eventStore: EventStore;
  pool: RelayPool;
  signer: ExtensionSigner;
  addressLoader: AddressPointerLoader;
  eventLoader: EventPointerLoader;
  pubkey: string | null;
  isReadonly: boolean;
  hasExtension: boolean;
  login: (method: 'extension' | 'npub', npubOrHex?: string) => Promise<void>;
  logout: () => void;
}

export const NostrContext = createContext<NostrContextValue | null>(null);

const eventStore = new EventStore();
const pool = new RelayPool();
const signer = new ExtensionSigner();
const addressLoader = createAddressLoader(pool, {
  eventStore,
  lookupRelays: LOOKUP_RELAYS,
});
const eventLoader = createEventLoader(pool, {
  eventStore,
  extraRelays: DEFAULT_RELAYS,
});
eventStore.addressableLoader = addressLoader;
eventStore.replaceableLoader = addressLoader;

export const NostrProvider = ({ children }: { children: React.ReactNode }) => {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [isReadonly, setIsReadonly] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);

  // Check for extension on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "nostr" in window) {
      setHasExtension(true);
      return;
    }
    const intervals = [100, 200, 400, 800, 1600];
    let timeoutIds: ReturnType<typeof setTimeout>[] = [];
    let totalDelay = 0;
    for (const interval of intervals) {
      totalDelay += interval;
      const timeoutId = setTimeout(() => {
        if (typeof window !== "undefined" && "nostr" in window) {
          setHasExtension(true);
          timeoutIds.forEach((id) => clearTimeout(id));
          timeoutIds = [];
        }
      }, totalDelay);
      timeoutIds.push(timeoutId);
    }
    return () => timeoutIds.forEach((id) => clearTimeout(id));
  }, []);

  // Restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("hn-auth");
    if (stored) {
      try {
        const { pubkey, isReadonly } = JSON.parse(stored);
        setPubkey(pubkey);
        setIsReadonly(isReadonly);
      } catch {}
    }
  }, []);

  const login = useCallback(async (method: 'extension' | 'npub', npubOrHex?: string) => {
    if (method === 'extension') {
      const pk = await signer.getPublicKey();
      setPubkey(pk);
      setIsReadonly(false);
      localStorage.setItem("hn-auth", JSON.stringify({ pubkey: pk, isReadonly: false }));
    } else if (method === 'npub' && npubOrHex) {
      let pk = npubOrHex;
      if (npubOrHex.startsWith("npub")) {
        const decoded = nip19.decode(npubOrHex);
        if (decoded.type === "npub") {
          pk = decoded.data;
        }
      }
      setPubkey(pk);
      setIsReadonly(true);
      localStorage.setItem("hn-auth", JSON.stringify({ pubkey: pk, isReadonly: true }));
    }
  }, []);

  const logout = useCallback(() => {
    setPubkey(null);
    setIsReadonly(false);
    localStorage.removeItem("hn-auth");
  }, []);

  const value = useMemo(() => ({
    eventStore,
    pool,
    signer,
    addressLoader,
    eventLoader,
    pubkey,
    isReadonly,
    hasExtension,
    login,
    logout,
  }), [pubkey, isReadonly, hasExtension, login, logout]);

  return <NostrContext value={value}>{children}</NostrContext>;
};

export const useNostr = () => {
  const nostr = useContext(NostrContext);
  if (!nostr) {
    throw new Error("useNostr must be used within a NostrProvider");
  }
  return nostr;
};