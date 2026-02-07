/**
 * Validation for .hnmd files
 * Checks parse errors, frontmatter validity, and component usage
 */

import type { AST, Node } from "zig-mdx";
import yaml from "yaml";
import { builtinComponents } from "./lib/builtins";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  frontmatter: Record<string, any> | null;
  components: string[]; // component names used in the document
}

export interface ValidationError {
  type: "parse" | "frontmatter" | "component";
  message: string;
  token?: number;
}

export interface ValidationWarning {
  type: "component" | "frontmatter" | "style";
  message: string;
}

const KNOWN_FRONTMATTER_KEYS = new Set([
  "title", "name",
  "bg", "bgMode", "color", "padding", "overflow", "aspect",
  "canvas",
  "profile", "event", "address", "filter",
  "form", "actions",
  "imports",
]);

const VALID_SPACING = new Set(["0", "1", "2", "3", "4", "6", "8", "12", "16"]);
const VALID_OVERFLOW = new Set(["visible", "hidden", "scroll", "auto"]);
const VALID_BG_MODE = new Set(["cover", "tile", "contain"]);

const BUILTIN_NAMES = new Set(
  Object.keys(builtinComponents).map(k => k.toLowerCase())
);
// "Each" is a special pseudo-component
BUILTIN_NAMES.add("each");

export function validate(ast: AST): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const componentsUsed = new Set<string>();

  // 1. Check parse errors
  if (ast.errors && ast.errors.length > 0) {
    for (const error of ast.errors) {
      errors.push({
        type: "parse",
        message: `Parse error: ${error.tag} at token ${error.token}`,
        token: error.token,
      });
    }
  }

  // 2. Extract and validate frontmatter
  let frontmatter: Record<string, any> | null = null;
  const fmNode = ast.children.find((child) => child.type === "frontmatter");
  if (fmNode?.value) {
    try {
      frontmatter = yaml.parse(fmNode.value);
    } catch (e) {
      errors.push({
        type: "frontmatter",
        message: `Invalid YAML in frontmatter: ${e instanceof Error ? e.message : "parse error"}`,
      });
    }
  }

  if (frontmatter) {
    // Check for unknown frontmatter keys
    for (const key of Object.keys(frontmatter)) {
      if (!KNOWN_FRONTMATTER_KEYS.has(key)) {
        warnings.push({
          type: "frontmatter",
          message: `Unknown frontmatter key: "${key}"`,
        });
      }
    }

    // Validate specific values
    if (frontmatter.padding && !VALID_SPACING.has(String(frontmatter.padding))) {
      warnings.push({
        type: "frontmatter",
        message: `Padding value "${frontmatter.padding}" is not in the spacing scale: ${[...VALID_SPACING].join(", ")}`,
      });
    }
    if (frontmatter.overflow && !VALID_OVERFLOW.has(frontmatter.overflow)) {
      warnings.push({
        type: "frontmatter",
        message: `Invalid overflow value: "${frontmatter.overflow}". Valid: ${[...VALID_OVERFLOW].join(", ")}`,
      });
    }
    if (frontmatter.bgMode && !VALID_BG_MODE.has(frontmatter.bgMode)) {
      warnings.push({
        type: "frontmatter",
        message: `Invalid bgMode value: "${frontmatter.bgMode}". Valid: ${[...VALID_BG_MODE].join(", ")}`,
      });
    }

    // Check that page has title or name
    if (!frontmatter.title && !frontmatter.name) {
      warnings.push({
        type: "frontmatter",
        message: "Frontmatter should have a 'title' (for pages) or 'name' (for components)",
      });
    }
  } else if (!fmNode) {
    warnings.push({
      type: "frontmatter",
      message: "No frontmatter found. Add a --- block at the top of the file.",
    });
  }

  // 3. Walk AST to find component usage
  walkNode(ast, (node) => {
    if (node.type === "mdx_jsx_element" || node.type === "mdx_jsx_self_closing") {
      const name = (node as any).name?.trim();
      if (name) {
        componentsUsed.add(name);

        // Check if component is known
        const isBuiltin = BUILTIN_NAMES.has(name.toLowerCase());
        const isImported = frontmatter?.imports && name in frontmatter.imports;

        if (!isBuiltin && !isImported) {
          warnings.push({
            type: "component",
            message: `Unknown component: <${name}>. Built-in components: ${Object.keys(builtinComponents).join(", ")}, Each`,
          });
        }
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    frontmatter,
    components: [...componentsUsed],
  };
}

function walkNode(node: any, visitor: (node: any) => void) {
  visitor(node);
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      walkNode(child, visitor);
    }
  }
}
