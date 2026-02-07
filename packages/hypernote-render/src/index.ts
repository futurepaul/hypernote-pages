/**
 * hypernote-render
 * Parse, validate, and render Hypernote pages (.hnmd)
 */

// Parsing
export { parseHnmd, parseHnmdFile, parseHnmdWithPositions } from "./parse";
export type { AST } from "./parse";

// Validation
export { validate } from "./validate";
export type { ValidationResult, ValidationError, ValidationWarning } from "./validate";

// React components
export { HypernotePreview } from "./components/HypernotePreview";
export { NodeRenderer } from "./components/NodeRenderer";
export { NostrProvider } from "./components/NostrContext";
export type { NostrProviderProps, NostrContextValue } from "./components/NostrContext";
export { builtinComponents } from "./lib/builtins";

// Styles
export {
  parseColor,
  resolveContainerStyles,
  resolveTextStyles,
  resolveImgStyles,
  SPACING_MAP,
  TEXT_SIZE_MAP,
  WEIGHT_MAP,
  ROUNDED_MAP,
} from "./lib/styles";

// Frontmatter
export {
  FRONTMATTER_SCHEMA,
  KNOWN_FRONTMATTER_KEYS,
  VALID_BG_MODES,
  VALID_OVERFLOW_VALUES,
  CANVAS_DEFAULTS,
  extractCanvasProps,
} from "./lib/frontmatter";
export type { FrontmatterKey, BgMode, CanvasOverflow } from "./lib/frontmatter";

// Evaluator
export { evaluate, parseAttributes } from "./lib/evaluator";
export type { EvaluationScope } from "./lib/evaluator";
