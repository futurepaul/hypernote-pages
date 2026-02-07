# Phase 3: Nostr Data Integration - COMPLETE ✅

## What Was Implemented

### 1. **`useNostrQuery` Hook** (`src/hooks/useNostrQuery.ts`)

A single, unified hook that handles all Nostr data queries:

- **Profile queries**: `{ type: "profile", pubkey }`
- **Event queries**: `{ type: "event", id }`
- **Address queries**: `{ type: "address", kind, pubkey, identifier }`
- **Timeline queries**: `{ type: "timeline", filter }`

**Key Features:**
- Uses applesauce loaders (`addressLoader`, `eventStore.timeline`)
- Converts RxJS observables to React state via `useObservableState`
- Validates inputs and provides helpful warnings
- Reactive - updates automatically when data changes

### 2. **Preview.tsx Integration**

Updated `Preview.tsx` to:
- Parse frontmatter query definitions
- Call `useNostrQuery` with the parsed query
- Wire results into NodeRenderer's scope
- Support all query types automatically

### 3. **Scope Structure**

Query results are available in expressions via the `queries` object:

```typescript
scope.queries = {
  profile: ...,   // From profile query
  event: ...,     // From event query
  events: ...,    // From timeline query
  address: ...,   // From address query
}
```

## Usage Examples

### Load a Profile

```yaml
---
profile: "hex_pubkey"
---

# {queries.profile.name}

{queries.profile.about}
```

### Load Events

```yaml
---
filter:
  kinds: [1]
  limit: 20
---

<Each from={queries.events} as="note">
  {note.content}
</Each>
```

### Load Single Event

```yaml
---
event: "event_id_hex"
---

{queries.event.content}
```

### Load by Address

```yaml
---
address:
  kind: 30023
  pubkey: "hex_pubkey"
  identifier: "article-slug"
---

{queries.address.content}
```

## Architecture Benefits

### Compared to v2 (zig-nostr-loader approach):

✅ **Less boilerplate** - One hook instead of 5 DataRenderer components
✅ **More flexible** - Can be used anywhere, not just in ComponentRenderer
✅ **Idiomatic applesauce** - Uses observables + `useObservableState`
✅ **Works at the edges** - Define query, get data, no prop drilling
✅ **Type-safe** - Full TypeScript support

### How It Works "At the Edges":

```
Frontmatter (YAML)
    ↓
Parse query definition
    ↓
useNostrQuery hook (React component boundary)
    ↓
Applesauce loaders (Observable)
    ↓
useObservableState (React state)
    ↓
Scope (passed to NodeRenderer)
    ↓
Expressions {queries.profile.name}
```

## What's Next

### Phase 4: `<Each>` Component (Already Implemented!)
You already have `<Each>` working in NodeRenderer. Just needs testing with real Nostr data.

### Phase 5: Custom Component Registry (Optional)

If you want to create reusable `.hnmc` components like v2:

1. Create ComponentProvider context
2. Parse component frontmatter for query definitions
3. Call `useNostrQuery` in ComponentRenderer
4. Render component AST with query results in scope

**The same `useNostrQuery` hook works everywhere!**

## Testing

See `EXAMPLE_NOSTR_QUERY.md` for copy-paste examples to test.

Try:
1. Run `bun dev`
2. Go to `/editor`
3. Paste an example with a real pubkey
4. Watch it load data automatically!

## File Changes Summary

- ✅ Created: `src/hooks/useNostrQuery.ts` (95 lines)
- ✅ Updated: `src/components/Preview.tsx` (added query parsing + hook usage)
- ✅ Updated: `src/components/NodeRenderer.tsx` (cleaned up debug code)
- ✅ Created: `EXAMPLE_NOSTR_QUERY.md` (documentation)

---

**Phase 3 is COMPLETE! You can now query Nostr data declaratively in frontmatter.**
