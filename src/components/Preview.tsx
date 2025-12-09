import type { AST } from "zig-mdx";
import yaml from "yaml";
import { useMemo } from "react";
import { NodeRenderer } from "@/components/NodeRenderer";
import { usePageContext, ScopeProvider } from "@/hooks/usePageContext";
import {
  type CanvasConfig,
  parseColor,
  detectBgType,
  ASPECT_MAP,
} from "@/lib/styles";

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

  // Extract canvas config - support both `canvas: { aspect, bg }` and root-level `aspect`, `bg`
  const canvas: CanvasConfig = {
    aspect: frontmatter?.canvas?.aspect ?? frontmatter?.aspect,
    bg: frontmatter?.canvas?.bg ?? frontmatter?.bg,
  };

  // One hook for everything - returns unified scope
  const scope = usePageContext(frontmatter);

  // Resolve canvas styles
  const canvasStyles = useMemo(() => {
    const styles: React.CSSProperties = {
      position: "relative",
      width: "100%",
      overflow: "hidden",
    };

    // Aspect ratio
    if (canvas.aspect && canvas.aspect !== "flexible") {
      const aspectValue = ASPECT_MAP[canvas.aspect];
      if (aspectValue) {
        styles.aspectRatio = aspectValue;
      }
    }

    // Background
    if (canvas.bg) {
      const bgType = detectBgType(canvas.bg);
      if (bgType === "color") {
        const color = parseColor(canvas.bg);
        if (color) {
          styles.backgroundColor = color;
        }
      }
      // Image and video backgrounds are handled in JSX below
    }

    return styles;
  }, [canvas]);

  const bgType = canvas.bg ? detectBgType(canvas.bg) : null;

  const isFixedAspect = canvas.aspect && canvas.aspect !== "flexible";

  return (
    <div className="border rounded-sm shadow-2xl bg-neutral-200 text-neutral-800 overflow-hidden flex flex-col"
      style={{ maxWidth: isFixedAspect ? "400px" : "100%" }}
    >
      <div className="p-2 border-b border-neutral-300 shrink-0">
        <h2 className="font-bold text-center">{frontmatter?.title || "Untitled"}</h2>
        {naddr && (
          <div className="text-sm text-neutral-500">
            <button onClick={() => navigator.clipboard.writeText(naddr)}>Copy naddr</button>
          </div>
        )}
      </div>

      {parseError && <div className="text-red-500 p-2">{parseError}</div>}

      {/* Canvas wrapper with aspect ratio and background */}
      <div
        style={canvasStyles}
        className={isFixedAspect ? "" : "overflow-y-auto"}
      >
        {/* Background image */}
        {bgType === "image" && canvas.bg && (
          <img
            src={canvas.bg}
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
        {bgType === "video" && canvas.bg && (
          <video
            src={canvas.bg}
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
            position: isFixedAspect ? "absolute" : "relative",
            inset: isFixedAspect ? 0 : undefined,
            zIndex: 1,
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            overflow: isFixedAspect ? "hidden" : undefined,
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

      <div className="p-2 border-t border-neutral-300 max-h-64 overflow-y-auto shrink-0">
        <pre className="text-xs bg-neutral-900 text-neutral-200 p-4 rounded-sm whitespace-pre-wrap break-all">
          {JSON.stringify(ast, null, 2)}
        </pre>
      </div>
    </div>
  );
}
