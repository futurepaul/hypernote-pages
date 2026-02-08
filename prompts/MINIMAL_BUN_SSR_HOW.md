# Minimal SSR for Bun HTML Routes: Problem Report

## Goal

We have a Bun fullstack app that serves a React SPA via Bun's HTML import system:

```ts
import index from "./index.html";

Bun.serve({
  routes: {
    "/*": index,  // Bun bundles, transpiles, and serves this automatically
  },
});
```

This works great for browser users. Bun handles bundling `frontend.tsx`, transpiling JSX, hashing assets, injecting HMR in dev mode — the whole pipeline.

The problem is that when a bot, crawler, or link preview tool (Slack, Discord, Twitter, etc.) visits `/hn/naddr1...`, they see an empty `<div id="root"></div>` because all content is fetched from Nostr relays and rendered client-side.

We want to add a **minimal SSR layer** for just this one route pattern (`/hn/:id`). The requirements are:

1. **OG meta tags** — Inject `<title>`, `og:title`, `og:description` from the page's frontmatter so link previews show meaningful content
2. **Static HTML in `<div id="root">`** — Pre-render the page layout (headings, text, images, layout components) so crawlers see real content
3. **Client-side React still works** — Browser visitors should still get the full interactive React app. The SSR HTML is just a starting point that React takes over.

We do NOT need full data SSR. Dynamic components like `<Note>` and `<Profile>` (which fetch from Nostr relays) can render their loading states. We just want the static structure.

## What We Built

We got #1 and #2 working using React's `renderToString()`:

- **`src/ssr/fetchPage.ts`** — Fetches the Nostr event (kind 32616) for a given `naddr`, with an in-memory cache (5 min TTL)
- **`src/ssr/renderPage.tsx`** — Uses `renderToString()` with the real `NodeRenderer` and builtin components (`VStack`, `HStack`, `Text`, `Img`, etc.), wrapped in minimal SSR-safe context providers. Dynamic components naturally render their "Loading..." fallbacks.
- **`src/index.ts`** — A `/hn/:id` route handler that fetches the event, runs React SSR, and injects the result (meta tags + rendered HTML) into `index.html`

This all works. `curl`ing the route returns proper meta tags and fully rendered static HTML.

## The Problem: Requirement #3

The `/hn/:id` route handler needs to return HTML that includes the bundled client-side JavaScript so the React app boots in the browser. This is where we're stuck.

### How Bun's HTML imports work

When you write `import index from "./index.html"`, Bun creates an `HTMLBundle` object. When that object is used as a route handler, Bun does a lot of work behind the scenes:

- Finds `<script>` and `<link>` tags in the HTML
- Transpiles and bundles the referenced files (TSX, CSS, etc.)
- Rewrites the HTML to reference hashed output files (`/_bun/client/index-abc123.js`, `/_bun/asset/def456.css`)
- Serves those hashed asset files automatically
- In dev mode, injects HMR (hot module reloading) scripts

So the raw `index.html` on disk says:
```html
<script type="module" src="./frontend.tsx"></script>
```

But what Bun actually sends to the browser is something like:
```html
<link rel="stylesheet" href="/_bun/asset/068fdf28a779c15d.css">
<script type="module" crossorigin src="/_bun/client/index-000000000fe31f3a.js" data-bun-dev-server-script></script>
```

### The gap

Our SSR route handler reads `index.html` from disk (the raw source file), modifies it, and returns it. This means:

- The `<script type="module" src="./frontend.tsx">` tag is still in the response
- The browser requests `/frontend.tsx`, which hits the `/*` catchall and returns... the full HTML page (not the transpiled JS)
- The React app never loads

We need a way to either:
- Get the **bundled** HTML (with the rewritten asset URLs) as a string we can modify
- Or make the SSR route participate in Bun's bundling pipeline somehow

## What We've Considered

### Read the bundled HTML via internal fetch
Call `server.fetch(new Request("http://localhost/"))` to get the bundled HTML response from the `/*` route, read it as text, then do our string modifications on that. Unknown if this works or has gotchas.

### Bun's `HTMLRewriter`
Bun has a Cloudflare-style `HTMLRewriter` API that can transform HTML using CSS selectors. If we could get a `Response` from the `HTMLBundle`, we could use `HTMLRewriter` to inject meta tags and SSR content cleanly. But we'd still need a way to get that Response first.

### Pre-build the HTML
Run `bun build` ahead of time to produce bundled output files, then read the built HTML as our template. This would work but adds a build step and loses dev mode HMR for this route.

### Bun's planned SSR support
The Bun docs (as of our version) list "Built-in SSR support" as a planned feature for HTML import routes. There may be newer APIs or patterns that solve this.

### Route-level configuration
Bun routes might support some kind of handler that wraps or modifies the HTMLBundle response. The `fetch` fallback handler, middleware, or some route config we haven't found yet.

## Current State

The SSR code is complete and tested. Crawlers and bots get exactly what we want. The only missing piece is making browser visitors on `/hn/:id` also get the bundled client JS so React can hydrate.

Until this is solved, the `/hn/:id` SSR route serves static HTML that works for crawlers but doesn't boot the React app for browser users. The `/*` catchall still works normally for all other routes.
