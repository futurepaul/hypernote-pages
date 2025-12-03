import { usePage } from "@/hooks/nostr";
import type { AST } from "zig-mdx";
import yaml from "yaml";
import { useMemo } from "react";
import { NodeRenderer } from "@/components/NodeRenderer";
import { usePageContext, ScopeProvider } from "@/hooks/usePageContext";

function IframePreview({ ast }: { ast: AST }) {
  const frontmatter = useMemo(() => {
    const fmNode = ast.children.find((child) => child.type === "frontmatter");
    if (fmNode?.value) {
      try {
        return yaml.parse(fmNode.value);
      } catch {
        return null;
      }
    }
    return null;
  }, [ast]);

  const scope = usePageContext(frontmatter);

  return (
    <div className="min-h-screen bg-neutral-200 text-neutral-800">
      <div className="p-2 border-b border-neutral-300">
        <h2 className="font-bold text-center">{frontmatter?.title || "Untitled"}</h2>
      </div>

      <div className="p-4 wrap-break-words">
        <ScopeProvider value={scope}>
          <NodeRenderer
            node={{ type: "root", children: ast.children }}
            key="root"
            keyName="root"
            scope={scope}
          />
        </ScopeProvider>
      </div>
    </div>
  );
}

export function IframeViewer({ id }: { id: string }) {
  const page = usePage(id);

  if (!page) {
    return (
      <div className="min-h-screen bg-neutral-200 flex items-center justify-center">
        <div className="text-neutral-500">Loading...</div>
      </div>
    );
  }

  return <IframePreview ast={JSON.parse(page.content)} />;
}
