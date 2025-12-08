import { init, parse, parseWithPositions, render, nodeAtOffset } from "zig-mdx";
import type { AST, Node } from "zig-mdx";

export async function parseMdx(source: string): Promise<AST> {
  await init("/mdx.wasm");
  return parse(source);
}

export async function parseMdxWithPositions(source: string): Promise<AST> {
  await init("/mdx.wasm");
  return parseWithPositions(source);
}

export async function renderMdx(source: string): Promise<string> {
  await init("/mdx.wasm");
  return render(source);
}

export { nodeAtOffset };
export type { AST, Node };
