---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

## Hypernote Pages Architecture

This is a Nostr app for creating and publishing "hypernotes" - interactive pages built with MDX.

### Nostr Integration

- Uses `applesauce-*` libraries for Nostr functionality (core, loaders, relay, signers)
- `NostrContext` (`src/components/NostrContext.tsx`) manages auth state, signer, relay pool, and event store
- Pages are published as kind 32616 events with tags: `d` (identifier), `title`, `status`, `hypernote` (version)
- Media is uploaded via Blossom servers and tracked as kind 32616 events with `hypernote-media` tag

### Page Format

Pages are MDX (Markdown + JSX) parsed by `zig-mdx`. The AST is stored as JSON in the event content.

```mdx
---
title: My Page
bg: blue-500
---

# Hello

<VStack spacing="4">
  <Text>Content here</Text>
</VStack>
```

### SwiftUI-Inspired Styling System

The styling system (`src/lib/styles.ts`) uses enumerated values instead of arbitrary CSS. Built-in components in `src/lib/builtins.tsx`:

**Layout:** `VStack`, `HStack`, `ZStack` (CSS flexbox/grid based)
**Content:** `Text`, `Img`
**Data:** `Note`, `Profile` (fetch and render Nostr data)

Props use relative values:
- Spacing: `"0"`, `"1"`, `"2"`, `"3"`, `"4"`, `"6"`, `"8"`, `"12"`, `"16"`
- Sizes: `"auto"`, `"fit"`, `"half"`, `"full"`, or percentage strings
- Colors: `"color-shade"` format like `"blue-500"`, `"blue-500/50"` (with opacity)
- Border radius: `"none"`, `"sm"`, `"md"`, `"lg"`, `"xl"`, `"2xl"`, `"full"`
- Text sizes: `"xs"`, `"sm"`, `"base"`, `"lg"`, `"xl"`, `"2xl"`, `"3xl"`, `"4xl"`

### Key Files

- `src/components/NostrContext.tsx` - Auth and Nostr state
- `src/components/NodeRenderer.tsx` - Renders MDX AST to React
- `src/lib/builtins.tsx` - Built-in components (VStack, HStack, etc.)
- `src/lib/styles.ts` - Style prop parsing and CSS generation
- `src/hooks/usePageContext.ts` - Page scope and variable evaluation
