import { usePage, HypernotePreview } from "hypernote-render";
import type { AST } from "zig-mdx";
import yaml from "yaml";
import { useMemo, useEffect } from "react";

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

  const title = frontmatter?.title || "Untitled";

  useEffect(() => {
    document.title = title;
    return () => {
      document.title = "Hypernote Pages";
    };
  }, [title]);

  return (
    <div className="h-screen bg-neutral-200 text-neutral-800">
      <HypernotePreview ast={ast} />
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
