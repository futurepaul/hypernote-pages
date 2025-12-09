# Hypernote Styling System

## V1 Spec: Enumerated Properties

### Design Principles
- **Two primary use cases:** flexible web pages and fixed-aspect "stories"
- **No pixel units:** we don't control device size, use relative sizing
- **Frame is implicit:** defined in frontmatter, not a component
- **No Box component:** VStack/HStack/ZStack handle all container styling
- **Cross-platform:** maps directly to SwiftUI/Flutter, not web-specific
- **Figma-like editing:** all properties enumerable with defaults in properties panel

---

## Frontmatter: Page Canvas

```yaml
---
title: My Page

# Canvas settings
canvas:
  aspect: flexible    # flexible | portrait (9:16) | landscape (16:9) | square (1:1)
  bg: "gray-900"      # color, image URL, or video URL - renderer figures it out

# Examples:
# bg: "blue-500"                    # solid color
# bg: "https://example.com/bg.jpg"  # image (stretched/covered)
# bg: "https://example.com/bg.mp4"  # video (looped, muted)
# bg: "linear(blue-500, purple-500)" # gradient (future?)
---
```

The canvas is the implicit root frame. All content renders inside it.

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
  decoration="none" # none|underline|line-through
  transform="none"  # none|uppercase|lowercase|capitalize
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

## Complete Example: Flexible Web Page

```yaml
---
title: My Blog Post
canvas:
  aspect: flexible
  bg: "gray-50"
---
```

```mdx
<VStack padding="6" gap="4" width="full" items="center">
  <VStack width="full" maxWidth="640px" gap="6">
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
</VStack>
```

---

## Complete Example: Instagram Story

```yaml
---
title: My Story
canvas:
  aspect: portrait
  bg: "https://example.com/sunset.mp4"
---
```

```mdx
<ZStack width="full" height="full">
  {/* Background is handled by canvas.bg */}

  {/* Top bar */}
  <HStack position="top" offset="4" gap="2" items="center">
    <Profile pubkey="npub1..." />
    <Text size="sm" color="white/80">2h ago</Text>
  </HStack>

  {/* Centered content */}
  <VStack position="center" gap="4" items="center">
    <Text size="4xl" weight="bold" color="white">
      🎉
    </Text>
    <Text size="xl" color="white" align="center">
      Tap to vote!
    </Text>
  </VStack>

  {/* Bottom poll */}
  <VStack position="bottom" offset="8" gap="2" width="full" padding="4">
    <HStack gap="2" width="full">
      <VStack bg="white/20" rounded="lg" padding="4" width="half">
        <Text color="white" align="center">Option A</Text>
      </VStack>
      <VStack bg="white/20" rounded="lg" padding="4" width="half">
        <Text color="white" align="center">Option B</Text>
      </VStack>
    </HStack>
  </VStack>
</ZStack>
```

---

## Properties Panel Integration

Since all properties are enumerated, the properties panel can show:

**For a selected VStack:**
```
Layout
  ├─ direction: vertical (readonly for VStack)
  ├─ gap: [dropdown: 0,1,2,3,4,6,8,12,16]
  ├─ justify: [dropdown: start,center,end,between,around]
  └─ items: [dropdown: start,center,end,stretch]

Size
  ├─ width: [dropdown: auto,fit,half,full] or [text input for %]
  └─ height: [dropdown: auto,fit,half,full]

Appearance
  ├─ bg: [color picker]
  ├─ rounded: [dropdown: none,sm,md,lg,xl,full]
  ├─ border: [dropdown: 0,1,2,4]
  └─ borderColor: [color picker]

Spacing
  ├─ padding: [4-way input or single]
  └─ margin: [4-way input or single]
```

Unset properties show defaults in gray. Changed properties show in black/bold.

---

## Implementation Plan

1. **Define TypeScript types** for all style properties
2. **Add ZStack** to builtins
3. **Update VStack/HStack** to accept style props
4. **Create style resolver** that merges defaults + props
5. **Update NodeRenderer** to apply resolved styles
6. **Update PropertiesPanel** to show/edit all properties
7. **Add canvas frontmatter parsing** to Preview
8. **Handle bg as color/image/video** in canvas renderer

---

## Open Questions

1. **maxWidth for readable text:** Should there be a `maxWidth` prop, or is that too web-specific? Could use `width="readable"` as a semantic value?

2. **Gradients:** Worth supporting in v1? Syntax could be `bg="linear(blue-500, purple-500)"` or defer.

3. **Shadows:** Skip for v1? Or simple `shadow="sm|md|lg"`?

4. **Aspect ratio on components:** Should VStack/HStack/ZStack support `aspect` prop, or only at canvas level?

---

## Deferred (V2+)

- Animation/transitions
- Responsive breakpoints
- Custom colors (define in frontmatter theme)
- Blur/backdrop effects
- Masks and clipping

