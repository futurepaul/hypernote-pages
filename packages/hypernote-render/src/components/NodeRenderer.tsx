import type { Node as MDXNode } from "zig-mdx";
import { memo } from "react";
import {
  evaluate,
  parseAttributes,
  type EvaluationScope,
} from "../lib/evaluator";
// These types aren't re-exported from zig-mdx main entry, so define locally
interface JsxAttribute {
  name: string;
  type: "literal" | "expression";
  value?: string;
}
interface JsxElementNode {
  type: "mdx_jsx_element";
  name: string;
  attributes: JsxAttribute[];
  children: MDXNode[];
}
interface JsxSelfClosingNode {
  type: "mdx_jsx_self_closing";
  name: string;
  attributes: JsxAttribute[];
}
import { builtinComponents } from "../lib/builtins";

function resolveLink(url: string): string {
  if (url.startsWith("nostr:")) {
    return `https://njump.me/${url.slice(6)}`;
  }
  if (url.startsWith("hn:")) {
    return `/hn/${url.slice(3)}`;
  }
  return url;
}

function renderChildren(
  children: MDXNode[],
  key: string,
  scope: EvaluationScope
) {
  return children.map((child, index) => (
    <NodeRenderer
      key={`${key}-${index}`}
      node={child}
      keyName={`${key}-${index}`}
      scope={scope ?? {}}
    />
  ));
}

export function NodeRenderer({
  node,
  keyName,
  scope,
}: {
  node: MDXNode;
  keyName: string;
  scope: EvaluationScope;
}) {
  const key = `${keyName}-${node.type}`;
  switch (node.type) {
    case "root":
      return <>{renderChildren(node.children, key, scope)}</>;
    case "heading":
      if (node.level === 1) {
        return (
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
            {renderChildren(node.children, key, scope)}
          </h1>
        );
      } else if (node.level === 2) {
        return (
          <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "1rem" }}>
            {renderChildren(node.children, key, scope)}
          </h2>
        );
      } else if (node.level === 3) {
        return (
          <h3 style={{ fontSize: "1.125rem", fontWeight: "bold", marginBottom: "1rem" }}>
            {renderChildren(node.children, key, scope)}
          </h3>
        );
      } else if (node.level === 4) {
        return (
          <h4 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem" }}>
            {renderChildren(node.children, key, scope)}
          </h4>
        );
      } else if (node.level === 5) {
        return (
          <h5 style={{ fontSize: "0.875rem", fontWeight: "bold", marginBottom: "1rem" }}>
            {renderChildren(node.children, key, scope)}
          </h5>
        );
      } else if (node.level === 6) {
        return (
          <h6 style={{ fontSize: "0.75rem", fontWeight: "bold", marginBottom: "1rem" }}>
            {renderChildren(node.children, key, scope)}
          </h6>
        );
      }
      return <div>Unknown heading level: {node.level}</div>;

    case "hard_break":
      return <br />;

    case "paragraph": {
      // Use <div> instead of <p> when children contain block-level elements (JSX components)
      // to avoid invalid HTML nesting like <p><div>...</div></p>
      const hasBlockChildren = node.children.some(
        (c) => c.type === "mdx_jsx_element" || c.type === "mdx_jsx_self_closing" || c.type === "mdx_flow_expression"
      );
      const Tag = hasBlockChildren ? "div" : "p";
      return <Tag style={{ marginBottom: "1rem" }}>{renderChildren(node.children, key, scope)}</Tag>;
    }
    case "text":
      return <span>{node.value}</span>;
    case "list_ordered":
      return (
        <ol style={{ listStyleType: "decimal", marginBottom: "1rem" }}>
          {renderChildren(node.children, key, scope)}
        </ol>
      );
    case "list_unordered":
      return (
        <ul style={{ listStyleType: "disc", marginBottom: "1rem" }}>
          {renderChildren(node.children, key, scope)}
        </ul>
      );
    case "list_item":
      return (
        <li style={{ marginLeft: "1rem" }}>{renderChildren(node.children, key, scope)}</li>
      );
    case "link":
      return <a href={resolveLink(node.url)}>{renderChildren(node.children, key, scope)}</a>;

    case "image":
      const altText = node.children
        .map((child) => (child.type === "text" ? child.value : ""))
        .join(" ");
      return <img style={{ width: "100%" }} src={node.url} alt={altText} />;

    case "strong":
      return <strong>{renderChildren(node.children, key, scope)}</strong>;
    case "emphasis":
      return <em>{renderChildren(node.children, key, scope)}</em>;
    case "code_inline":
      return <code>{node.value}</code>;
    case "code_block":
      return (
        <pre>
          <code>{node.value}</code>
        </pre>
      );
    case "hr":
      return <hr style={{ marginBottom: "1rem" }} />;
    case "blockquote":
      return (
        <blockquote style={{ borderLeft: "2px solid #6b7280", paddingLeft: "0.5rem" }}>
          {renderChildren(node.children, key, scope)}
        </blockquote>
      );
    case "frontmatter":
      return null;
    case "mdx_text_expression": {
      const result = evaluate(node.value, scope);
      return <>{String(result ?? "")}</>;
    }

    case "mdx_flow_expression": {
      const result = evaluate(node.value, scope);
      return <>{String(result ?? "")}</>;
    }

    case "mdx_jsx_element":
      return renderJsxElement(node, key, scope);
    case "mdx_jsx_self_closing":
      return renderJsxSelfClosing(node, key, scope);
    case "mdx_jsx_fragment":
      return <>{renderChildren(node.children, key, scope)}</>;

    default:
      const nodeType = (node as any).type;
      return <div>Unknown node type: {nodeType}</div>;
  }
}

function renderJsxElement(
  node: JsxElementNode,
  key: string,
  scope: EvaluationScope
) {
  const componentName = node.name.trim();
  const attrs = parseAttributes(node.attributes || [], scope);
  const children = node.children
    ? renderChildren(node.children, key, scope)
    : null;

  if (componentName.toLowerCase() === "each") {
    const fromArray = attrs.from;
    const asName = attrs.as;

    if (!fromArray || !Array.isArray(fromArray)) {
      return null;
    }
    if (!asName) {
      console.warn("[Each] 'as' attribute is required");
      return null;
    }

    return (
      <>
        {fromArray.map((item: any, itemIndex: number) => {
          const itemKey = item?.id || item?.pubkey || itemIndex;
          const itemScope = {
            ...scope,
            [asName]: item,
            index: itemIndex,
          };
          return <EachItem key={itemKey} keyName={String(itemKey)} node={node} itemScope={itemScope} />;
        })}
      </>
    );
  }

  const builtinKey = Object.keys(builtinComponents).find(
    (k) => k.toLowerCase() === componentName.toLowerCase()
  );
  if (builtinKey) {
    const BuiltinComponent = builtinComponents[builtinKey]!;
    return <BuiltinComponent {...attrs}>{children}</BuiltinComponent>;
  }

  if (scope.components?.[componentName]) {
    const importedAst = scope.components[componentName];
    return (
      <NodeRenderer
        node={importedAst}
        keyName={`${key}-imported`}
        scope={{ ...scope, props: attrs, components: {} }}
      />
    );
  }

  console.warn(`Unknown JSX component: ${componentName}`);
  return <div>{children}</div>;
}

const EachItem = memo(
  ({
    node,
    keyName,
    itemScope,
  }: {
    node: JsxElementNode;
    keyName: string;
    itemScope: EvaluationScope;
  }) => {
    return (
      <div>
        {renderChildren((node as any).children, keyName, itemScope)}
      </div>
    );
  },
  (prev, next) => {
    return prev.itemScope.item === next.itemScope.item;
  }
);

function renderJsxSelfClosing(
  node: JsxSelfClosingNode,
  key: string,
  scope: EvaluationScope
) {
  const componentName = node.name.trim();
  const attrs = parseAttributes(node.attributes || [], scope);

  const builtinKey = Object.keys(builtinComponents).find(
    (k) => k.toLowerCase() === componentName.toLowerCase()
  );
  if (builtinKey) {
    const BuiltinComponent = builtinComponents[builtinKey]!;
    return <BuiltinComponent {...attrs} />;
  }

  if (scope.components?.[componentName]) {
    const importedAst = scope.components[componentName];
    return (
      <NodeRenderer
        node={importedAst}
        keyName={`${key}-imported`}
        scope={{ ...scope, props: attrs, components: {} }}
      />
    );
  }

  return <div>Unknown self-closing component: {componentName}</div>;
}
