import { init, parse } from "zig-mdx";
import type { AST } from "zig-mdx";

export async function parseMdx(source: string): Promise<AST> {
  // This will only take time the first time it is called
  await init("./mdx.wasm");
  return parse(source);
}
