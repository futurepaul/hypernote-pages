import type { AST, Node as MDXNode } from "zig-mdx";
import { memo, useEffect, useState } from "react";
import {
  evaluate,
  parseAttributes,
  type EvaluationScope,
} from "@/lib/evaluator";
import type {
  JsxElementNode,
  JsxSelfClosingNode,
} from "node_modules/zig-mdx/dist/types";

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
      // const result = evaluate(node.value, scope);
      // console.log("💬 mdx_text_expression - expression:", node.value, "result:", result, "scope.queries:", scope.queries);
      // return <>{String(result ?? "")}</>;
      return (
        <>
          Frontmatter: {JSON.stringify(scope?.state)} Expression:{" "}
          {evaluate(node.value, scope ?? {})}
        </>
      );
    }

    case "mdx_flow_expression": {
      return <>{evaluate(node.value, scope ?? {})}</>;
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
  console.log(
    "🎯 renderJsxComponent called - node.name:",
    node.name,
    "componentName:",
    componentName,
    "node.type:",
    node.type
  );

  const attrs = parseAttributes(node.attributes || [], scope);

  const children = node.children
    ? renderChildren(node.children, key, scope)
    : null;

  switch (componentName.toLowerCase()) {
    case "hstack":
      return <div className="flex flex-row gap-2">{children}</div>;

    case "vstack":
      return <div className="flex flex-col gap-2">{children}</div>;

    case "text":
      console.log("📝 Rendering <text> with children:", children);
      return <span className="text-component">{children}</span>;

    case "img":
      return (
        <img
          src={attrs.src}
          alt={attrs.alt || ""}
          width={attrs.width}
          className="inline-block"
        />
      );

    case "each": {
      const fromArray = attrs.from;
      const asName = attrs.as;

      // Handle loading state
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
            // Use stable key - try item.id, then item.pubkey, then index
            const key = item?.id || item?.pubkey || itemIndex;

            const itemScope = {
              ...scope,
              [asName]: item,
              index: itemIndex,
            };

            return <EachItem key={key} node={node} itemScope={itemScope} />;
          })}
        </>
      );
    }

    default: {
      // console.log("🔍 renderJsxComponent - componentName:", componentName, "available components:", Object.keys(components));

      // TODO: use global component registry
      //
      // // Check if it's a global component
      // if (components[componentName]) {
      //   console.log("✅ Found component in registry, calling ComponentRenderer with props:", attrs);
      //   const component = components[componentName];
      //   // Lazy import to avoid circular dependency
      //   const { ComponentRenderer } = require("./ComponentRenderer");
      //   return (
      //     <ComponentRenderer
      //       component={component}
      //       props={attrs}
      //     />
      //   );
      // }

      // Unknown component
      console.warn(
        `❌ Unknown JSX component: ${componentName}`,
        "attrs:",
        attrs,
        "children:",
        children
      );
      return <div className="unknown-component">{children}</div>;
    }
  }
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
  console.log(
    "🎯 renderJsxComponent called - node.name:",
    node.name,
    "componentName:",
    componentName,
    "node.type:",
    node.type
  );

  const attrs = parseAttributes(node.attributes || [], scope);
  switch (componentName.toLowerCase()) {
    case "img":
      return (
        <img
          src={attrs.src}
          alt={attrs.alt || ""}
          width={attrs.width}
          className="inline-block"
        />
      );
    default:
      return <div>Unknown self-closing component: {componentName}</div>;
  }
}
