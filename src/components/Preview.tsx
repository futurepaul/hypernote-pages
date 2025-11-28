import type { AST } from "zig-mdx";
import yaml from "yaml";
import { useEffect, useState, useMemo } from "react";
import { NodeRenderer } from "@/components/NodeRenderer";
import { useNostrQuery, type NostrQuery } from "@/hooks/useNostrQuery";
import { useComponents } from "@/hooks/useComponent";

export function Preview({ ast, naddr, parseError }: { ast: AST; naddr?: string; parseError?: string | null }) {
  const [frontmatter, setFrontmatter] = useState<Record<string, any> | null>(
    null
  );

  useEffect(() => {
    const fmNode = ast.children.find((child) => child.type === "frontmatter");
    if (fmNode?.value) {
      try {
        const parsed = yaml.parse(fmNode.value);
        setFrontmatter(parsed);
      } catch {
        // Keep old frontmatter on parse error
      }
    }
  }, [ast]);

  // Parse query from frontmatter
  const query = useMemo<NostrQuery | undefined>(() => {
    if (!frontmatter) return undefined;

    // Handle different query types based on frontmatter
    if (frontmatter.profile) {
      return { type: "profile", pubkey: frontmatter.profile };
    }
    if (frontmatter.event) {
      return { type: "event", id: frontmatter.event };
    }
    if (frontmatter.address) {
      return {
        type: "address",
        kind: frontmatter.address.kind,
        pubkey: frontmatter.address.pubkey,
        identifier: frontmatter.address.identifier,
      };
    }
    if (frontmatter.filter) {
      return { type: "timeline", filter: frontmatter.filter };
    }

    return undefined;
  }, [frontmatter]);

  // ONE HOOK - get the data
  const queryResult = useNostrQuery(query);

  // Load imported components from frontmatter
  const importedComponents = useComponents(frontmatter?.imports);

  return (
    <div className="border rounded-sm shadow-2xl bg-neutral-200 text-neutral-800 overflow-hidden max-w-full">
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
        <div className="p-4 break-words">
          <NodeRenderer
            node={{ type: "root", children: ast.children }}
            key="root"
            keyName="root"
            scope={{
              props: {},
              queries: {
                // Put query result in scope based on query type
                profile: query?.type === "profile" ? queryResult : undefined,
                event: query?.type === "event" ? (Array.isArray(queryResult) ? queryResult[0] : queryResult) : undefined,
                events: query?.type === "timeline" ? queryResult : undefined,
                // Also support accessing by the address type
                address: query?.type === "address" ? queryResult : undefined,
              },
              state: frontmatter ?? {},
              form: {},
              user: undefined,
              item: undefined,
              index: 0,
              components: importedComponents,
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
