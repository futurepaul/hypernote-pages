import type { AST, Node as MDXNode } from "zig-mdx";
import yaml from "yaml";
import { useEffect, useState } from "react";

function renderChildren(children: MDXNode[], key: string) {
  return children.map((child, index) => (
    <NodeRenderer key={`${key}-${index}`} node={child} keyName={`${key}-${index}`} />
  ));
}

function NodeRenderer({ node, keyName }: { node: MDXNode; keyName: string }) {
    const key = `${keyName}-${node.type}`;
  switch (node.type) {
    case "root":
      return <>{renderChildren(node.children, key)}</>;
    case "frontmatter":
      return <></>;
    case "strong":
      return <strong>{renderChildren(node.children, key)}</strong>;
    case "emphasis":
      return <em>{renderChildren(node.children, key)}</em>;
    case "link":
      return <a href={node.url}>{renderChildren(node.children, key)}</a>;
    case "image":
      // TODO: add alt text
      return <img className="w-full" src={node.url} alt="test alt text" />;
    case "code_block":
      return (
        <pre>
          <code>{node.value}</code>
        </pre>
      );
    case "code_inline":
      return <code>{node.value}</code>;
    case "text":
      return <span>{node.value}</span>;
    case "heading":
      if (node.level === 1) {
        return (
          <h1 className="text-2xl font-bold">
            {renderChildren(node.children, key)}
          </h1>
        );
      } else if (node.level === 2) {
        return (
          <h2 className="text-xl font-bold">
            {renderChildren(node.children, key)}
          </h2>
        );
      } else if (node.level === 3) {
        return (
          <h3 className="text-lg font-bold">
            {renderChildren(node.children, key)}
          </h3>
        );
      } else if (node.level === 4) {
        return (
          <h4 className="text-base font-bold">
            {renderChildren(node.children, key)}
          </h4>
        );
      } else if (node.level === 5) {
        return (
          <h5 className="text-sm font-bold">
            {renderChildren(node.children, key)}
          </h5>
        );
      } else if (node.level === 6) {
        return (
          <h6 className="text-xs font-bold">
            {renderChildren(node.children, key)}
          </h6>
        );
      }
      return <div>Unknown heading level: {node.level}</div>;
    case "paragraph":
      return <p>{renderChildren(node.children, key)}</p>;
    default:
      return <div>Unknown node type: {node.type}</div>;
  }
}

export function Preview({ ast, naddr }: { ast: AST, naddr?: string}) {
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
            <button onClick={() => navigator.clipboard.writeText(naddr)}>Copy naddr</button>
          </div>
        )}
      </div>

      <div className="w-full max-h-full text-neutral-800 overflow-x-hidden overflow-y-auto">
        <div className="p-4">
          <NodeRenderer
            node={{ type: "root", children: ast.children }}
            key="root"
            keyName="root"
          />

          {/* <pre className="bg-neutral-900 text-neutral-200 p-4 rounded-sm whitespace-pre-wrap break-all">
            {JSON.stringify(ast, null, 2)}
          </pre> */}
        </div>
      </div>
    </div>
  );
}
