# Hypernote Page Authoring

You are creating a Hypernote page — a rich, interactive document written in a custom MDX format (.hnmd). Hypernotes combine Markdown with a SwiftUI-inspired component system for layout and styling. Hypernotes are published to [Nostr](https://nostr.com/), a decentralized social protocol.

## Prerequisites: Get on Nostr

Before you can publish, you need a Nostr identity. Use [blup](https://github.com/futurepaul/blup) to create one:

```bash
bun install -g @futurepaul/blup

# Create your identity (generates keypair, publishes relay list)
blup create

# Set up your profile (local files are auto-uploaded to Blossom)
blup profile --name "My Bot" --about "I make hypernote pages" --picture ./avatar.png
```

That's it — you now have a Nostr identity with a profile, a Blossom server for file uploads, and relay list so clients can discover you.

## Quick Start

A minimal valid hypernote:

```hnmd
---
title: Hello World
---

# Hello World

This is a hypernote page.
```

### Install the CLI

```bash
bun install -g @futurepaul/hypernote
```

### Validate your work

```bash
hypernote check <your-file.hnmd>
```

This will report parse errors, frontmatter issues, and unknown components.

### Publish to Nostr

```bash
hypernote publish <your-file.hnmd>
```

Parses the .hnmd file, signs it with your blup keychain keys, and publishes it as a kind 32616 event to Nostr relays. Returns an `naddr` you can share. Use `--draft` to publish as a draft instead.

### Preview in browser

```bash
hypernote serve <your-file.hnmd>
```

Opens a preview server at `http://localhost:3456` with hot reload. If you have a browser/screenshot tool, navigate to that URL to see your rendered page.

### Take a screenshot

```bash
hypernote screenshot <your-file.hnmd>
```

Captures a full-page PNG screenshot of the rendered page (saved alongside the .hnmd file by default). Use `--output path.png` to specify a different output path. Requires playwright (`bun install -g playwright && bunx playwright install chromium`).

### Upload images

If your page uses images, upload them with blup first:

```bash
blup upload ./my-image.png
```

This prints the URL. Use it in your .hnmd file:

```hnmd
<Img src="https://blossom.band/abc123.png" width="full" rounded="lg" />
```

## File Format

Hypernote files have two sections:

1. **Frontmatter** (YAML between `---` delimiters) — metadata and configuration
2. **Body** (MDX) — content using Markdown + JSX components

## Frontmatter Reference

```yaml
---
# Required: page title
title: My Page

# Canvas styling
bg: blue-500              # Background color (see Color Values below)
bg: https://example.com/img.jpg  # Or image/video URL
bgMode: cover             # cover (default), tile, contain
color: white              # Default text color
padding: "4"              # Canvas padding (see Spacing Values)
overflow: auto            # auto (default), hidden, scroll, visible
---
```

### Frontmatter keys

| Key | Type | Description |
|-----|------|-------------|
| `title` | string | Page title (required for pages) |
| `name` | string | Component name (required for reusable components) |
| `bg` | string | Background: color value OR image/video URL |
| `bgMode` | `cover` \| `tile` \| `contain` | How background images are displayed |
| `color` | string | Default text color for the page |
| `padding` | spacing value | Canvas padding (default: `"4"`) |
| `overflow` | `auto` \| `hidden` \| `scroll` \| `visible` | Canvas overflow behavior |

## Markdown Syntax

Standard Markdown is fully supported:

```hnmd
# Heading 1
## Heading 2
### Heading 3

Regular paragraph text.

**bold text** and *italic text*

[link text](https://example.com)

![alt text](https://example.com/image.png)

- Unordered list item
- Another item

1. Ordered list item
2. Another item

> Blockquote

`inline code`

---
```

Code blocks with triple backticks also work.

## Built-in Components

Components use JSX syntax inside your Markdown. Component names are **case-insensitive** (`<vstack>` and `<VStack>` both work).

### Layout: VStack

Vertical stack — children are arranged top to bottom.

```hnmd
<VStack gap="4" padding="2" bg="blue-50" rounded="md">
  <Text>First item</Text>
  <Text>Second item</Text>
</VStack>
```

### Layout: HStack

Horizontal stack — children are arranged left to right.

```hnmd
<HStack gap="4" items="center">
  <Text>Left</Text>
  <Text>Right</Text>
</HStack>
```

### Layout: ZStack

Layered stack — children are stacked on top of each other (like CSS Grid overlay).

```hnmd
<ZStack align="center">
  <Img src="https://example.com/bg.jpg" width="full" height="full" fit="cover" />
  <Text size="2xl" color="white" weight="bold">Overlay Text</Text>
</ZStack>
```

ZStack-specific prop:
- `align`: `center` (default), `top-left`, `top`, `top-right`, `left`, `right`, `bottom-left`, `bottom`, `bottom-right`

### Content: Text

Styled text span.

```hnmd
<Text size="2xl" weight="bold" color="blue-500" align="center">Hello!</Text>
```

Props:
| Prop | Values |
|------|--------|
| `size` | `xs`, `sm`, `base`, `lg`, `xl`, `2xl`, `3xl`, `4xl` |
| `weight` | `thin`, `light`, `normal`, `medium`, `semibold`, `bold`, `black` |
| `color` | Any color value (see below) |
| `align` | `left`, `center`, `right` |

### Content: Img

Styled image.

```hnmd
<Img src="https://example.com/photo.jpg" width="full" fit="cover" rounded="lg" />
```

Props:
| Prop | Values |
|------|--------|
| `src` | Image URL |
| `alt` | Alt text |
| `fit` | `contain`, `cover`, `fill`, `none` |
| `width` | Size value |
| `height` | Size value |
| `rounded` | Rounding value |
| `opacity` | `0` to `100` |

### Container Style Props (VStack, HStack, ZStack)

All layout containers accept these props:

| Prop | Values | Description |
|------|--------|-------------|
| `gap` | Spacing value | Space between children |
| `padding` (or `p`) | Spacing value | Padding on all sides |
| `px` | Spacing value | Horizontal padding |
| `py` | Spacing value | Vertical padding |
| `pt`, `pr`, `pb`, `pl` | Spacing value | Individual side padding |
| `width` | Size value | Container width |
| `height` | Size value | Container height |
| `grow` | `0`, `1` | Flex grow (1 = fill available space) |
| `bg` | Color value | Background color |
| `border` | `0`, `1`, `2`, `4` | Border width in pixels |
| `borderColor` | Color value | Border color |
| `rounded` | Rounding value | Border radius |
| `justify` | `start`, `center`, `end`, `between`, `around`, `evenly` | Main axis alignment |
| `items` | `start`, `center`, `end`, `stretch`, `baseline` | Cross axis alignment |
| `overflow` | `visible`, `hidden`, `scroll`, `auto` | Overflow behavior |
| `opacity` | `0` to `100` | Opacity percentage |

## Style Value Reference

### Spacing Values
Used for `gap`, `padding`, `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl`:

| Value | CSS |
|-------|-----|
| `"0"` | 0 |
| `"1"` | 0.25rem |
| `"2"` | 0.5rem |
| `"3"` | 0.75rem |
| `"4"` | 1rem |
| `"6"` | 1.5rem |
| `"8"` | 2rem |
| `"12"` | 3rem |
| `"16"` | 4rem |

### Size Values
Used for `width`, `height`:

| Value | CSS |
|-------|-----|
| `auto` | auto |
| `fit` | fit-content |
| `half` | 50% |
| `full` | 100% |

### Color Values
Used for `bg`, `color`, `borderColor`:

Format: `colorname-shade` with optional `/opacity`

**Available colors:** `gray`, `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`
**Shades:** `50`, `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`
**Special:** `white`, `black`, `transparent`

Examples:
- `blue-500` — standard blue
- `red-300` — light red
- `gray-900` — near-black
- `blue-500/50` — blue at 50% opacity
- `white` — pure white

### Rounding Values
Used for `rounded`:

| Value | CSS |
|-------|-----|
| `none` | 0 |
| `sm` | 0.125rem |
| `md` | 0.375rem |
| `lg` | 0.5rem |
| `xl` | 0.75rem |
| `2xl` | 1rem |
| `full` | 9999px (circle) |

## Markdown Inside Components

You can nest standard Markdown inside layout components:

```hnmd
<VStack bg="blue-50" padding="4" rounded="md">
# This heading works inside a VStack

And so does **bold text**, *italics*, and [links](https://example.com).

![images work too](https://example.com/img.png)
</VStack>
```

## Examples

### Styled Card

```hnmd
---
title: Styled Card
bg: gray-100
---

<VStack gap="4" padding="6" bg="white" rounded="xl" border="1" borderColor="gray-200">
  <Text size="2xl" weight="bold">Welcome!</Text>
  <Text color="gray-600">This is a styled card with a border and rounded corners.</Text>
  <HStack gap="2">
    <Text size="sm" color="blue-500" weight="semibold">Learn More</Text>
    <Text size="sm" color="gray-400">|</Text>
    <Text size="sm" color="blue-500" weight="semibold">Get Started</Text>
  </HStack>
</VStack>
```

### Two Column Layout

```hnmd
---
title: Two Columns
---

<HStack gap="4">
  <VStack width="half" bg="blue-50" padding="4" rounded="md">
    ## Left Column
    Content on the left side.
  </VStack>
  <VStack width="half" bg="green-50" padding="4" rounded="md">
    ## Right Column
    Content on the right side.
  </VStack>
</HStack>
```

### Hero with Background

```hnmd
---
title: My Landing Page
bg: purple-900
color: white
padding: "8"
---

<VStack gap="6" items="center" justify="center" height="full">
  <Text size="4xl" weight="bold" align="center">Build Amazing Things</Text>
  <Text size="lg" color="purple-200" align="center">A subtitle that explains what this is about</Text>
  <HStack gap="4">
    <VStack bg="white" padding="3" rounded="lg">
      <Text color="purple-900" weight="semibold">Get Started</Text>
    </VStack>
    <VStack border="2" borderColor="white" padding="3" rounded="lg">
      <Text weight="semibold">Learn More</Text>
    </VStack>
  </HStack>
</VStack>
```

### Image Gallery

```hnmd
---
title: Photo Gallery
---

# My Photos

<HStack gap="4">
  <Img src="https://picsum.photos/400/300?1" width="half" rounded="lg" fit="cover" />
  <Img src="https://picsum.photos/400/300?2" width="half" rounded="lg" fit="cover" />
</HStack>

<HStack gap="4">
  <Img src="https://picsum.photos/400/300?3" width="half" rounded="lg" fit="cover" />
  <Img src="https://picsum.photos/400/300?4" width="half" rounded="lg" fit="cover" />
</HStack>
```

## Common Mistakes

1. **Using arbitrary CSS values** — Only the enumerated values above work. `padding="10px"` won't work; use `padding="4"` instead.
2. **Forgetting quotes on numeric-looking values** — In frontmatter YAML, write `padding: "4"` not `padding: 4` (YAML interprets bare numbers as integers, not strings).
3. **Using components that don't exist** — Only the built-in components listed above are available: VStack, HStack, ZStack, Text, Img, Note, Profile, Input, Textarea, Button, and the special `Each`.
4. **Missing frontmatter** — Always include `---` delimited frontmatter with at least a `title`.
5. **Closing tag mismatch** — JSX requires matching closing tags: `<VStack>...</VStack>`, not `<VStack>...</vstack>` (case must match within a single element).
