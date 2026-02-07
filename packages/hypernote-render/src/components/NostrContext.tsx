/**
 * Simplified NostrContext for hypernote-render
 * Read-only by default (no auth UI, no signer management)
 * Provides relay pool, event store, and loaders for fetching Nostr data
 */

import { EventStore } from "applesauce-core";
import { RelayPool } from "applesauce-relay";
import {
  createAddressLoader,
  createEventLoader,
  type AddressPointerLoader,
  type EventPointerLoader,
} from "applesauce-loaders/loaders";
import { createContext, useContext, useMemo } from "react";
import { LOOKUP_RELAYS, DEFAULT_RELAYS } from "../lib/relays";

interface NostrContextValue {
  eventStore: EventStore;
  pool: RelayPool;
  addressLoader: AddressPointerLoader;
  eventLoader: EventPointerLoader;
  pubkey: string | null;
  isReadonly: boolean;
}

export const NostrContext = createContext<NostrContextValue | null>(null);

// Create singleton instances
const eventStore = new EventStore();
const pool = new RelayPool();
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
  const value = useMemo(() => ({
    eventStore,
    pool,
    addressLoader,
    eventLoader,
    pubkey: null,
    isReadonly: true,
  }), []);

  return <NostrContext value={value}>{children}</NostrContext>;
};

export const useNostr = () => {
  const nostr = useContext(NostrContext);
  if (!nostr) {
    throw new Error("useNostr must be used within a NostrProvider");
  }
  return nostr;
};
