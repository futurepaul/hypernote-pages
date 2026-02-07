/**
 * NostrContext for hypernote-render
 *
 * Embeddable: accepts optional external eventStore/pool/signer props.
 * Standalone: creates its own instances with nostr-idb caching.
 */

import { EventStore, EventFactory } from "applesauce-core";
import type { EventSigner } from "applesauce-core/event-factory";
import { persistEventsToCache } from "applesauce-core/helpers";
import { RelayPool } from "applesauce-relay";
import { createEventLoaderForStore } from "applesauce-loaders/loaders";
import { EventStoreProvider } from "applesauce-react/providers";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { LOOKUP_RELAYS, DEFAULT_RELAYS } from "../lib/relays";

// ---------- Types ----------

export interface NostrContextValue {
  eventStore: EventStore;
  pool: RelayPool;
  signer: EventSigner | null;
  factory: EventFactory | null;
  setSigner?: (signer: EventSigner | null) => void;
  pubkey: string | null;
  isReadonly: boolean;
}

export interface NostrProviderProps {
  children: React.ReactNode;
  /** Pass your own EventStore (embedding mode) */
  eventStore?: EventStore;
  /** Pass your own RelayPool (embedding mode) */
  pool?: RelayPool;
  /** Pass your own signer (embedding mode — skips login UI) */
  signer?: EventSigner | null;
  /** Override default relays */
  relays?: string[];
  /** Override lookup relays */
  lookupRelays?: string[];
  /** Disable nostr-idb caching (e.g. SSR or tests) */
  disableCache?: boolean;
}

// ---------- Context ----------

export const NostrContext = createContext<NostrContextValue | null>(null);

// ---------- Provider ----------

export function NostrProvider({
  children,
  eventStore: externalStore,
  pool: externalPool,
  signer: externalSigner,
  relays = DEFAULT_RELAYS,
  lookupRelays = LOOKUP_RELAYS,
  disableCache = false,
}: NostrProviderProps) {
  // Use external instances or create our own (once)
  const eventStore = useMemo(() => externalStore ?? new EventStore(), [externalStore]);
  const pool = useMemo(() => externalPool ?? new RelayPool(), [externalPool]);

  // Track whether we own the instances (so we set up loader + caching)
  const ownsInstances = !externalStore;

  // Wire up unified loader + nostr-idb caching (only if we own the store)
  const loaderReady = useRef(false);
  useEffect(() => {
    if (!ownsInstances || loaderReady.current) return;
    loaderReady.current = true;

    let cleanup: (() => void) | undefined;

    const setup = async () => {
      let cacheRequest: ((filters: any[]) => Promise<any[]>) | undefined;

      if (!disableCache && typeof window !== "undefined") {
        try {
          const { NostrIDB } = await import("nostr-idb");
          const nostrIDB = new NostrIDB(undefined, {
            cacheIndexes: 1000,
            maxEvents: 10000,
          });
          await nostrIDB.start();

          cacheRequest = (filters) => nostrIDB.filters(filters);

          const stopPersist = persistEventsToCache(eventStore, async (events) => {
            await Promise.allSettled(events.map((event) => nostrIDB.add(event)));
          });

          cleanup = () => {
            stopPersist();
            nostrIDB.stop();
          };
        } catch (e) {
          console.warn("Failed to initialize nostr-idb cache:", e);
        }
      }

      createEventLoaderForStore(eventStore, pool, {
        lookupRelays,
        extraRelays: relays,
        cacheRequest,
        followRelayHints: true,
      });
    };

    setup();

    return () => {
      cleanup?.();
    };
  }, [ownsInstances, eventStore, pool, relays, lookupRelays, disableCache]);

  // Signer state: external signer takes precedence, otherwise internal
  const [internalSigner, setInternalSigner] = useState<EventSigner | null>(null);
  const signer = externalSigner !== undefined ? externalSigner : internalSigner;

  // Pubkey from signer
  const [pubkey, setPubkey] = useState<string | null>(null);
  useEffect(() => {
    if (!signer) {
      setPubkey(null);
      return;
    }
    const result = signer.getPublicKey();
    if (result instanceof Promise) {
      result.then(setPubkey).catch(() => setPubkey(null));
    } else {
      setPubkey(result);
    }
  }, [signer]);

  // EventFactory (available when signer is set)
  const factory = useMemo(
    () => signer ? new EventFactory({ signer }) : null,
    [signer],
  );

  const value = useMemo<NostrContextValue>(() => ({
    eventStore,
    pool,
    signer,
    factory,
    setSigner: externalSigner !== undefined ? undefined : setInternalSigner,
    pubkey,
    isReadonly: !signer,
  }), [eventStore, pool, signer, factory, pubkey, externalSigner]);

  return (
    <EventStoreProvider eventStore={eventStore}>
      <NostrContext value={value}>
        {children}
      </NostrContext>
    </EventStoreProvider>
  );
}

// ---------- Hook ----------

export const useNostr = () => {
  const nostr = useContext(NostrContext);
  if (!nostr) {
    throw new Error("useNostr must be used within a NostrProvider");
  }
  return nostr;
};
