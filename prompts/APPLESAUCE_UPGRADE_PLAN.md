# Applesauce Upgrade Plan

## What's wrong today

Our `NostrContext.tsx` has 5 significant gaps vs. applesauce best practices:

1. **Separate loaders instead of unified.** We call `createAddressLoader` + `createEventLoader` separately and manually assign `eventStore.addressableLoader` / `eventStore.replaceableLoader`. Applesauce v5 provides `createEventLoaderForStore` which does both in one call and auto-wires `eventStore.eventLoader`.

2. **No caching.** Every page load hits relays from scratch. Profiles fetched 5 seconds ago get re-fetched. Applesauce has `persistEventsToCache` + `nostr-idb` (IndexedDB with in-memory index caching) designed exactly for this.

3. **`observable-hooks` instead of `applesauce-react`.** We have a hand-rolled `useObservableMemo` wrapper using `observable-hooks`. Applesauce v5 ships `applesauce-react` with a `use$` hook that handles all the same patterns (factory with deps, conditional subscriptions, BehaviorSubject support) plus automatic error boundary integration.

4. **Manual event construction for actions.** `usePageContext.ts` would need to build event templates by hand. Applesauce provides `EventFactory` which handles signing, client tags, relay hints. **Note:** We still need raw event construction for arbitrary events from hypernotes, but `EventFactory` handles the common structured cases.

5. **Not embeddable.** Our `NostrContext` creates singletons at module level. When someone imports `<HypernotePreview>` into their app that already has its own relay pool and event store, we'd create duplicates. We need to accept external instances via props.

---

## Dependency changes

**Remove:**
```
observable-hooks
```

**Add:**
```
applesauce-react    ^5.x
applesauce-signers  ^5.x
nostr-idb           (latest)
```

**Update:**
```
applesauce-core     ^4.2.0  →  ^5.x
applesauce-loaders  ^4.2.0  →  ^5.x
applesauce-relay    ^4.2.0  →  ^5.x
```

**Note on `applesauce-accounts`:** We may not need the full AccountManager for now. Phase 4 login can work with just `ExtensionSigner` from `applesauce-signers` + `EventFactory` from `applesauce-core`. We can add `applesauce-accounts` later if multi-account support becomes a thing.

---

## Phase 1: Update deps and rewire core

**Goal:** Get the foundation right — unified loader, caching, drop `observable-hooks`.

### 1.1 Update package.json

```diff
- "applesauce-core": "^4.2.0",
- "applesauce-loaders": "^4.2.0",
- "applesauce-relay": "^4.2.0",
- "observable-hooks": "^4.2.4",
+ "applesauce-core": "^5.1.0",
+ "applesauce-loaders": "^5.1.0",
+ "applesauce-relay": "^5.1.0",
+ "applesauce-react": "^5.1.0",
+ "applesauce-signers": "^5.1.0",
+ "nostr-idb": "latest",
```

Run `bun install` in the package directory.

### 1.2 Check for breaking import changes

The v4→v5 migration guide says:
- Root exports are mostly unchanged for `applesauce-core`, `applesauce-relay`, `applesauce-loaders`
- `mapEventsToStore` moves to `applesauce-core` (was also in `applesauce-core/observable` — verify)
- `onlyEvents` stays in `applesauce-relay`
- `persistEventsToCache` is in `applesauce-core/helpers`
- `use$` is in `applesauce-react/hooks`

Check every import in our codebase against v5 and fix any that moved.

### 1.3 Rewire NostrContext.tsx — loader setup

**Before (current code):**
```ts
import { createAddressLoader, createEventLoader } from "applesauce-loaders/loaders";

const addressLoader = createAddressLoader(pool, { eventStore, lookupRelays: LOOKUP_RELAYS });
const eventLoader = createEventLoader(pool, { eventStore, extraRelays: DEFAULT_RELAYS });
eventStore.addressableLoader = addressLoader;
eventStore.replaceableLoader = addressLoader;
```

**After:**
```ts
import { createEventLoaderForStore } from "applesauce-loaders/loaders";

createEventLoaderForStore(eventStore, pool, {
  lookupRelays: LOOKUP_RELAYS,
  extraRelays: DEFAULT_RELAYS,
  cacheRequest,       // from nostr-idb, see 1.4
  followRelayHints: true,
});
```

This single call:
- Creates a unified loader that handles both `EventPointer` and `AddressPointer`
- Auto-assigns `eventStore.eventLoader`
- Integrates the cache

### 1.4 Wire up nostr-idb caching

Add initialization code (browser-only, in NostrContext or a dedicated init module):

```ts
import { NostrIDB } from "nostr-idb";
import { persistEventsToCache } from "applesauce-core/helpers";

// Create the IndexedDB cache with in-memory indexes for performance
// IMPORTANT: must use NostrIDB class (not the raw openDB) for in-memory index caching
const nostrIDB = new NostrIDB();
await nostrIDB.start();

// Cache request function — used by the event loader to check cache before hitting relays
function cacheRequest(filters: Filter[]) {
  return nostrIDB.filters(filters);
}

// Persist new events from EventStore → IndexedDB
persistEventsToCache(eventStore, async (events) => {
  await Promise.allSettled(events.map((event) => nostrIDB.add(event)));
});
```

**Important note from the author:** "Make sure you are using the NostrIDB interface that has built-in in-memory indexes. Otherwise you will get terrible performance from idb." — We're using `NostrIDB` class which has this.

### 1.5 Delete `use-observable-memo.ts`

This file is replaced entirely by `use$` from `applesauce-react/hooks`.

### Files changed in Phase 1:
- `package.json` — dependency updates
- `src/components/NostrContext.tsx` — unified loader + caching setup
- `src/hooks/use-observable-memo.ts` — **DELETE**
- `src/hooks/nostr.ts` — update imports (use `use$` instead of `useObservableMemo`)
- `src/hooks/useNostrQuery.ts` — update imports (use `use$` instead of `useObservableState`)
- `src/index.ts` — remove `observable-hooks` re-exports if any

---

## Phase 2: Redesign NostrContext for embeddability

**Goal:** Make `<NostrProvider>` accept optional external instances so `<HypernotePreview>` works both standalone and embedded in a host app.

### 2.1 New NostrProvider props

```ts
interface NostrProviderProps {
  children: React.ReactNode;

  // Optional: pass your own instances (embedding mode)
  eventStore?: EventStore;
  pool?: RelayPool;
  signer?: EventSigner | null;

  // Optional: configuration for standalone mode
  relays?: string[];
  lookupRelays?: string[];

  // Optional: disable caching (e.g., in tests or SSR)
  disableCache?: boolean;
}
```

### 2.2 Provider logic

```ts
export function NostrProvider({
  children,
  eventStore: externalStore,
  pool: externalPool,
  signer: externalSigner,
  relays = DEFAULT_RELAYS,
  lookupRelays = LOOKUP_RELAYS,
  disableCache = false,
}: NostrProviderProps) {
  // Use external instances if provided, otherwise create defaults
  const eventStore = useMemo(() => externalStore ?? new EventStore(), [externalStore]);
  const pool = useMemo(() => externalPool ?? new RelayPool(), [externalPool]);

  // Wire up loader + caching (only if we created our own instances)
  useEffect(() => {
    if (externalStore) return; // Host app manages its own loader

    let nostrIDB: NostrIDB | null = null;
    let cacheRequest: ((filters: Filter[]) => ...) | undefined;

    const setup = async () => {
      if (!disableCache && typeof window !== "undefined") {
        nostrIDB = new NostrIDB();
        await nostrIDB.start();
        cacheRequest = (filters) => nostrIDB!.filters(filters);
        persistEventsToCache(eventStore, async (events) => {
          await Promise.allSettled(events.map((e) => nostrIDB!.add(e)));
        });
      }

      createEventLoaderForStore(eventStore, pool, {
        lookupRelays,
        extraRelays: relays,
        cacheRequest,
        followRelayHints: true,
      });
    };

    setup();
  }, [eventStore, pool, externalStore, relays, lookupRelays, disableCache]);

  // Signer state
  const [internalSigner, setInternalSigner] = useState<EventSigner | null>(null);
  const signer = externalSigner !== undefined ? externalSigner : internalSigner;
  const pubkey = use$(() => signer ? signer.getPublicKey?.() : undefined, [signer]);

  const value = useMemo(() => ({
    eventStore,
    pool,
    signer,
    setSigner: externalSigner !== undefined ? undefined : setInternalSigner,
    pubkey: pubkey ?? null,
    isReadonly: !signer,
  }), [eventStore, pool, signer, pubkey]);

  return (
    <EventStoreProvider eventStore={eventStore}>
      <NostrContext value={value}>
        {children}
      </NostrContext>
    </EventStoreProvider>
  );
}
```

### 2.3 Updated NostrContext interface

```ts
interface NostrContextValue {
  eventStore: EventStore;
  pool: RelayPool;
  signer: EventSigner | null;
  setSigner?: (signer: EventSigner | null) => void;  // only in standalone mode
  pubkey: string | null;
  isReadonly: boolean;
}
```

### 2.4 Wrap with applesauce-react's EventStoreProvider

By wrapping with `<EventStoreProvider>`, all the applesauce-react hooks (`useEventStore`, `useEventModel`, `use$` with store methods) will Just Work inside hypernote components.

### Embedding example (host app):

```tsx
import { HypernotePreview, NostrProvider } from "hypernote-render";

function MyApp() {
  // Host app's own instances
  const { eventStore, pool, signer } = useMyNostrSetup();

  return (
    <NostrProvider eventStore={eventStore} pool={pool} signer={signer}>
      <HypernotePreview ast={pageAst} />
    </NostrProvider>
  );
}
```

### Standalone example (CLI serve):

```tsx
// No props needed — creates its own instances
<NostrProvider>
  <HypernotePreview ast={pageAst} />
</NostrProvider>
```

### Files changed in Phase 2:
- `src/components/NostrContext.tsx` — full rewrite with prop-based DI
- `src/serve-frontend.tsx` — update to use new `<NostrProvider>` (no changes needed, it already passes no props)
- `src/index.ts` — export new types (`NostrProviderProps`, etc.)

---

## Phase 3: Replace hooks with `use$`

**Goal:** Replace all `observable-hooks` usage with `use$` from `applesauce-react/hooks`. Fix the race-condition / inconsistent profile loading.

### 3.1 Rewrite `useNostrQuery.ts`

**Before:** Uses `useObservableState` from `observable-hooks`, manually creates observables from loaders.

**After:** Use `use$` from `applesauce-react/hooks` + direct `eventStore` methods where possible.

```ts
import { use$ } from "applesauce-react/hooks";

export function useNostrQuery(query: NostrQuery | undefined) {
  const { eventStore, pool } = useNostr();

  return use$(() => {
    if (!query) return undefined;

    switch (query.type) {
      case "profile": {
        const pubkey = parsePubkey(query.pubkey).pubkey;
        // eventStore.replaceable auto-triggers the unified loader
        return eventStore.replaceable(0, pubkey);
      }
      case "event": {
        const parsed = parseEventId(query.id);
        return eventStore.event(parsed.id);
      }
      case "address": {
        return eventStore.addressable(query.kind, query.pubkey, query.identifier);
      }
      case "timeline": {
        // For timelines, subscribe to relay + store in eventStore, then read from store
        return pool.relay(DEFAULT_RELAYS[0]!)
          .subscription([query.filter])
          .pipe(
            onlyEvents(),
            mapEventsToStore(eventStore),
            mapEventsToTimeline(),
            startWith([]),
          );
      }
    }
  }, [query?.type, /* stable deps based on query type */]);
}
```

**Key improvement:** For profile/event/address queries, we now go through `eventStore.replaceable()` / `eventStore.event()` / `eventStore.addressable()` which:
- Check the in-memory store first
- Check the IDB cache via `cacheRequest`
- Hit relays only if needed
- Return a stable observable that updates reactively
- No more race conditions between loader and store

### 3.2 Rewrite `hooks/nostr.ts` — `usePage`

**Before:** Manually creates relay subscription with `useObservableMemo`.

**After:**
```ts
import { use$ } from "applesauce-react/hooks";

export function usePage(naddr: string) {
  const { eventStore } = useNostr();

  const parsed = useMemo(() => {
    if (!naddr) return null;
    try {
      const decoded = nip19.decode(naddr);
      if (decoded.type !== "naddr") return null;
      return decoded.data;
    } catch { return null; }
  }, [naddr]);

  return use$(
    () => parsed
      ? eventStore.addressable(32616, parsed.pubkey, parsed.identifier)
      : undefined,
    [parsed?.pubkey, parsed?.identifier]
  );
}
```

This is much simpler — we just ask the eventStore for the addressable event and it handles loading via the unified loader.

### 3.3 Profile data parsing

Currently `useNostrQuery` does inline `JSON.parse(event.content)` for profiles. With `use$` + `eventStore.replaceable()`, we get the raw event back. We should either:
- Parse content at the usage site (in builtins where Profile is rendered)
- Or use an applesauce model/helper if one exists for profile parsing

We'll check if applesauce has a `ProfileModel` or similar. If not, we keep the parsing in the query hook.

### Files changed in Phase 3:
- `src/hooks/useNostrQuery.ts` — rewrite with `use$` + eventStore methods
- `src/hooks/nostr.ts` — rewrite `usePage` with `use$` + eventStore.addressable
- `src/hooks/useComponent.ts` — update to use new `usePage`
- `src/lib/builtins.tsx` — update any direct observable usage

---

## Phase 4: Login UI

**Goal:** Add a login system that activates on interaction, uses `ExtensionSigner` from `applesauce-signers`, and works both standalone and embedded.

### 4.1 ExtensionSigner setup

```ts
import { ExtensionSigner, ExtensionMissingError } from "applesauce-signers/signers";

async function loginWithExtension(setSigner: (s: EventSigner) => void) {
  try {
    const signer = new ExtensionSigner();
    // Test that it works
    const pubkey = await signer.getPublicKey();
    setSigner(signer);
    return pubkey;
  } catch (e) {
    if (e instanceof ExtensionMissingError) {
      // Show "install a Nostr extension" message
    }
    throw e;
  }
}
```

### 4.2 Login trigger from interactions

When a user tries to:
- Click a `<Button>` that has an action
- Focus an `<Input>` or `<Textarea>` bound to a form with actions
- Any component that calls `executeAction`

We check `nostr.isReadonly`. If true, show a login prompt instead of executing.

### 4.3 Login modal component

A simple `<LoginModal>` component rendered inside `<NostrProvider>`:
- Shows when `loginRequested` state is true
- Offers "Login with Extension (NIP-07)" button
- On success, sets the signer via `setSigner`
- Closes automatically

### 4.4 When embedded: no login UI

If the host app provides a `signer` prop to `<NostrProvider>`, then:
- `setSigner` is undefined (host manages auth)
- `isReadonly` is false (signer is present)
- Login modal never appears
- Actions execute directly with the provided signer

### 4.5 EventFactory for actions

Create an `EventFactory` instance when a signer is available:

```ts
import { EventFactory } from "applesauce-core/event-factory";

// Inside NostrProvider or usePageContext
const factory = useMemo(
  () => signer ? new EventFactory({ signer }) : null,
  [signer]
);
```

Use it in `executeAction` for structured events (kind 1 notes, reactions, zaps, etc.).

**Important:** For arbitrary events defined in hypernote `actions`, we still need raw event construction since the hypernote author defines the event kind, tags, and content. `EventFactory.sign()` can still help sign these raw templates. The flow would be:
1. Build the event template from the action definition (kind, tags, content from form data)
2. Use `factory.sign(template)` to attach pubkey + signature
3. Publish via `pool.publish(relays, signedEvent)`

### Files changed in Phase 4:
- `src/components/NostrContext.tsx` — add login state, EventFactory
- `src/components/LoginModal.tsx` — **NEW** login UI component
- `src/hooks/usePageContext.ts` — rewrite `executeAction` to use EventFactory + raw signing
- `src/lib/builtins.tsx` — Button/Input trigger login check

---

## Enhancement 5: EventFactory for structured actions

**Goal:** Use `EventFactory` for common Nostr operations while keeping raw event construction for arbitrary hypernote actions.

### Structured actions (use EventFactory):
- Publishing kind 1 notes (chat messages, comments)
- Reactions (kind 7)
- Deletes (kind 5)
- Profile updates (kind 0)

### Arbitrary actions (raw construction + factory.sign):
- Any event kind defined in frontmatter `actions`
- Custom tags from form interpolation
- Dynamic content templates

### Implementation:
In `usePageContext.ts`, the `executeAction` function would:
1. Parse the action definition from frontmatter
2. Build the event template by interpolating form values into kind/tags/content
3. If the action matches a known pattern, use EventFactory's typed methods
4. Otherwise, construct a raw template and use `factory.sign(template)`
5. Publish and add to eventStore

---

## Enhancement 6: NIP-65 outbox model for relay selection

**Goal:** Route requests to each user's preferred relays instead of hardcoded `DEFAULT_RELAYS`.

### How it works:
- When loading a profile or event, check if we have the author's kind 10002 (relay list) event
- If available, use their declared relays for fetching their content
- `createEventLoaderForStore` with `followRelayHints: true` already does some of this
- Additionally, the `RelayPool` in applesauce supports outbox-model subscriptions

### Implementation:
- Set `followRelayHints: true` in the unified loader config (Phase 1 already does this)
- For timeline queries, consider using `pool.outboxSubscription()` if available
- Keep `DEFAULT_RELAYS` as fallback when no relay hints are available

### Priority: Medium
This is mostly handled by `followRelayHints: true` in the unified loader. The main additional work would be for timeline subscriptions, which currently hardcode a single relay.

---

## Enhancement 7: Memory management with eventStore.prune()

**Goal:** Prevent unbounded memory growth in long-running sessions.

### The problem:
For the `serve` command (dev preview), the event store accumulates events indefinitely. Timeline queries (like the chat room example) can produce thousands of events over time.

### The solution:
Applesauce's EventStore doesn't have a built-in `prune()` yet, but we can manage this by:
1. Using `nostr-idb`'s `maxEvents` option to cap the IDB cache size
2. For in-memory store: periodically check timeline sizes and unsubscribe from old subscriptions
3. If/when applesauce adds a claim/prune API, adopt it

### Implementation:
```ts
const nostrIDB = new NostrIDB({
  maxEvents: 10000,  // Cap the IDB cache
});
```

For in-memory management, this is lower priority — the IDB cache handles persistence, and page reloads reset the in-memory store.

### Priority: Low
This is a nice-to-have optimization. The IDB `maxEvents` cap handles the worst case. In-memory management is only relevant for very long `serve` sessions.

---

## Execution order

1. **Phase 1 + Phase 2** (tightly coupled — unified loader + embeddable provider)
   - Update deps
   - Rewrite NostrContext with DI + caching + unified loader
   - Delete `use-observable-memo.ts`
   - **Commit**

2. **Phase 3** (replace all hooks)
   - Rewrite `useNostrQuery`, `usePage`, `useComponent` with `use$`
   - Remove all `observable-hooks` imports
   - **Commit**

3. **Phase 4** (login UI)
   - Add `LoginModal` component
   - Wire up `ExtensionSigner`
   - Rewrite `executeAction` with EventFactory
   - **Commit**

4. **Enhancements 5-7** (incremental improvements)
   - Can be done as separate commits
   - Enhancement 5 is closely tied to Phase 4
   - Enhancement 6 is mostly free from Phase 1 config
   - Enhancement 7 is a minor config change

---

## Key reference: nostr-idb example

From the applesauce examples repo (`cache/nostr-idb.tsx`):

```ts
import { NostrIDB } from "nostr-idb";
import { persistEventsToCache } from "applesauce-core/helpers";
import { createEventLoaderForStore } from "applesauce-loaders/loaders";

const nostrIDB = new NostrIDB();
await nostrIDB.start();

const eventStore = new EventStore();
const pool = new RelayPool();

function cacheRequest(filters) {
  return nostrIDB.filters(filters);
}

createEventLoaderForStore(eventStore, pool, {
  cacheRequest,
  lookupRelays: ["wss://purplepag.es/", "wss://index.hzrd149.com/"],
});

persistEventsToCache(eventStore, async (events) => {
  await Promise.allSettled(events.map((event) => nostrIDB.add(event)));
});
```

**Author note:** "Make sure you are using the NostrIDB interface that has built-in in-memory indexes. Otherwise you will get terrible performance from idb."

## Key reference: `use$` patterns

```ts
import { use$ } from "applesauce-react/hooks";

// Direct observable
const profile = use$(user.profile$);

// Factory with deps (recreates when deps change)
const profile = use$(() => eventStore.replaceable(0, pubkey), [pubkey]);

// Conditional (returns undefined when factory returns undefined)
const event = use$(() => id ? eventStore.event(id) : undefined, [id]);
```

## Key reference: embedding pattern

```tsx
// Standalone (creates own instances)
<NostrProvider>
  <HypernotePreview ast={ast} />
</NostrProvider>

// Embedded (uses host's instances)
<NostrProvider eventStore={hostStore} pool={hostPool} signer={hostSigner}>
  <HypernotePreview ast={ast} />
</NostrProvider>
```
