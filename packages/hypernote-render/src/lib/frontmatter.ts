/**
 * Frontmatter schema definition
 * Single source of truth for valid frontmatter keys and their expected types.
 * Used by both the renderer and the validator.
 */

import { SPACING_MAP, type SpacingValue } from "./styles";

/** All recognized frontmatter keys and their value descriptions */
export const FRONTMATTER_SCHEMA = {
  // Page identity
  title: "string",
  name: "string",

  // Canvas styling
  bg: "string",
  bgMode: "enum:cover,tile,contain",
  color: "string",
  padding: "spacing",
  overflow: "enum:auto,hidden,scroll,visible",
  aspect: "string",
  canvas: "object",

  // Nostr data queries
  profile: "string",
  event: "string",
  address: "object",
  filter: "object",

  // Interactive
  form: "object",
  actions: "object",
  imports: "object",
} as const;

export type FrontmatterKey = keyof typeof FRONTMATTER_SCHEMA;

export const KNOWN_FRONTMATTER_KEYS = new Set<string>(
  Object.keys(FRONTMATTER_SCHEMA)
);

export const VALID_BG_MODES = ["cover", "tile", "contain"] as const;
export type BgMode = (typeof VALID_BG_MODES)[number];

export const VALID_OVERFLOW_VALUES = ["auto", "hidden", "scroll", "visible"] as const;
export type CanvasOverflow = (typeof VALID_OVERFLOW_VALUES)[number];

/** Default canvas values */
export const CANVAS_DEFAULTS = {
  padding: "4" as SpacingValue,
  overflow: "auto" as CanvasOverflow,
  bgMode: "cover" as BgMode,
} as const;

/**
 * Extract canvas properties from parsed frontmatter.
 * Supports both root-level keys and nested canvas.* keys.
 */
export function extractCanvasProps(frontmatter: Record<string, any> | null) {
  if (!frontmatter) {
    return {
      bg: undefined as string | undefined,
      bgMode: CANVAS_DEFAULTS.bgMode,
      color: undefined as string | undefined,
      padding: CANVAS_DEFAULTS.padding as string,
      overflow: CANVAS_DEFAULTS.overflow as CanvasOverflow,
    };
  }

  return {
    bg: (frontmatter.canvas?.bg ?? frontmatter.bg) as string | undefined,
    bgMode: (frontmatter.canvas?.bgMode ?? frontmatter.bgMode ?? CANVAS_DEFAULTS.bgMode) as BgMode,
    color: (frontmatter.canvas?.color ?? frontmatter.color) as string | undefined,
    padding: (frontmatter.canvas?.padding ?? frontmatter.padding ?? CANVAS_DEFAULTS.padding) as string,
    overflow: (frontmatter.canvas?.overflow ?? frontmatter.overflow ?? CANVAS_DEFAULTS.overflow) as CanvasOverflow,
  };
}
