import { EventStore } from "applesauce-core";
import { RelayPool } from "applesauce-relay";
import { ExtensionSigner } from "applesauce-signers";
import {
  createAddressLoader,
  type AddressPointerLoader,
} from "applesauce-loaders/loaders";
import { createContext, useContext } from "react";

export const NostrContext = createContext<{ eventStore: EventStore, pool: RelayPool, signer: ExtensionSigner, addressLoader: AddressPointerLoader } | null>(null);

export const NostrProvider = ({ children }: { children: React.ReactNode }) => {
    // Create an event store for all events
    const eventStore = new EventStore();

    // Create a relay pool to make relay connections
    const pool = new RelayPool();
  
    // Create a signer
    const signer = new ExtensionSigner();
  
    // Create an address loader to load user profiles
    const addressLoader = createAddressLoader(pool, {
      eventStore,
      lookupRelays: ["wss://purplepag.es", "wss://index.hzrd149.com"],
    });
  
    // Add loaders to event store
    // These will be called if the event store doesn't have the requested event
    eventStore.addressableLoader = addressLoader;
    eventStore.replaceableLoader = addressLoader;

    if (!eventStore || !pool || !signer || !addressLoader) {
      return <>Loading...</>
    }

  return <NostrContext value={{ eventStore, pool, signer, addressLoader }}>{children}</NostrContext>;
};

export const useNostr = () => {
  const nostr = useContext(NostrContext);
  if (!nostr) {
    throw new Error("useNostr must be used within a NostrProvider");
  }
  return nostr;
};