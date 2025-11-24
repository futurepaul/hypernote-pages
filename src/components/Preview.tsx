import type { AST } from "zig-mdx";
import yaml from "yaml";
import { useEffect, useState } from "react";
import { NodeRenderer } from "@/components/NodeRenderer";

export function Preview({ ast, naddr, parseError }: { ast: AST; naddr?: string; parseError?: string | null }) {
  const [frontmatter, setFrontmatter] = useState<Record<string, any> | null>(
    null
  );

  useEffect(() => {
    if (ast.children.find((child) => child.type === "frontmatter")) {
      const frontmatter = ast.children.find(
        (child) => child.type === "frontmatter"
      )?.value;
      if (frontmatter) {
        const parsedFrontmatter = yaml.parse(frontmatter);
        setFrontmatter(parsedFrontmatter);
      }
    }
  }, [ast]);

  return (
    <div className="border rounded-sm shadow-2xl bg-neutral-200 text-neutral-800 overflow-hidden">
      <div className="p-2 border-b border-neutral-300">
        <h2 className="font-bold text-center">
          {frontmatter?.title || "Untitled"}
        </h2>
        {naddr && (
          <div className="text-sm text-neutral-500">
            <button onClick={() => navigator.clipboard.writeText(naddr)}>
              Copy naddr
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-h-full text-neutral-800 overflow-x-hidden overflow-y-auto">
        {parseError && <div className="text-red-500">{parseError}</div>}
        <div className="p-4">
          <NodeRenderer
            node={{ type: "root", children: ast.children }}
            key="root"
            keyName="root"
            scope={{
              props: {},
              queries: {},
              state: frontmatter ?? {},
              form: {},
              user: undefined,
              item: undefined,
              index: 0,
            }}
          />
        </div>
      </div>
      <div className="p-2 border-t border-neutral-300 max-h-64 overflow-y-auto">
        <pre className="text-xs bg-neutral-900 text-neutral-200 p-4 rounded-sm whitespace-pre-wrap break-all">
          {JSON.stringify(ast, null, 2)}
        </pre>
      </div>
    </div>
  );
}
