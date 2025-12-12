import type { AST } from "zig-mdx";
import yaml from "yaml";
import { useMemo } from "react";
import { NodeRenderer } from "@/components/NodeRenderer";
import { usePageContext, ScopeProvider } from "@/hooks/usePageContext";
import { parseColor, detectBgType } from "@/lib/styles";

export function Preview({ ast, naddr, parseError }: { ast: AST; naddr?: string; parseError?: string | null }) {
  // Parse frontmatter from AST
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

  // Extract bg from frontmatter (support both canvas.bg and root-level bg)
  const bg: string | undefined = frontmatter?.canvas?.bg ?? frontmatter?.bg;

  // One hook for everything - returns unified scope
  const scope = usePageContext(frontmatter);

  // Resolve canvas styles
  const canvasStyles = useMemo(() => {
    const styles: React.CSSProperties = {
      position: "relative",
      width: "100%",
    };

    // Background color
    if (bg) {
      const bgType = detectBgType(bg);
      if (bgType === "color") {
        const color = parseColor(bg);
        if (color) {
          styles.backgroundColor = color;
        }
      }
      // Image and video backgrounds are handled in JSX below
    }

    return styles;
  }, [bg]);

  const bgType = bg ? detectBgType(bg) : null;

  return (
    <div className="border rounded-sm shadow-2xl bg-neutral-200 text-neutral-800 overflow-hidden max-w-full">
      <div className="p-2 border-b border-neutral-300">
        <h2 className="font-bold text-center">{frontmatter?.title || "Untitled"}</h2>
        {naddr && (
          <div className="text-sm text-neutral-500">
            <button onClick={() => navigator.clipboard.writeText(naddr)}>Copy naddr</button>
          </div>
        )}
      </div>

      {parseError && <div className="text-red-500 p-2">{parseError}</div>}

      {/* Canvas wrapper with background */}
      <div style={canvasStyles} className="overflow-y-auto">
        {/* Background image */}
        {bgType === "image" && bg && (
          <img
            src={bg}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
            }}
          />
        )}

        {/* Background video */}
        {bgType === "video" && bg && (
          <video
            src={bg}
            autoPlay
            loop
            muted
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
            }}
          />
        )}

        {/* Content layer */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: "1rem",
          }}
          className="wrap-break-words"
        >
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

      <div className="p-2 border-t border-neutral-300 max-h-64 overflow-y-auto">
        <pre className="text-xs bg-neutral-900 text-neutral-200 p-4 rounded-sm whitespace-pre-wrap break-all">
          {JSON.stringify(ast, null, 2)}
        </pre>
      </div>
    </div>
  );
}
