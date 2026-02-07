# Component Registry Plan

## Goal
Add a component registry to hn-pages-v3 with minimal code. Two types:
1. **Built-in components**: Layout (`HStack`, `VStack`, etc.) and Nostr (`Note`, `Profile`)
2. **Imported components**: Referenced via naddr in frontmatter (pages only)

## Key Design Decisions

### Single-level imports
**Only pages can import remote components. Components cannot import other components.**

This prevents:
- Recursive import loops
- Deep loading waterfalls
- Unpredictable fetch chains

A page fetches its imports once. Those components render with the data they're given.

### All built-ins in one file
All built-in components defined in `src/lib/builtins.tsx` - one place for anyone implementing their own hypernote renderer to reference.

## Current State
- `NodeRenderer.tsx:181-263` has hardcoded `<Each>`, `<HStack>`, `<VStack>`, `<Text>`, `<Img>` in switch statements
- `Preview.tsx` uses `useNostrQuery` for data fetching
- Editor only handles pages (kind 32616, tag `hypernote-page`)

## Implementation

### 1. Built-ins File (`src/lib/builtins.tsx`)

Single file with ALL built-in components. Two categories:

**Layout components** (no data fetching):
- `HStack` - flex row
- `VStack` - flex col
- `Text` - span wrapper
- `Img` - image with attrs
- `Each` - iteration

**Nostr components** (fetch their own data):
- `Note` - renders event by id, fetches kind 1
- `Profile` - renders profile by pubkey, fetches kind 0

```tsx
// src/lib/builtins.tsx
// THE reference for hypernote built-in components

export const layoutComponents = {
  HStack: ({ children }) => <div className="flex flex-row gap-2">{children}</div>,
  VStack: ({ children }) => <div className="flex flex-col gap-2">{children}</div>,
  Text: ({ children }) => <span>{children}</span>,
  Img: ({ src, alt, width }) => <img src={src} alt={alt} width={width} />,
};

export function Note({ id }: { id: string }) {
  const event = useNostrQuery({ type: "event", id });
  if (!event) return <div>Loading...</div>;
  return <div>{event.content}</div>;
}

export function Profile({ pubkey }: { pubkey: string }) {
  const profile = useNostrQuery({ type: "profile", pubkey });
  if (!profile) return <div>Loading...</div>;
  return <div>{profile.name || profile.display_name || "Anon"}</div>;
}

// Each is special - needs children + scope, stays in NodeRenderer
```

### 2. NodeRenderer Changes

Refactor `renderJsxElement`:

1. Move layout components out of switch into `builtins.layoutComponents`
2. Check `builtins.Note` / `builtins.Profile` for nostr components
3. Check `scope.components` for imported components (from page frontmatter)
4. Keep `Each` inline (needs special scope handling)

### 3. Frontmatter Imports (Pages Only)

```yaml
---
title: My Page
imports:
  TestComponent: naddr1...
---
```

### 4. Component Loading (`src/hooks/useComponent.ts`)

```ts
export function useComponent(naddr: string) {
  const event = usePage(naddr); // reuse existing hook
  if (!event) return undefined;
  return JSON.parse(event.content); // returns AST
}
```

### 5. Preview Changes

1. Parse `imports` from frontmatter
2. For each import, call `useComponent(naddr)`
3. Pass loaded components to scope as `{ components: { TestComponent: ast } }`

### 6. Imported Component Rendering

When NodeRenderer hits an unknown component name:
1. Check `scope.components[name]`
2. If found, render via `<NodeRenderer node={componentAst} scope={{...scope, props: attrs}} />`

### 7. Editor Changes

**File types**:
- Pages: tag `hypernote-page`
- Components: tag `hypernote-component`

**FileBrowser**: Two sections, filtered by tag

**Buttons**: "New Page" / "New Component"

**Publish**: Toggle sets the appropriate tag

Default component template:
```markdown
---
name: MyComponent
---

{props.message}
```

## File Changes Summary

| File | Change |
|------|--------|
| `src/lib/builtins.tsx` | NEW - All built-in components in one place |
| `src/components/NodeRenderer.tsx` | Refactor to use builtins, add imported component lookup |
| `src/hooks/useComponent.ts` | NEW - Simple hook wrapping usePage |
| `src/hooks/nostr.ts` | Add `useComponents` hook (filter by tag) |
| `src/components/Preview.tsx` | Load imports from frontmatter, pass to scope |
| `src/components/Editor.tsx` | Two sections, new buttons, page/component toggle |

## Order of Implementation

1. Create `builtins.tsx` with layout + nostr components
2. Refactor NodeRenderer to use builtins
3. Test built-ins work (especially Note/Profile fetching)
4. Add `useComponent` hook
5. Update Preview to load imports
6. Add imported component rendering to NodeRenderer
7. Test: create component in editor, publish, import into page
8. Editor UI changes (sections, buttons, toggle)

## What a Hypernote Implementer Needs

Anyone building a hypernote renderer needs to implement:

1. **Markdown nodes**: heading, paragraph, text, list, link, image, code, etc.
2. **Layout components**: HStack, VStack, Text, Img
3. **Control flow**: Each (iteration with scope)
4. **Nostr components**: Note, Profile (with data fetching)
5. **Import resolution**: Fetch naddr, parse AST, render with props
