/**
 * Standalone Hypernote Preview component
 * Renders a parsed AST with full Nostr support
 */

import type { AST } from "zig-mdx";
import yaml from "yaml";
import { useMemo } from "react";
import { NodeRenderer } from "./NodeRenderer";
import { usePageContext, ScopeProvider } from "../hooks/usePageContext";
import { parseColor, detectBgType, SPACING_MAP, type SpacingValue } from "../lib/styles";
import { extractCanvasProps } from "../lib/frontmatter";

interface HypernotePreviewProps {
  ast: AST;
}

export function HypernotePreview({ ast }: HypernotePreviewProps) {
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

  const { bg, bgMode, color, padding, overflow } = extractCanvasProps(frontmatter);

  const scope = usePageContext(frontmatter);

  // Resolve canvas styles
  const canvasStyles = useMemo(() => {
    const styles: React.CSSProperties = {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      overflow,
    };

    // Background
    if (bg) {
      const bgType = detectBgType(bg);
      if (bgType === "color") {
        const bgColor = parseColor(bg);
        if (bgColor) {
          styles.backgroundColor = bgColor;
        }
      } else if (bgType === "image") {
        styles.backgroundImage = `url(${bg})`;
        if (bgMode === "tile") {
          styles.backgroundRepeat = "repeat";
          styles.backgroundSize = "auto";
        } else if (bgMode === "contain") {
          styles.backgroundSize = "contain";
          styles.backgroundPosition = "center";
          styles.backgroundRepeat = "no-repeat";
        } else {
          styles.backgroundSize = "cover";
          styles.backgroundPosition = "center";
          styles.backgroundRepeat = "no-repeat";
        }
      }
    }

    // Text color
    if (color) {
      const textColor = parseColor(color);
      if (textColor) {
        styles.color = textColor;
      }
    }

    // Padding
    styles.padding = SPACING_MAP[padding as SpacingValue] ?? padding;

    return styles;
  }, [bg, bgMode, color, padding, overflow]);

  const bgType = bg ? detectBgType(bg) : null;

  return (
    <div style={canvasStyles}>
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
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minHeight: 0,
          overflowWrap: "break-word",
        }}
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
  );
}
