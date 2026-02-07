/**
 * Hypernote parsing utilities
 * Wraps zig-mdx for both CLI (Bun) and browser usage
 */

import { init, parse, parseWithPositions } from "zig-mdx";
import type { AST } from "zig-mdx";
import { resolve } from "path";

let initialized = false;

/**
 * Initialize the WASM module for CLI usage
 * In browser, zig-mdx auto-initializes from a URL
 * In CLI, we need to load the WASM file from disk
 */
async function ensureInit() {
  if (initialized) return;

  // Try to load WASM from the zig-mdx package
  const wasmPath = resolve(
    import.meta.dir,
    "../node_modules/zig-mdx/dist/mdx.wasm"
  );

  try {
    const file = Bun.file(wasmPath);
    const buffer = await file.arrayBuffer();
    await init(buffer);
    initialized = true;
  } catch {
    // Fallback: let zig-mdx try its default initialization
    await init();
    initialized = true;
  }
}

/**
 * Parse a .hnmd source string into an AST
 */
export async function parseHnmd(source: string): Promise<AST> {
  await ensureInit();
  return parse(source);
}

/**
 * Parse with position information (for editors)
 */
export async function parseHnmdWithPositions(source: string): Promise<AST> {
  await ensureInit();
  return parseWithPositions(source);
}

/**
 * Parse a .hnmd file from disk
 */
export async function parseHnmdFile(filePath: string): Promise<AST> {
  const file = Bun.file(filePath);
  const source = await file.text();
  return parseHnmd(source);
}

export type { AST };
