# Hypernote Styling System

## V1 Spec: Enumerated Properties

### Design Principles
- **No pixel units:** we don't control device size, use relative sizing
- **No Box component:** VStack/HStack/ZStack handle all container styling
- **Cross-platform:** maps directly to SwiftUI/Flutter, not web-specific
- **Figma-like editing:** all properties enumerable with defaults in properties panel

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
  width="full"      # full|half|auto|fit or percentage "50%"
  height="auto"     # full|half|auto|fit or percentage
  justify="start"   # start|center|end|between|around
  items="stretch"   # start|center|end|stretch
  overflow="visible" # visible|hidden|scroll
>
```

### HStack - Horizontal stack
Same props as VStack, just flows horizontally.

### ZStack - Layered/absolute positioning
```mdx
<ZStack
  gap="0"           # usually 0 for overlapping
  padding="4"
  bg="transparent"
  width="full"
  height="full"
  # ... same container props as VStack/HStack
>
  {/* Children stack on top of each other */}
  {/* First child is bottom layer, last is top */}
</ZStack>
```

**ZStack children can use position props:**
```mdx
<ZStack>
  <Img src="bg.jpg" position="fill" fit="cover" />
  <VStack position="top-left" offset="4">
    <Text>Top left corner</Text>
  </VStack>
  <VStack position="center">
    <Text size="2xl" weight="bold">Centered!</Text>
  </VStack>
  <HStack position="bottom" offset="4">
    <Text>Bottom center with offset</Text>
  </HStack>
</ZStack>
```

---

## Position System (for ZStack children)

```
position: fill | center |
          top-left | top | top-right |
          left | right |
          bottom-left | bottom | bottom-right

offset: spacing value applied as inset from edges
```

| Position | Behavior |
|----------|----------|
| `fill` | Stretch to fill parent (default for first child often) |
| `center` | Centered both horizontally and vertically |
| `top` | Top edge, horizontally centered |
| `top-left` | Top-left corner |
| `bottom-right` | Bottom-right corner |
| etc. | ... |

`offset` adds padding from the anchored edge(s).

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
  position="fill"   # when inside ZStack
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
| `"50%"` | Explicit percentage |

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

## Complete Example

```yaml
---
title: My Blog Post
bg: "gray-50"
---
```

```mdx
<VStack padding="6" gap="4" width="full" items="center">
  <Text size="3xl" weight="bold" color="gray-900">
    Hello World
  </Text>
  <Text size="base" color="gray-600">
    This is a flexible page that works on any screen size.
  </Text>
  <HStack gap="2">
    <Button action="like">Like</Button>
    <Button action="share">Share</Button>
  </HStack>
</VStack>
```

---

## Properties Panel Integration

Since all properties are enumerated, the properties panel can show:

**For a selected VStack:**
```
Layout
  |- direction: vertical (readonly for VStack)
  |- gap: [dropdown: 0,1,2,3,4,6,8,12,16]
  |- justify: [dropdown: start,center,end,between,around]
  +- items: [dropdown: start,center,end,stretch]

Size
  |- width: [dropdown: auto,fit,half,full] or [text input for %]
  +- height: [dropdown: auto,fit,half,full]

Appearance
  |- bg: [color picker]
  |- rounded: [dropdown: none,sm,md,lg,xl,full]
  |- border: [dropdown: 0,1,2,4]
  +- borderColor: [color picker]

Spacing
  |- padding: [4-way input or single]
  +- margin: [4-way input or single]
```

Unset properties show defaults in gray. Changed properties show in black/bold.

---

## Open Questions

1. **maxWidth for readable text:** Should there be a `maxWidth` prop, or is that too web-specific? Could use `width="readable"` as a semantic value?

2. **Gradients:** Worth supporting? Syntax could be `bg="linear(blue-500, purple-500)"` or defer.

3. **Shadows:** Skip for now? Or simple `shadow="sm|md|lg"`?

---

## Deferred (V2+)

- Animation/transitions
- Responsive breakpoints
- Custom colors (define in frontmatter theme)
- Blur/backdrop effects
- Masks and clipping
- Aspect ratio constraints (need better approach - maybe editor guidelines instead of frontmatter)
