# SSR for /hn/ Routes: How Hard?

## The Problem

When a bot, crawler, or tool like `WebFetch` visits `https://www.hypernote.club/hn/naddr1qq...`, all it sees is "Hypernote Pages" — an empty HTML shell. The actual page content lives on Nostr relays and is fetched + rendered entirely client-side.

This means: no link previews, no SEO, no OpenGraph cards, no AI tool access.

## Current Architecture (100% Client-Side)

```
GET /hn/naddr1qq...
    │
    ├── Server: returns index.html (same for every route)
    │
    └── Browser:
        1. Load React app
        2. Wouter matches /hn/:id route
        3. Decode naddr → { kind: 32616, pubkey, identifier }
        4. Connect to relays via applesauce RelayPool
        5. Fetch event via eventStore.addressable() (RxJS observable)
        6. Parse AST from event.content (JSON)
        7. Extract frontmatter (YAML) → canvas styles, queries, form defs
        8. usePageContext() fetches any additional Nostr data (profiles, events, timelines)
        9. NodeRenderer recursively renders MDX AST → React → DOM
```

The server (`src/index.ts`) is 28 lines. It serves `index.html` for `/*` and that's it.

## What SSR Would Need To Do

Intercept `/hn/:naddr` on the server and:

1. **Decode the naddr** — trivial, `nostr-tools` is pure JS
2. **Fetch the page event from relays** — moderate difficulty
3. **Parse the AST** — trivial, it's just `JSON.parse(event.content)`
4. **Render the AST to HTML** — this is where it gets interesting

## Difficulty Breakdown by Component

### Easy (works as-is on the server)

| What | Why |
|------|-----|
| naddr decoding | `nostr-tools/nip19` is pure JS |
| AST parsing | `JSON.parse()` |
| Frontmatter extraction | `yaml` package, pure JS |
| Style resolution | `resolveContainerStyles()`, `resolveTextStyles()`, etc. are pure functions mapping props → CSSProperties |
| Layout components | `VStack`, `HStack`, `ZStack`, `Text`, `Img` are just `<div style={...}>` wrappers |
| Canvas background/color | Pure style computation from frontmatter |

### Medium (needs new code, but straightforward)

| What | Challenge |
|------|-----------|
| Fetching the page event from relays | Currently uses `eventStore.addressable()` → RxJS observable → `use$()` React hook. For SSR, need a promise-based fetch: open WebSocket to relay, send REQ filter `{kinds:[32616], authors:[pubkey], #d:[identifier]}`, collect the event, close. Could use `applesauce-relay`'s RelayPool directly with `firstValueFrom()` from RxJS to convert observable → promise. Need a timeout (2-3s). |
| `renderToString()` | Need to wrap the component tree in a minimal context (NostrProvider with `disableCache: true`, dummy scope). React 19's `renderToString` works fine in Bun. |

### Hard (requires architectural decisions)

| What | Challenge |
|------|-----------|
| `<Note>` and `<Profile>` components | These call `useNostrQuery()` internally — they fetch their own data from relays via hooks. Can't easily pre-fetch because we don't know which ones exist until we walk the AST. **Options:** (a) render them as loading placeholders server-side, (b) walk the AST first to collect all Note/Profile references, batch-fetch, then render with pre-populated store. |
| Frontmatter queries | `usePageContext` reads frontmatter and fires off additional Nostr queries (profile lookups, event fetches, timelines). The rendered page may depend on this data (e.g., `{queries.profile.name}`). **Options:** (a) skip expression evaluation server-side, (b) pre-fetch query data and build a static scope. |
| `<Each>` loops over query data | If a page does `<Each from={queries.events} as="event">`, the loop body can't render without the data. |
| Form components | `<Input>`, `<Textarea>`, `<Button>` use `useScope()` for form state. Server-side they'd be inert HTML — that's fine, but hydration needs to wire them up. |
| Imported components | `useComponents()` fetches other hypernote events referenced in frontmatter `imports`. Another async relay fetch. |

## Proposed Approach: "Good Enough" SSR

Rather than full isomorphic SSR with hydration, I'd suggest a simpler approach that solves the actual problem (link previews + crawlability):

### Strategy: Server-side HTML snapshot + meta tags

```
GET /hn/naddr1qq...

Server:
  1. Decode naddr
  2. Fetch kind 32616 event from relays (2s timeout)
  3. If found:
     a. Parse AST, extract frontmatter
     b. Generate <meta> tags (title, og:title, og:description, og:image)
     c. Render the static parts of the AST to HTML (layout, text, images)
     d. For dynamic components (Note, Profile, Each), render placeholders
     e. Inject rendered HTML into the page template
     f. Include the full client-side app for hydration
  4. If not found / timeout:
     a. Return normal SPA shell (current behavior)
```

This gets you:
- OpenGraph cards with title + description (from frontmatter)
- Crawlable text content (headings, paragraphs, links)
- Visible layout structure for tools like WebFetch
- No hydration mismatch headaches for dynamic content

### What it doesn't get you:
- Pre-rendered Nostr data (notes, profiles, timelines)
- Working forms before JS loads
- Expression evaluation (`{queries.profile.name}`)

## Implementation Estimate

### Phase 1: Meta tags only (Small, ~1 day)

Add an `/hn/:naddr` route handler that:
- Decodes the naddr
- Fetches the event
- Extracts title from frontmatter
- Returns the same `index.html` but with `<title>`, `og:title`, `og:description`, `og:image` injected

This alone solves the link preview problem. ~100 lines of new code.

```ts
// Rough sketch for src/index.ts
import { nip19 } from "nostr-tools";

async function fetchPageEvent(pubkey: string, identifier: string): Promise<NostrEvent | null> {
  // Use nostr-tools SimplePool or raw WebSocket
  // REQ {kinds:[32616], authors:[pubkey], #d:[identifier]}
  // Race against 2s timeout
}

function injectMetaTags(html: string, title: string, description?: string): string {
  return html.replace('</head>',
    `<meta property="og:title" content="${title}">
     <meta property="og:description" content="${description ?? ''}">
     </head>`
  );
}
```

### Phase 2: Static HTML rendering (~3-5 days)

Add `renderToString` for the AST:
- Create a server-safe `NodeRenderer` (or reuse existing with a null scope)
- Render layout components (VStack, HStack, Text, Img, headings, paragraphs)
- Skip/placeholder dynamic components
- Inject into HTML template before the React root

Key files to create/modify:
- `src/ssr/fetchEvent.ts` — promise-based relay fetch
- `src/ssr/renderPage.ts` — AST → HTML string (reuses style functions from hypernote-render)
- `src/index.ts` — add route handler

### Phase 3: Full SSR with data (~1-2 weeks)

Pre-fetch all Nostr data referenced by the page:
- Walk AST to find Note/Profile components and their IDs
- Parse frontmatter for query definitions
- Batch fetch everything with timeouts
- Build a pre-populated EventStore
- `renderToString` the full React tree with real data
- Hydrate on client

This is significantly more complex and may not be worth it unless you need full SEO for page content (not just metadata).

## Key Technical Details

### Relay Fetching on Server

The `applesauce-relay` RelayPool uses WebSocket internally. Bun has native WebSocket support, so this works. The tricky part is converting from the RxJS observable pattern to a promise:

```ts
import { RelayPool } from "applesauce-relay";
import { firstValueFrom, timeout } from "rxjs";

const pool = new RelayPool();

async function fetchAddressable(pubkey: string, identifier: string) {
  const store = new EventStore();
  createEventLoaderForStore(store, pool, { lookupRelays: LOOKUP_RELAYS });

  const event = await firstValueFrom(
    store.addressable({ kind: 32616, pubkey, identifier }).pipe(
      timeout(3000),
    )
  ).catch(() => null);

  return event;
}
```

Alternatively, skip applesauce entirely for server-side fetches and use `nostr-tools`' SimplePool for a more straightforward promise-based API.

### Style System Portability

Good news: the style system (`styles.ts`) is 100% portable. `resolveContainerStyles`, `resolveTextStyles`, `resolveImgStyles` are pure functions that return `React.CSSProperties` objects. They use no browser APIs.

### React `renderToString` in Bun

Works fine. `react-dom/server` exports `renderToString` and it runs in any JS runtime. The constraint is that hooks like `useState`, `useEffect`, `useContext` behave differently (effects don't run, state is initial values only).

## Verdict

| Approach | Effort | Value |
|----------|--------|-------|
| Phase 1: Meta tags only | Small (~1 day) | Solves link previews, OG cards |
| Phase 2: Static layout SSR | Medium (~3-5 days) | WebFetch/crawlers see real content |
| Phase 3: Full data SSR | Large (~1-2 weeks) | Complete server rendering |

**Recommendation:** Start with Phase 1. It's the 80/20 — most of the value (link previews, social cards) for minimal effort. Phase 2 if you want bots to see actual page content. Phase 3 only if SEO of page body content becomes important.

The architecture is actually pretty friendly to SSR because:
- The style system is pure functions
- The AST is just JSON data
- Layout components are simple div wrappers
- `nostr-tools` works server-side
- Bun has native WebSocket for relay connections
- The NostrProvider already has a `disableCache` prop

The main friction is the RxJS observable → promise conversion for relay fetches, and deciding what to do about components that fetch their own data.
