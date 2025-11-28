import type { AST, Node as MDXNode } from "zig-mdx";
import { memo } from "react";
import {
  evaluate,
  parseAttributes,
  type EvaluationScope,
} from "@/lib/evaluator";
import type {
  JsxElementNode,
  JsxSelfClosingNode,
} from "node_modules/zig-mdx/dist/types";
import { builtinComponents } from "@/lib/builtins";

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
          <h1 className="text-2xl font-bold">
            {renderChildren(node.children, key, scope)}
          </h1>
        );
      } else if (node.level === 2) {
        return (
          <h2 className="text-xl font-bold">
            {renderChildren(node.children, key, scope)}
          </h2>
        );
      } else if (node.level === 3) {
        return (
          <h3 className="text-lg font-bold">
            {renderChildren(node.children, key, scope)}
          </h3>
        );
      } else if (node.level === 4) {
        return (
          <h4 className="text-base font-bold">
            {renderChildren(node.children, key, scope)}
          </h4>
        );
      } else if (node.level === 5) {
        return (
          <h5 className="text-sm font-bold">
            {renderChildren(node.children, key, scope)}
          </h5>
        );
      } else if (node.level === 6) {
        return (
          <h6 className="text-xs font-bold">
            {renderChildren(node.children, key, scope)}
          </h6>
        );
      }
      return <div>Unknown heading level: {node.level}</div>;

    case "paragraph":
      return <p>{renderChildren(node.children, key, scope)}</p>;
    case "text":
      return <span>{node.value}</span>;
    case "list_ordered":
      return (
        <ol className="list-decimal">
          {renderChildren(node.children, key, scope)}
        </ol>
      );
    case "list_unordered":
      return (
        <ul className="list-disc">
          {renderChildren(node.children, key, scope)}
        </ul>
      );
    case "list_item":
      return (
        <li className="ml-4">{renderChildren(node.children, key, scope)}</li>
      );
    case "link":
      return <a href={node.url}>{renderChildren(node.children, key, scope)}</a>;

    case "image":
      const altText = node.children
        .map((child) => (child.type === "text" ? child.value : ""))
        .join(" ");
      return <img className="w-full" src={node.url} alt={altText} />;

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
      return <hr />;
    case "blockquote":
      return (
        <blockquote className="border-l border-neutral-500 pl-2">
          {renderChildren(node.children, key, scope)}
        </blockquote>
      );
    case "frontmatter":
      // Don't render frontmatter
      return null;
    // MDX STUFF!!!
    case "mdx_text_expression": {
      // Inline expression like {value}
      const result = evaluate(node.value, scope);
      return <>{String(result ?? "")}</>;
    }

    case "mdx_flow_expression": {
      // Block-level expression
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
      // Unknown node type... typescript thinks it's a "never"
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

  // Each is special - needs scope manipulation
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
          return <EachItem key={itemKey} node={node} itemScope={itemScope} />;
        })}
      </>
    );
  }

  // Check built-in components (case-insensitive lookup)
  const builtinKey = Object.keys(builtinComponents).find(
    (k) => k.toLowerCase() === componentName.toLowerCase()
  );
  if (builtinKey) {
    const BuiltinComponent = builtinComponents[builtinKey]!;
    return <BuiltinComponent {...attrs}>{children}</BuiltinComponent>;
  }

  // Check imported components from scope
  if (scope.components?.[componentName]) {
    const importedAst = scope.components[componentName];
    // Render imported component with props passed via scope
    return (
      <NodeRenderer
        node={importedAst}
        keyName={`${key}-imported`}
        scope={{ ...scope, props: attrs, components: {} }}
      />
    );
  }

  // Unknown component
  console.warn(`Unknown JSX component: ${componentName}`);
  return <div className="unknown-component">{children}</div>;
}

/**
 * Memoized component for each item in a list
 * Prevents re-rendering when other items change
 */
const EachItem = memo(
  ({
    node,
    key,
    itemScope,
  }: {
    node: JsxElementNode;
    key: string;
    itemScope: EvaluationScope;
  }) => {
    return (
      <div className="each-item">
        {renderChildren((node as any).children, key, itemScope)}
      </div>
    );
  },
  (prev, next) => {
    // Custom comparison - only re-render if the item itself changed
    // Compare the item by reference (nostr events are stable objects)
    // TODO: is this right? should we use ID? or key?
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

  // Check built-in components (case-insensitive lookup)
  const builtinKey = Object.keys(builtinComponents).find(
    (k) => k.toLowerCase() === componentName.toLowerCase()
  );
  if (builtinKey) {
    const BuiltinComponent = builtinComponents[builtinKey]!;
    return <BuiltinComponent {...attrs} />;
  }

  // Check imported components from scope
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
