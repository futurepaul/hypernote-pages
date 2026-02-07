# Hypernote Pages - Drafts & Auth Implementation Plan

## Goal
Let users view published hypernote pages, copy to drafts, and publish their own version.

## Current State
- **Editor**: Has NIP-07 extension detection but no proper login flow
- **Viewer** (`/hn/:id`): Broken - "Relays not found" error when naddr has no embedded relays
- **Home** (`/`): Lists all hypernotes, no login, no user filtering
- **Nostr**: Uses applesauce (EventStore, RelayPool, ExtensionSigner)
- **Publishing**: Kind 32616 events to wss://nos.lol only

## Implementation Phases

### Phase 1: Auth System

**Create `src/components/Login.tsx`**
Simple login component with three options:
1. **Enter npub** - readonly mode (can view, copy to drafts, but can't publish)
2. **Use Extension** - poll for window.nostr (existing pattern from Editor.tsx)
3. Skip for now: Bunker/QR (overkill for MVP)

**Modify `src/components/NostrContext.tsx`**
Add auth state to context:
```typescript
interface NostrContextValue {
  // existing: eventStore, pool, signer
  pubkey: string | null;        // logged in user
  isReadonly: boolean;          // true if no signer
  login: (method: 'extension' | 'npub', npub?: string) => Promise<void>;
  logout: () => void;
}
```

Store pubkey in localStorage for persistence across refreshes.

### Phase 2: Editor Route

**Modify `src/components/Editor.tsx`**
1. If not logged in: show `<Login />` component
2. If logged in as readonly: show message "Extension required to publish"
3. If logged in with signer: show full editor

**Sidebar changes:**
- Move profile + logout button to bottom of left sidebar
- Filter file list to show only pages where `event.pubkey === userPubkey`
- Add "Published" vs "Draft" indicator based on status tag

### Phase 3: Page Tags (Metadata)

**When publishing, add these tags:**
```typescript
tags: [
  ['d', identifier],
  ['title', extractedTitle],           // NEW: title from frontmatter
  ['status', 'published'],             // NEW: or 'draft'
  ['hypernote', '1.3.0'],
  ['t', 'hypernote-page'],
]
```

**Extract title from frontmatter:**
```typescript
const frontmatter = parseFrontmatter(markdown);
const title = frontmatter.title || 'Untitled';
```

This avoids re-parsing content just to show titles in file browser.

### Phase 4: Root Route Changes

**Modify `src/components/Home.tsx`**
1. Add login component at top (same as Editor)
2. When viewing any page, show "Copy to Drafts" button
3. If logged in with signer: clicking "Copy to Drafts" creates a draft version in user's account

**Copy to Drafts flow:**
```typescript
async function copyToDrafts(event) {
  const newEvent = {
    kind: 32616,
    content: event.content,
    tags: [
      ['d', generateNewIdentifier()],
      ['title', getTagValue(event, 'title') || 'Untitled'],
      ['status', 'draft'],
      ['forked-from', event.id],  // attribution
      ['hypernote', '1.3.0'],
    ],
  };
  await signAndPublish(newEvent);
}
```

### Phase 5: Fix `/hn/:id` Route

**Problem**: `usePage()` throws when naddr has no relays

**Solution in `src/hooks/nostr.ts`:**
```typescript
export function usePage(naddr: string) {
  const decoded = nip19.decode(naddr);
  if (decoded.type !== "naddr") {
    throw new Error("Invalid naddr");
  }

  const { pubkey, identifier, relays } = decoded.data;

  // Use embedded relays OR fallback
  const queryRelays = relays?.length ? relays : DEFAULT_RELAYS;

  // ... rest of implementation using queryRelays
}
```

**Add fallback constant:**
```typescript
export const DEFAULT_RELAYS = ["wss://nos.lol", "wss://relay.damus.io"];
```

### Phase 6: Relay Handling

**Create `src/lib/relays.ts`:**
```typescript
export const DEFAULT_RELAYS = [
  "wss://nos.lol",           // primary
  "wss://relay.damus.io",    // fallback
];

export const LOOKUP_RELAYS = [
  "wss://purplepag.es",      // profile discovery
];
```

**Update `NostrContext.tsx`:**
- Use `DEFAULT_RELAYS` for publishing and fetching
- Keep `LOOKUP_RELAYS` for addressLoader (already there)

**Update publishing in Editor.tsx:**
```typescript
// Publish to multiple relays
await nostr.pool.publish(DEFAULT_RELAYS, signedEvent);
```

### Phase 7: Polish Pass

1. **Loading states**: Add spinners/skeletons during async operations
2. **Error messages**: User-friendly error display (not just console.error)
3. **Empty states**: "No hypernotes yet" message when user has no pages
4. **Responsive**: Ensure mobile-friendly layout
5. **Keyboard shortcuts**: Cmd+S to save/publish
6. **Confirmation**: "Are you sure?" before publishing over existing draft

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/components/Login.tsx` | **NEW** - Login component |
| `src/components/NostrContext.tsx` | Add auth state, login/logout |
| `src/components/Editor.tsx` | Gate behind login, filter user's pages |
| `src/components/Home.tsx` | Add login, "Copy to Drafts" button |
| `src/hooks/nostr.ts` | Fix usePage relay fallback |
| `src/lib/relays.ts` | **NEW** - Relay constants |

---

## Implementation Order

1. **Phase 5** - Fix `/hn/:id` first (quick win, unblocks testing)
2. **Phase 6** - Add relay constants
3. **Phase 1** - Auth system
4. **Phase 2** - Editor login gate
5. **Phase 3** - Page metadata tags
6. **Phase 4** - Home route + copy to drafts
7. **Phase 7** - Polish

---

## Key Decisions

**Minimal approach:**
- No `applesauce-accounts` - just store pubkey in localStorage
- No QR/Bunker login - extension + npub only
- No complex relay discovery - hardcode defaults + respect naddr relays
- No IndexedDB - rely on Nostr relays as source of truth

**Attribution for forks:**
- Add `forked-from` tag when copying someone else's page
- Original author's work gets credited

**Draft vs Published:**
- `status` tag: "draft" or "published"
- Drafts only visible to author
- Published visible to everyone
