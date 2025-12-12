import type { AST } from "zig-mdx";
import yaml from "yaml";
import { useMemo } from "react";
import { NodeRenderer } from "@/components/NodeRenderer";
import { usePageContext, ScopeProvider } from "@/hooks/usePageContext";
import { parseColor, detectBgType } from "@/lib/styles";

interface PreviewProps {
  ast: AST;
  naddr?: string;
  parseError?: string | null;
  /** "feed" constrains to 50vh-100vh (Instagram-style), "fullpage" gives full viewport */
  mode?: "feed" | "fullpage";
}

export function Preview({ ast, naddr, parseError, mode = "feed" }: PreviewProps) {
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

  // Resolve canvas styles based on mode
  const canvasStyles = useMemo(() => {
    const styles: React.CSSProperties = {
      position: "relative",
      width: "100%",
      // Flex container so children can use grow="1" and overflow="scroll"
      display: "flex",
      flexDirection: "column",
    };

    // Mode-specific height constraints
    if (mode === "feed") {
      // Instagram-style: fixed height container, children handle their own scrolling
      styles.height = "70vh";
      styles.overflow = "hidden"; // Don't scroll at this level - children scroll
    } else {
      // Full page: take full viewport
      styles.height = "100vh";
      styles.width = "100vw";
      styles.overflow = "hidden"; // Don't scroll at this level - children scroll
    }

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
  }, [bg, mode]);

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
      <div style={canvasStyles}>
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

        {/* Content layer - flex child that fills available space */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            minHeight: 0, // Critical: allows flex child to shrink below content size
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
