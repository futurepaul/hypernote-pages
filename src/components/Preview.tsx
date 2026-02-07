import type { AST } from "zig-mdx";
import yaml from "yaml";
import { useMemo } from "react";
import { HypernotePreview } from "hypernote-render";

interface PreviewProps {
  ast: AST;
  naddr?: string;
  parseError?: string | null;
  /** "feed" constrains to 50vh-100vh (Instagram-style), "fullpage" gives full viewport */
  mode?: "feed" | "fullpage";
  /** Hide the title bar */
  hideTitle?: boolean;
}

export function Preview({ ast, naddr, parseError, mode = "feed", hideTitle = false }: PreviewProps) {
  // Parse frontmatter from AST for title display
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

  return (
    <div className="border rounded-sm shadow-2xl bg-neutral-200 text-neutral-800 overflow-hidden max-w-full">
      {!hideTitle && (
        <div className="p-2 border-b border-neutral-300">
          <h2 className="font-bold text-center">{frontmatter?.title || "Untitled"}</h2>
          {naddr && (
            <div className="text-sm text-neutral-500">
              <button onClick={() => navigator.clipboard.writeText(naddr)}>Copy naddr</button>
            </div>
          )}
        </div>
      )}

      {parseError && <div className="text-red-500 p-2">{parseError}</div>}

      {/* Canvas wrapper with mode-specific height */}
      <div style={mode === "feed" ? { height: "70vh", overflow: "hidden" } : undefined}>
        <HypernotePreview ast={ast} />
      </div>
    </div>
  );
}
