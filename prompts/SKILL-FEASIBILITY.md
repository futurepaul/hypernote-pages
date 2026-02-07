# Hypernote SKILL.md - Feasibility Report

## What We're Building

A document + tooling that enables any LLM to author hypernote pages (`.hnmd` files) with a reliable write-validate-preview feedback loop.

## 1. Documentation (SKILL.md)

**Feasibility: High - straightforward extraction from existing code**

The documentation can be built accurately from the codebase. Here's what I'd include, ranked by confidence:

### Safe to document (directly from source of truth)
- **Markdown syntax** - headings, bold, italic, links, images, lists, code blocks, blockquotes, hr (from `NodeRenderer.tsx`)
- **Built-in components** - `VStack`, `HStack`, `ZStack`, `Text`, `Img` with exact prop types (from `builtins.tsx` + `styles.ts`)
- **Style system** - Every enumerated value is defined as TypeScript types with explicit value maps. Colors, spacing, sizes, rounding, etc. Zero ambiguity.
- **Expression syntax** - `{variable}`, pipe filters (`| truncate(10)`), default operator (`// 'fallback'`), scope paths (`queries.profile.name`)
- **Frontmatter properties** - `title`, `bg`, `bgMode`, `color`, `padding`, `overflow` (from `Preview.tsx` / `IframeViewer.tsx`)

### Document cautiously (Nostr-dependent, won't work in local-only mode)
- `Note`, `Profile` components (need relay connectivity)
- `Input`, `Textarea`, `Button` (need form/action system with Nostr signing)
- `<Each>` loops with `filter` frontmatter (need relay data)
- `imports` frontmatter (loads component ASTs from Nostr events)

### Don't document (internal/unstable)
- AST node type internals
- `useScope()` / `usePageContext()` hook details
- Editor-specific features (PropertiesPanel, cursor tracking)

**Recommendation:** The SKILL.md should focus on "static" hypernotes first - layout, styling, markdown content, expressions with literal data. Nostr-interactive features (forms, queries, live data) would be a "Level 2" section. This avoids the LLM trying to use features that won't work without relay connectivity.

## 2. Examples

User will provide a folder of valid `.hnmd` examples. From these we can:
- Extract patterns that actually work (vs. theoretical capabilities)
- Build the documentation bottom-up
- Include 3-5 representative examples in the SKILL.md itself

**What's needed:** The folder of valid `.hnmd` examples. The more variety the better - simple pages, styled layouts, pages with expressions, pages with Nostr data.

## 3. The Feedback Loop (the hard part)

Three architectures, from simplest to most ambitious:

### Architecture A: "Add a local route" (Recommended for now)

**What:** Add a `/local/:filename` client-side route to the existing app + a `scripts/check.ts` CLI validator.

**How it works:**
1. LLM clones hn-pages-v3, runs `bun dev`
2. LLM writes `.hnmd` file to `local/` directory
3. **CLI validation:** `bun scripts/check.ts local/mypage.hnmd` - parses with zig-mdx, reports syntax errors, validates frontmatter properties, checks component names against builtin registry
4. **Visual preview:** Browser navigates to `localhost:3423/local/mypage.hnmd` - the app reads the file from disk, parses it, and renders it with the full component system
5. **Optional screenshot:** If the LLM has a browser tool, it screenshots that URL

**Implementation needed:**
- `scripts/check.ts` (~50 lines) - CLI script using zig-mdx's `parse()` directly from Bun. Reports errors from `ast.errors`, validates frontmatter YAML, checks component names
- A server-side route in `index.ts` that reads `.hnmd` files from `local/` and returns the parsed AST as JSON
- A client-side `/local/:filename` route that fetches from that API and renders via `NodeRenderer`

**Effort:** ~2-3 hours. Small surface area, fully working.

**Tradeoffs:**
- (+) Full rendering fidelity (same code path as production)
- (+) Quick to implement
- (+) CLI validator works instantly, no browser needed
- (-) Requires cloning the full repo (editor, Nostr deps, etc.)
- (-) LLM needs to run a dev server

### Architecture B: "Standalone hypernote-render package"

**What:** Extract the rendering pipeline into a minimal npm package.

```
hypernote-render/
  ├── src/
  │   ├── parse.ts      (zig-mdx wrapper)
  │   ├── validate.ts   (frontmatter + component validation)
  │   ├── render.ts     (NodeRenderer, builtins, styles)
  │   └── serve.ts      (minimal Bun.serve for preview)
  ├── bin/
  │   └── hypernote.ts  (CLI: check, serve, screenshot)
  └── package.json
```

**Usage:**
```bash
bunx hypernote-render check mypage.hnmd     # syntax + validation
bunx hypernote-render serve mypage.hnmd     # preview server
bunx hypernote-render screenshot mypage.hnmd # capture PNG
```

**Implementation needed:**
- Extract `styles.ts`, `evaluator.ts`, `builtins.tsx` (layout components only), `NodeRenderer.tsx` into standalone package
- Strip Nostr dependencies from builtins (Note/Profile become placeholder stubs)
- Minimal `Bun.serve()` that renders a single page
- CLI entry point

**Effort:** ~1-2 days. Significant but clean.

**Tradeoffs:**
- (+) Clean, minimal dependency
- (+) Reusable beyond this skill (embed hypernote rendering anywhere)
- (+) LLM just needs `bun add hypernote-render`
- (-) Two codebases to maintain (or need to refactor hn-pages-v3 to consume this package)
- (-) Nostr components won't work (stubs only)
- (-) The extraction work requires careful testing to ensure parity

### Architecture C: Hybrid (Best long-term, pragmatic short-term)

**What:** Start with Architecture A now, design it so the `/local` route and `check.ts` script become the seed of Architecture B later.

**Phase 1 (now):** Architecture A - add local route + CLI validator to hn-pages-v3
**Phase 2 (later):** Extract the core into `hypernote-render` package, have hn-pages-v3 depend on it

**The key insight:** The files that need extraction are already cleanly separated:
- `src/lib/styles.ts` - zero external deps
- `src/lib/evaluator.ts` - zero external deps
- `src/lib/builtins.tsx` - depends on Nostr hooks (but layout components don't)
- `src/components/NodeRenderer.tsx` - depends on evaluator + builtins

The separation is architecturally clean. The main coupling is `builtins.tsx` importing Nostr hooks for `Note`, `Profile`, `Input`, `Textarea`, `Button`.

## 4. Screenshot / Browser Tool

Two approaches that can coexist:

**Approach 1: Implicit dependency (simpler)**
The SKILL.md says "if you have access to a browser/screenshot tool, navigate to `localhost:3423/local/yourfile.hnmd` to see the result." Claude Code users with an MCP browser tool get this for free.

**Approach 2: Built-in Playwright script (self-contained)**
A `scripts/screenshot.ts` that uses Playwright to capture the page:
```bash
bun scripts/screenshot.ts local/mypage.hnmd --output screenshot.png
```
~30 lines of code. The LLM reads the PNG to evaluate its output. Downside: Playwright is a big dependency (~100MB).

**Recommendation:** Start with Approach 1 (document the URL pattern), add Approach 2 only if LLMs consistently struggle without built-in screenshots.

## 5. SKILL.md Structure (Proposed Outline)

```
# Hypernote Page Authoring

## Quick Start
- Minimal valid example
- How to validate: `bun scripts/check.ts <file>`
- How to preview: `localhost:3423/local/<file>`

## Syntax Reference
### Frontmatter
### Markdown
### Built-in Components
  - Layout: VStack, HStack, ZStack (with all props)
  - Content: Text, Img
  - Special: Each (looping)
### Style System
  - Spacing scale
  - Color palette (with all color names + shades)
  - Size, rounding, border, opacity values
### Expressions
  - Variable access
  - Pipe filters
  - Default operator

## Examples (3-5 complete pages)

## Common Mistakes
- Using arbitrary CSS values (only enumerated values work)
- Forgetting quotes around numeric prop values
- Using components that don't exist
```

## 6. Summary / Recommendation

| Approach | Effort | Quality | Future-proof |
|----------|--------|---------|--------------|
| A: Local route | ~3 hours | Good (full fidelity) | Medium |
| B: Standalone pkg | ~2 days | Good (clean) | High |
| C: Hybrid (A now, B later) | ~3 hours now | Good | High |

**Recommendation: Architecture C.** Start with A, keep B in mind. The SKILL.md documentation is straightforward and high-confidence because the style system is entirely enumerated (no guesswork).

**Open question:** How important is it that the LLM can work with Nostr-interactive features (forms, live data) vs. just static layout pages?
