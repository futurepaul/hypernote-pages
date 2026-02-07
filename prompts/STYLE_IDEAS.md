# Hypernote Styling System

## V1 Spec: Enumerated Properties (SwiftUI-inspired)

### Design Principles
- **No pixel units:** we don't control device size, use relative sizing
- **No viewport units in content:** the rendering context provides constraints
- **Cross-platform:** maps directly to SwiftUI/Flutter, not web-specific
- **Figma-like editing:** all properties enumerable with defaults in properties panel
- **Minimum necessary primitives:** one good way to do things, not a million options

---

## Rendering Contexts

Hypernotes are consumed in two main ways:

### Feed Mode (default)
- Instagram/social media scroll style
- Constrained viewport: min 50vh, max 80vh
- Content uses `height="full"` to fill available space
- Scrolling happens within the constrained preview

### Full Page Mode
- Browser-like, full viewport
- 100vh x 100vw available
- Content uses `height="full"` to fill the viewport

**Key insight:** Content doesn't specify viewport size - it uses relative sizing (`full`, `half`, `auto`) and the rendering context provides the constraints.

---

## Frontmatter: Page Background

```yaml
---
title: My Page
bg: "gray-900"      # color, image URL, or video URL - renderer figures it out

# Examples:
# bg: "blue-500"                    # solid color
# bg: "https://example.com/bg.jpg"  # image (stretched/covered)
# bg: "https://example.com/bg.mp4"  # video (looped, muted)
---
```

---

## Layout Components

### VStack - Vertical stack
```mdx
<VStack
  gap="4"           # spacing between children
  padding="4"       # or p, px, py, pt, pr, pb, pl
  bg="gray-100"     # background color
  rounded="lg"      # border radius: none|sm|md|lg|xl|full
  border="1"        # border width
  borderColor="gray-300"
  width="full"      # full|half|auto|fit
  height="auto"     # full|half|auto|fit
  grow="1"          # flex grow: 0|1 (for children of VStack/HStack)
  justify="start"   # start|center|end|between|around
  items="stretch"   # start|center|end|stretch
  overflow="visible" # visible|hidden|scroll|auto
>
```

### HStack - Horizontal stack
Same props as VStack, just flows horizontally.

### ZStack - SwiftUI-style layered stack

All children are stacked on top of each other. The ZStack sizes to fit the largest child. Uses CSS Grid internally with all children in the same cell.

```mdx
<ZStack
  align="center"    # where children align: center|top-left|top|top-right|left|right|bottom-left|bottom|bottom-right
  padding="4"
  bg="transparent"
  width="full"
  height="full"
  # ... same container props as VStack/HStack (except gap, which doesn't apply)
>
  <Img src="bg.jpg" width="full" height="full" fit="cover" />
  <Text size="2xl" weight="bold">Centered on top!</Text>
</ZStack>
```

---

## Flex Growth (for VStack/HStack children)

Use `grow="1"` to make a child expand to fill available space:

```mdx
<VStack height="full">
  <Text>Header (shrinks to fit)</Text>

  <VStack grow="1" overflow="scroll">
    {/* This section expands to fill remaining space */}
    {/* and scrolls if content overflows */}
  </VStack>

  <HStack>Footer (shrinks to fit)</HStack>
</VStack>
```

This is how SwiftUI's `Spacer()` and Flutter's `Expanded()` work.

---

## Text Styling

```mdx
<Text
  size="base"       # xs|sm|base|lg|xl|2xl|3xl|4xl
  weight="normal"   # thin|light|normal|medium|semibold|bold|black
  color="white"     # color name
  align="left"      # left|center|right
>
```

---

## Image/Media

```mdx
<Img
  src="..."
  alt="..."
  fit="contain"     # contain|cover|fill|none
  width="full"      # sizing
  height="auto"
  rounded="lg"      # can have rounded corners
  opacity="100"     # 0-100
/>
```

---

## Spacing Scale (relative units)

All spacing values map to a scale. Renderers convert to appropriate units.

| Value | Meaning |
|-------|---------|
| `0` | 0 |
| `1` | extra small (0.25rem / 4pt) |
| `2` | small (0.5rem / 8pt) |
| `3` | (0.75rem / 12pt) |
| `4` | medium (1rem / 16pt) |
| `6` | (1.5rem / 24pt) |
| `8` | large (2rem / 32pt) |
| `12` | (3rem / 48pt) |
| `16` | extra large (4rem / 64pt) |

---

## Size Values

| Value | Meaning |
|-------|---------|
| `full` | 100% of parent |
| `half` | 50% of parent |
| `auto` | Automatic based on content/flex |
| `fit` | Shrink to fit content exactly |

**Note:** No `screen` value - content uses parent-relative sizing. The rendering context (feed vs fullpage) provides the viewport constraints.

---

## Color Palette

Semantic, portable colors with shades:

```
gray:   50, 100, 200, 300, 400, 500, 600, 700, 800, 900
blue:   50, 100, 200, 300, 400, 500, 600, 700, 800, 900
red:    ...
green:  ...
yellow: ...
purple: ...
pink:   ...
orange: ...

Special: white, black, transparent
```

**Opacity modifier:** `blue-500/50` = blue-500 at 50% opacity

---

## Complete Example: Chat Layout

```yaml
---
title: Chat Room
bg: "gray-900"
---
```

```mdx
<VStack height="full" gap="0">
  {/* Header */}
  <HStack padding="4" bg="gray-800" items="center">
    <Text size="lg" weight="bold" color="white">Chat Room</Text>
  </HStack>

  {/* Messages - grows to fill, scrolls */}
  <VStack grow="1" overflow="scroll" padding="4" gap="2">
    <Each from={queries.messages} as="msg">
      <VStack bg="gray-800" rounded="lg" padding="3">
        <Profile pubkey={msg.pubkey} />
        <Text color="white">{msg.content}</Text>
      </VStack>
    </Each>
  </VStack>

  {/* Input footer */}
  <HStack padding="4" bg="gray-800" gap="2">
    <Input name="message" placeholder="Type a message..." />
    <Button action="send">Send</Button>
  </HStack>
</VStack>
```

---

## Complete Example: Image with Overlay Text

```mdx
<ZStack width="full" height="full">
  <Img src="hero.jpg" width="full" height="full" fit="cover" />
  <VStack padding="8">
    <Text size="4xl" weight="bold" color="white">Welcome</Text>
    <Text size="lg" color="white/80">Your journey starts here</Text>
  </VStack>
</ZStack>
```

---

## Properties Panel Integration

Since all properties are enumerated, the properties panel can show:

**For a selected VStack:**
```
Layout
  |- gap: [dropdown: 0,1,2,3,4,6,8,12,16]
  |- justify: [dropdown: start,center,end,between,around]
  |- items: [dropdown: start,center,end,stretch]
  +- overflow: [dropdown: visible,hidden,scroll,auto]

Size
  |- width: [dropdown: auto,fit,half,full]
  |- height: [dropdown: auto,fit,half,full]
  +- grow: [dropdown: 0,1]

Appearance
  |- bg: [color picker]
  |- rounded: [dropdown: none,sm,md,lg,xl,full]
  |- border: [dropdown: 0,1,2,4]
  +- borderColor: [color picker]

Spacing
  +- padding: [dropdown: 0,1,2,3,4,6,8,12,16]
```

**For ZStack, adds:**
```
Alignment
  +- align: [dropdown: center,top-left,top,top-right,left,right,bottom-left,bottom,bottom-right]
```

Unset properties show defaults in gray. Changed properties show in black/bold.

---

## Deferred (V2+)

- Animation/transitions
- Responsive breakpoints
- Custom colors (define in frontmatter theme)
- Blur/backdrop effects
- Masks and clipping
- Gradients: `bg="linear(blue-500, purple-500)"`
- Shadows: `shadow="sm|md|lg"`
