import { usePage } from "@/hooks/nostr";
import type { AST } from "zig-mdx";
import yaml from "yaml";
import { useMemo, useEffect } from "react";
import { NodeRenderer } from "@/components/NodeRenderer";
import { usePageContext, ScopeProvider } from "@/hooks/usePageContext";
import { parseColor, detectBgType, SPACING_MAP, type SpacingValue } from "@/lib/styles";

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
  const title = frontmatter?.title || "Untitled";

  // Extract bg, bgMode, color, and padding from frontmatter
  const bg: string | undefined = frontmatter?.canvas?.bg ?? frontmatter?.bg;
  const bgMode: "cover" | "tile" | "contain" = frontmatter?.canvas?.bgMode ?? frontmatter?.bgMode ?? "cover";
  const color: string | undefined = frontmatter?.canvas?.color ?? frontmatter?.color;
  const padding: string | undefined = frontmatter?.canvas?.padding ?? frontmatter?.padding;

  const styles = useMemo(() => {
    const s: React.CSSProperties = {};

    if (bg) {
      const bgType = detectBgType(bg);
      if (bgType === "color") {
        const bgColor = parseColor(bg);
        if (bgColor) s.backgroundColor = bgColor;
      } else if (bgType === "image") {
        s.backgroundImage = `url(${bg})`;
        if (bgMode === "tile") {
          s.backgroundRepeat = "repeat";
          s.backgroundSize = "auto";
        } else if (bgMode === "contain") {
          s.backgroundSize = "contain";
          s.backgroundPosition = "center";
          s.backgroundRepeat = "no-repeat";
        } else {
          // cover (default)
          s.backgroundSize = "cover";
          s.backgroundPosition = "center";
          s.backgroundRepeat = "no-repeat";
        }
      }
    }

    if (color) {
      const textColor = parseColor(color);
      if (textColor) s.color = textColor;
    }

    if (padding) {
      s.padding = SPACING_MAP[padding as SpacingValue] ?? padding;
    }

    return s;
  }, [bg, bgMode, color, padding]);

  useEffect(() => {
    document.title = title;
    return () => {
      document.title = "Hypernote Pages";
    };
  }, [title]);

  return (
    <div className="min-h-screen max-h-screen bg-neutral-200 text-neutral-800" style={styles}>
      <ScopeProvider value={scope}>
        <NodeRenderer
          node={{ type: "root", children: ast.children }}
          key="root"
          keyName="root"
          scope={scope}
        />
      </ScopeProvider>
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
