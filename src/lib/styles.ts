/**
 * Hypernote Styling System
 *
 * Enumerated properties that map to native concepts (SwiftUI, Flutter, CSS).
 * All values are relative - no pixel units.
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/** Spacing scale values */
export type SpacingValue = "0" | "1" | "2" | "3" | "4" | "6" | "8" | "12" | "16";

/** Size values for width/height */
export type SizeValue = "auto" | "fit" | "half" | "full" | `${number}%`;

/** Border radius values */
export type RoundedValue = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";

/** Border width values */
export type BorderValue = "0" | "1" | "2" | "4";

/** Flex justify values */
export type JustifyValue = "start" | "center" | "end" | "between" | "around" | "evenly";

/** Flex align values */
export type AlignValue = "start" | "center" | "end" | "stretch" | "baseline";

/** Overflow values */
export type OverflowValue = "visible" | "hidden" | "scroll" | "auto";

/** Position anchors for ZStack children */
export type PositionValue =
  | "fill"
  | "center"
  | "top" | "top-left" | "top-right"
  | "bottom" | "bottom-left" | "bottom-right"
  | "left" | "right";

/** Image fit values */
export type FitValue = "contain" | "cover" | "fill" | "none";

/** Text size values */
export type TextSizeValue = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

/** Font weight values */
export type WeightValue = "thin" | "light" | "normal" | "medium" | "semibold" | "bold" | "black";

/** Text alignment */
export type TextAlignValue = "left" | "center" | "right";

/** Color with optional opacity: "blue-500" or "blue-500/50" */
export type ColorValue = string;

// =============================================================================
// COMPONENT PROP INTERFACES
// =============================================================================

/** Common container style props for VStack, HStack, ZStack */
export interface ContainerStyleProps {
  // Spacing
  gap?: SpacingValue;
  padding?: SpacingValue;
  p?: SpacingValue;
  px?: SpacingValue;
  py?: SpacingValue;
  pt?: SpacingValue;
  pr?: SpacingValue;
  pb?: SpacingValue;
  pl?: SpacingValue;

  // Size
  width?: SizeValue;
  height?: SizeValue;

  // Background & Border
  bg?: ColorValue;
  border?: BorderValue;
  borderColor?: ColorValue;
  rounded?: RoundedValue;

  // Flex alignment
  justify?: JustifyValue;
  items?: AlignValue;

  // Other
  overflow?: OverflowValue;
  opacity?: string; // "0" to "100"

  // Position (for ZStack children)
  position?: PositionValue;
  offset?: SpacingValue;
}

/** Text style props */
export interface TextStyleProps {
  size?: TextSizeValue;
  weight?: WeightValue;
  color?: ColorValue;
  align?: TextAlignValue;
}

/** Image style props */
export interface ImgStyleProps {
  fit?: FitValue;
  position?: PositionValue;
  offset?: SpacingValue;
  width?: SizeValue;
  height?: SizeValue;
  rounded?: RoundedValue;
  opacity?: string;
}

// =============================================================================
// VALUE MAPS
// =============================================================================

/** Spacing scale to CSS values */
export const SPACING_MAP: Record<SpacingValue, string> = {
  "0": "0",
  "1": "0.25rem",
  "2": "0.5rem",
  "3": "0.75rem",
  "4": "1rem",
  "6": "1.5rem",
  "8": "2rem",
  "12": "3rem",
  "16": "4rem",
};

/** Size values to CSS */
export const SIZE_MAP: Record<string, string> = {
  "auto": "auto",
  "fit": "fit-content",
  "half": "50%",
  "full": "100%",
};

/** Border radius to CSS */
export const ROUNDED_MAP: Record<RoundedValue, string> = {
  "none": "0",
  "sm": "0.125rem",
  "md": "0.375rem",
  "lg": "0.5rem",
  "xl": "0.75rem",
  "2xl": "1rem",
  "full": "9999px",
};

/** Border width to CSS */
export const BORDER_MAP: Record<BorderValue, string> = {
  "0": "0",
  "1": "1px",
  "2": "2px",
  "4": "4px",
};

/** Justify to CSS flexbox */
export const JUSTIFY_MAP: Record<JustifyValue, string> = {
  "start": "flex-start",
  "center": "center",
  "end": "flex-end",
  "between": "space-between",
  "around": "space-around",
  "evenly": "space-evenly",
};

/** Align to CSS flexbox */
export const ALIGN_MAP: Record<AlignValue, string> = {
  "start": "flex-start",
  "center": "center",
  "end": "flex-end",
  "stretch": "stretch",
  "baseline": "baseline",
};

/** Text sizes to CSS */
export const TEXT_SIZE_MAP: Record<TextSizeValue, string> = {
  "xs": "0.75rem",
  "sm": "0.875rem",
  "base": "1rem",
  "lg": "1.125rem",
  "xl": "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
};

/** Font weights to CSS */
export const WEIGHT_MAP: Record<WeightValue, number> = {
  "thin": 100,
  "light": 300,
  "normal": 400,
  "medium": 500,
  "semibold": 600,
  "bold": 700,
  "black": 900,
};

/** Object fit to CSS */
export const FIT_MAP: Record<FitValue, string> = {
  "contain": "contain",
  "cover": "cover",
  "fill": "fill",
  "none": "none",
};

// =============================================================================
// COLOR SYSTEM
// =============================================================================

const COLOR_SHADES: Record<string, Record<number, string>> = {
  gray: {
    50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db",
    400: "#9ca3af", 500: "#6b7280", 600: "#4b5563", 700: "#374151",
    800: "#1f2937", 900: "#111827",
  },
  red: {
    50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5",
    400: "#f87171", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c",
    800: "#991b1b", 900: "#7f1d1d",
  },
  orange: {
    50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74",
    400: "#fb923c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c",
    800: "#9a3412", 900: "#7c2d12",
  },
  yellow: {
    50: "#fefce8", 100: "#fef9c3", 200: "#fef08a", 300: "#fde047",
    400: "#facc15", 500: "#eab308", 600: "#ca8a04", 700: "#a16207",
    800: "#854d0e", 900: "#713f12",
  },
  green: {
    50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac",
    400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d",
    800: "#166534", 900: "#14532d",
  },
  blue: {
    50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd",
    400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8",
    800: "#1e40af", 900: "#1e3a8a",
  },
  purple: {
    50: "#faf5ff", 100: "#f3e8ff", 200: "#e9d5ff", 300: "#d8b4fe",
    400: "#c084fc", 500: "#a855f7", 600: "#9333ea", 700: "#7e22ce",
    800: "#6b21a8", 900: "#581c87",
  },
  pink: {
    50: "#fdf2f8", 100: "#fce7f3", 200: "#fbcfe8", 300: "#f9a8d4",
    400: "#f472b6", 500: "#ec4899", 600: "#db2777", 700: "#be185d",
    800: "#9d174d", 900: "#831843",
  },
};

const SPECIAL_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
};

/**
 * Parse a color value like "blue-500" or "blue-500/50" to CSS
 */
export function parseColor(value: unknown): string | null {
  // Handle non-string or empty values gracefully
  if (!value || typeof value !== "string") return null;

  // Check special colors first
  if (value in SPECIAL_COLORS) {
    return SPECIAL_COLORS[value] ?? null;
  }

  // Parse opacity modifier: "blue-500/50"
  let opacity = 100;
  let colorPart = value;
  if (value.includes("/")) {
    const [color, op] = value.split("/");
    colorPart = color ?? value;
    opacity = parseInt(op ?? "100", 10);
    if (isNaN(opacity)) opacity = 100;
  }

  // Check for special colors with opacity
  if (colorPart in SPECIAL_COLORS) {
    const hex = SPECIAL_COLORS[colorPart];
    if (hex && opacity < 100 && hex !== "transparent") {
      return hexToRgba(hex, opacity / 100);
    }
    return hex ?? null;
  }

  // Parse "color-shade" format
  const match = colorPart.match(/^([a-z]+)-(\d+)$/);
  if (!match) return null;

  const colorName = match[1];
  const shadeStr = match[2];
  if (!colorName || !shadeStr) return null;

  const shade = parseInt(shadeStr, 10);

  const colorScale = COLOR_SHADES[colorName];
  if (!colorScale || !(shade in colorScale)) return null;

  const hex = colorScale[shade];
  if (!hex) return null;

  if (opacity < 100) {
    return hexToRgba(hex, opacity / 100);
  }
  return hex;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// =============================================================================
// STYLE RESOLVERS
// =============================================================================

// Helper to safely get string value
function str(val: unknown): string | undefined {
  return typeof val === "string" ? val : undefined;
}

/**
 * Resolve container style props to CSS styles
 * Accepts any props to be permissive during intermediate typing states
 */
export function resolveContainerStyles(props: Record<string, unknown>): React.CSSProperties {
  const styles: React.CSSProperties = {};

  // Gap
  const gap = str(props.gap);
  if (gap) {
    styles.gap = SPACING_MAP[gap as SpacingValue] ?? gap;
  }

  // Padding (individual overrides general)
  const padding = str(props.padding) ?? str(props.p);
  if (padding) {
    styles.padding = SPACING_MAP[padding as SpacingValue] ?? padding;
  }
  const px = str(props.px);
  if (px) {
    styles.paddingLeft = SPACING_MAP[px as SpacingValue];
    styles.paddingRight = SPACING_MAP[px as SpacingValue];
  }
  const py = str(props.py);
  if (py) {
    styles.paddingTop = SPACING_MAP[py as SpacingValue];
    styles.paddingBottom = SPACING_MAP[py as SpacingValue];
  }
  const pt = str(props.pt);
  if (pt) styles.paddingTop = SPACING_MAP[pt as SpacingValue];
  const pr = str(props.pr);
  if (pr) styles.paddingRight = SPACING_MAP[pr as SpacingValue];
  const pb = str(props.pb);
  if (pb) styles.paddingBottom = SPACING_MAP[pb as SpacingValue];
  const pl = str(props.pl);
  if (pl) styles.paddingLeft = SPACING_MAP[pl as SpacingValue];

  // Size
  const width = str(props.width);
  if (width) {
    styles.width = SIZE_MAP[width] ?? width;
  }
  const height = str(props.height);
  if (height) {
    styles.height = SIZE_MAP[height] ?? height;
  }

  // Background
  const bg = parseColor(props.bg);
  if (bg) {
    styles.backgroundColor = bg;
  }

  // Border
  const border = str(props.border);
  if (border && border !== "0") {
    styles.borderWidth = BORDER_MAP[border as BorderValue];
    styles.borderStyle = "solid";
    styles.borderColor = parseColor(props.borderColor) ?? "#e5e7eb";
  }

  // Border radius
  const rounded = str(props.rounded);
  if (rounded) {
    styles.borderRadius = ROUNDED_MAP[rounded as RoundedValue];
  }

  // Flex alignment
  const justify = str(props.justify);
  if (justify) {
    styles.justifyContent = JUSTIFY_MAP[justify as JustifyValue];
  }
  const items = str(props.items);
  if (items) {
    styles.alignItems = ALIGN_MAP[items as AlignValue];
  }

  // Overflow
  const overflow = str(props.overflow);
  if (overflow) {
    styles.overflow = overflow as React.CSSProperties["overflow"];
  }

  // Opacity
  const opacity = str(props.opacity);
  if (opacity) {
    const op = parseInt(opacity, 10);
    if (!isNaN(op)) {
      styles.opacity = op / 100;
    }
  }

  return styles;
}

/**
 * Resolve position props for ZStack children
 */
export function resolvePositionStyles(props: Record<string, unknown>): React.CSSProperties {
  const styles: React.CSSProperties = {};

  const position = str(props.position);
  if (!position) return styles;

  styles.position = "absolute";
  const offsetVal = str(props.offset);
  const offset = offsetVal ? SPACING_MAP[offsetVal as SpacingValue] ?? "0" : "0";

  switch (position) {
    case "fill":
      styles.inset = offset;
      break;
    case "center":
      styles.top = "50%";
      styles.left = "50%";
      styles.transform = "translate(-50%, -50%)";
      break;
    case "top":
      styles.top = offset;
      styles.left = "50%";
      styles.transform = "translateX(-50%)";
      break;
    case "top-left":
      styles.top = offset;
      styles.left = offset;
      break;
    case "top-right":
      styles.top = offset;
      styles.right = offset;
      break;
    case "bottom":
      styles.bottom = offset;
      styles.left = "50%";
      styles.transform = "translateX(-50%)";
      break;
    case "bottom-left":
      styles.bottom = offset;
      styles.left = offset;
      break;
    case "bottom-right":
      styles.bottom = offset;
      styles.right = offset;
      break;
    case "left":
      styles.left = offset;
      styles.top = "50%";
      styles.transform = "translateY(-50%)";
      break;
    case "right":
      styles.right = offset;
      styles.top = "50%";
      styles.transform = "translateY(-50%)";
      break;
  }

  return styles;
}

/**
 * Resolve text style props to CSS styles
 */
export function resolveTextStyles(props: Record<string, unknown>): React.CSSProperties {
  const styles: React.CSSProperties = {};

  const size = str(props.size);
  if (size) {
    styles.fontSize = TEXT_SIZE_MAP[size as TextSizeValue];
  }
  const weight = str(props.weight);
  if (weight) {
    styles.fontWeight = WEIGHT_MAP[weight as WeightValue];
  }
  const color = parseColor(props.color);
  if (color) {
    styles.color = color;
  }
  const align = str(props.align);
  if (align) {
    styles.textAlign = align as React.CSSProperties["textAlign"];
  }

  return styles;
}

/**
 * Resolve image style props to CSS styles
 */
export function resolveImgStyles(props: Record<string, unknown>): React.CSSProperties {
  const styles: React.CSSProperties = {};

  const fit = str(props.fit);
  if (fit) {
    styles.objectFit = FIT_MAP[fit as FitValue] as React.CSSProperties["objectFit"];
  }
  const width = str(props.width);
  if (width) {
    styles.width = SIZE_MAP[width] ?? width;
  }
  const height = str(props.height);
  if (height) {
    styles.height = SIZE_MAP[height] ?? height;
  }
  const rounded = str(props.rounded);
  if (rounded) {
    styles.borderRadius = ROUNDED_MAP[rounded as RoundedValue];
  }
  const opacity = str(props.opacity);
  if (opacity) {
    const op = parseInt(opacity, 10);
    if (!isNaN(op)) {
      styles.opacity = op / 100;
    }
  }

  // Position styles for ZStack children
  const posStyles = resolvePositionStyles(props);
  Object.assign(styles, posStyles);

  return styles;
}

/**
 * Detect if a bg value is a color, image URL, or video URL
 */
export function detectBgType(bg: string): "color" | "image" | "video" {
  if (!bg) return "color";

  // Check if it's a URL
  if (bg.startsWith("http://") || bg.startsWith("https://") || bg.startsWith("/")) {
    // Check extension for video
    const videoExts = [".mp4", ".webm", ".mov", ".m4v"];
    const lower = bg.toLowerCase();
    if (videoExts.some(ext => lower.includes(ext))) {
      return "video";
    }
    return "image";
  }

  return "color";
}

// =============================================================================
// PROPERTY DEFINITIONS (for Properties Panel)
// =============================================================================

export interface PropertyDefinition {
  name: string;
  type: "select" | "color" | "text";
  options?: string[];
  default?: string;
  group: "layout" | "size" | "appearance" | "spacing" | "text" | "position";
}

export const CONTAINER_PROPERTIES: PropertyDefinition[] = [
  // Layout
  { name: "gap", type: "select", options: ["0", "1", "2", "3", "4", "6", "8", "12", "16"], default: "0", group: "layout" },
  { name: "justify", type: "select", options: ["start", "center", "end", "between", "around", "evenly"], default: "start", group: "layout" },
  { name: "items", type: "select", options: ["start", "center", "end", "stretch", "baseline"], default: "stretch", group: "layout" },
  { name: "overflow", type: "select", options: ["visible", "hidden", "scroll", "auto"], default: "visible", group: "layout" },

  // Size
  { name: "width", type: "select", options: ["auto", "fit", "half", "full"], default: "auto", group: "size" },
  { name: "height", type: "select", options: ["auto", "fit", "half", "full"], default: "auto", group: "size" },

  // Appearance
  { name: "bg", type: "color", default: "transparent", group: "appearance" },
  { name: "rounded", type: "select", options: ["none", "sm", "md", "lg", "xl", "2xl", "full"], default: "none", group: "appearance" },
  { name: "border", type: "select", options: ["0", "1", "2", "4"], default: "0", group: "appearance" },
  { name: "borderColor", type: "color", default: "gray-300", group: "appearance" },
  { name: "opacity", type: "select", options: ["100", "90", "80", "70", "60", "50", "40", "30", "20", "10", "0"], default: "100", group: "appearance" },

  // Spacing
  { name: "padding", type: "select", options: ["0", "1", "2", "3", "4", "6", "8", "12", "16"], default: "0", group: "spacing" },
];

export const TEXT_PROPERTIES: PropertyDefinition[] = [
  { name: "size", type: "select", options: ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"], default: "base", group: "text" },
  { name: "weight", type: "select", options: ["thin", "light", "normal", "medium", "semibold", "bold", "black"], default: "normal", group: "text" },
  { name: "color", type: "color", default: "gray-900", group: "text" },
  { name: "align", type: "select", options: ["left", "center", "right"], default: "left", group: "text" },
];

export const POSITION_PROPERTIES: PropertyDefinition[] = [
  { name: "position", type: "select", options: ["fill", "center", "top", "top-left", "top-right", "bottom", "bottom-left", "bottom-right", "left", "right"], group: "position" },
  { name: "offset", type: "select", options: ["0", "1", "2", "3", "4", "6", "8", "12", "16"], default: "0", group: "position" },
];
