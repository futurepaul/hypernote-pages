# Editor State Management Plan

## Current Problems

1. **Lost work on switch**: Clicking a different hypernote discards all unsaved changes
2. **New notes are ephemeral**: No way to save a new hypernote without publishing
3. **No dirty indicator**: Users can't tell if they have unsaved changes
4. **Duplicate sidebar entries**: After publishing, the same note appears twice
5. **No "publish as draft" for new notes**: Only existing notes can be unpublished to draft

## Proposed State Machine

### Document States

```
┌─────────┐     edit      ┌─────────┐    publish    ┌─────────┐
│   NEW   │──────────────▶│  LOCAL  │──────────────▶│ SYNCED  │
└─────────┘               └─────────┘               └─────────┘
                               ▲                         │
                               │                         │ edit
                               │        publish          ▼
                               └─────────────────────┌─────────┐
                                                     │MODIFIED │
                                                     └─────────┘
```

| State | Description | localStorage | Nostr |
|-------|-------------|--------------|-------|
| `new` | Fresh document, default template loaded | No | No |
| `local` | Has edits, saved locally, never published | Yes | No |
| `synced` | Published to Nostr, no local changes | No (or cached) | Yes |
| `modified` | Published to Nostr, has unpublished local changes | Yes | Yes (stale) |

### State Transitions

| From | To | Trigger |
|------|-----|---------|
| `new` | `local` | Any edit to the document |
| `local` | `synced` | Publish (as draft or published) |
| `synced` | `modified` | Any edit to the document |
| `modified` | `synced` | Publish changes |
| Any | (switch) | Select different document (auto-saves current to localStorage) |

## localStorage Schema

```typescript
interface LocalDraft {
  id: string;              // Unique local ID (crypto.randomUUID() for new, event.id for existing)
  docType: "page" | "component";
  source: string;          // The MDX source
  lastModified: number;    // Unix timestamp
  nostrEventId?: string;   // If this is a modification of a published note
  nostrIdentifier?: string; // The 'd' tag value if published
}

// Key format: `hypernote:draft:${id}`
// Index key: `hypernote:drafts` -> string[] of draft IDs
```

## UI Changes

### Sidebar Indicators

```
Pages
  ● My Published Page        (green dot = synced)
  ◐ My Edited Page *         (half dot = modified, * = unsaved)
  ○ My Local Draft *         (empty dot = local only)

Components
  ● Header                   (synced)
```

Or simpler approach with just `*`:
```
Pages
  🌐 My Published Page
  🌐 My Edited Page *        (* = has local changes)
  📝 My Local Draft          (different icon = never published)
```

### New Buttons/Actions

1. **"Save Draft" button** (replaces or supplements current Publish)
   - For `new`/`local`: Publishes to Nostr with `status: draft`
   - For `modified`: Publishes changes to Nostr (keeps current status)

2. **"Publish" button** behavior change:
   - Always publishes with `status: published`

3. **Auto-save to localStorage**:
   - Debounced (e.g., 1 second after last keystroke)
   - Or on blur/switch

### Deduplication Logic

The sidebar currently shows Nostr events directly. With local drafts, we need to merge:

```typescript
function getMergedDocuments(nostrEvents: NostrEvent[], localDrafts: LocalDraft[]) {
  const merged = new Map<string, MergedDocument>();

  // Add all Nostr events
  for (const event of nostrEvents) {
    const id = event.id;
    merged.set(id, {
      nostrEvent: event,
      localDraft: null,
      state: 'synced'
    });
  }

  // Overlay local drafts
  for (const draft of localDrafts) {
    if (draft.nostrEventId && merged.has(draft.nostrEventId)) {
      // This is a modification of an existing note
      const existing = merged.get(draft.nostrEventId)!;
      existing.localDraft = draft;
      existing.state = 'modified';
    } else if (!draft.nostrEventId) {
      // This is a purely local draft
      merged.set(draft.id, {
        nostrEvent: null,
        localDraft: draft,
        state: 'local'
      });
    }
  }

  return merged;
}
```

## Implementation Options

### Option A: Minimal - Just prevent data loss

**Scope**: Auto-save to localStorage, show `*` indicator, confirm before switching if dirty

**Pros**:
- Smallest change
- Lower risk of bugs
- Quick to implement

**Cons**:
- Local-only drafts still not shown in sidebar
- Still need to publish to "save" properly

### Option B: Full local drafts system

**Scope**: Complete state machine, local drafts in sidebar, Save Draft button, merge logic

**Pros**:
- Best UX
- Users can work offline-first
- Clear mental model

**Cons**:
- More complex
- Need to handle edge cases (what if Nostr event updates from another client?)
- More UI work

### Option C: Hybrid - Auto-save + draft publishing

**Scope**: Auto-save to localStorage for crash protection, but also add "Save as Draft" button that publishes to Nostr immediately with draft status

**Pros**:
- Nostr is source of truth (simpler)
- Still prevents data loss via localStorage backup
- Drafts visible across devices

**Cons**:
- Requires network to "save" a draft
- More Nostr events

## Recommendation

**Start with Option A**, then iterate to Option B if needed.

### Phase 1: Prevent data loss (Option A)
1. Add `useLocalDraft` hook that auto-saves current document to localStorage
2. Add dirty state tracking (compare current source to last saved/published)
3. Show `*` indicator on dirty documents
4. On switch: save current to localStorage, load new (check localStorage first, then Nostr)
5. On load: check if localStorage has newer version than Nostr event

### Phase 2: Local drafts in sidebar (Option B additions)
1. Add "New Draft" entries to sidebar
2. Implement merge logic
3. Add explicit "Save Draft" vs "Publish" buttons

## Questions to Resolve

1. **Conflict resolution**: What if user edits on two devices? Last-write-wins? Show conflict?
2. **Draft cleanup**: When should localStorage drafts be deleted? After publish? Manual delete?
3. **New document identity**: How do we identify a "new" document before it has a title/slug?
4. **Switching behavior**: Auto-save silently, or confirm dialog?

## Proposed File Structure

```
src/
  hooks/
    useEditorState.ts      # Main state machine hook
    useLocalDrafts.ts      # localStorage operations
  lib/
    editorState.ts         # Types and pure functions
  components/
    Editor.tsx             # Refactored to use new hooks
    DraftIndicator.tsx     # The * or status icon
```
