import { EventStore } from "applesauce-core";
import { RelayPool } from "applesauce-relay";
import { createEventLoaderForStore } from "applesauce-loaders/loaders";
import { firstValueFrom, filter, timeout } from "rxjs";
import { parseAddress, DEFAULT_RELAYS, LOOKUP_RELAYS } from "@futurepaul/hypernote";

// Shared singletons — reused across requests
export const pool = new RelayPool();
export const eventStore = new EventStore();

createEventLoaderForStore(eventStore, pool, {
  lookupRelays: LOOKUP_RELAYS,
  extraRelays: DEFAULT_RELAYS,
});

// In-memory cache: naddr -> { event, timestamp }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { event: any; timestamp: number }>();

export async function fetchPageEvent(naddr: string) {
  // Check cache first
  const cached = cache.get(naddr);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.event;
  }

  try {
    const parsed = parseAddress(naddr);

    const event$ = eventStore.addressable({
      kind: parsed.kind,
      pubkey: parsed.pubkey,
      identifier: parsed.identifier,
    });

    const event = await firstValueFrom(
      event$.pipe(
        filter((e): e is NonNullable<typeof e> => !!e),
        timeout(3000)
      )
    );

    // Store in cache
    cache.set(naddr, { event, timestamp: Date.now() });

    return event;
  } catch {
    return null;
  }
}
