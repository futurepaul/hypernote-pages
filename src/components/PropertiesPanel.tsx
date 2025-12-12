import { nodeAtOffset, type AST, type Node, type JsxAttribute } from "@/lib/wasm";
import {
  CONTAINER_PROPERTIES,
  ZSTACK_PROPERTIES,
  TEXT_PROPERTIES,
  type PropertyDefinition,
} from "@/lib/styles";

interface Props {
  ast: AST | null;
  cursorOffset: number;
  source: string;
  onSourceChange: (newSource: string) => void;
}

// Map component names to their property definitions
const COMPONENT_PROPERTIES: Record<string, PropertyDefinition[]> = {
  vstack: CONTAINER_PROPERTIES,
  hstack: CONTAINER_PROPERTIES,
  zstack: ZSTACK_PROPERTIES,
  text: TEXT_PROPERTIES,
  img: [
    { name: "src", type: "text", group: "appearance" },
    { name: "alt", type: "text", group: "appearance" },
    { name: "fit", type: "select", options: ["contain", "cover", "fill", "none"], default: "contain", group: "appearance" },
    { name: "width", type: "select", options: ["auto", "fit", "half", "full"], default: "auto", group: "size" },
    { name: "height", type: "select", options: ["auto", "fit", "half", "full"], default: "auto", group: "size" },
    { name: "rounded", type: "select", options: ["none", "sm", "md", "lg", "xl", "2xl", "full"], default: "none", group: "appearance" },
    { name: "opacity", type: "select", options: ["100", "90", "80", "70", "60", "50", "40", "30", "20", "10", "0"], default: "100", group: "appearance" },
  ],
};

// Group labels for display
const GROUP_LABELS: Record<string, string> = {
  layout: "Layout",
  size: "Size",
  appearance: "Appearance",
  spacing: "Spacing",
  text: "Text",
  alignment: "Alignment",
};

export function PropertiesPanel({ ast, cursorOffset, source, onSourceChange }: Props) {
  if (!ast) {
    return <div className="text-neutral-500 text-sm">No AST</div>;
  }

  const node = nodeAtOffset(ast, cursorOffset);

  if (!node) {
    return (
      <div className="text-neutral-500 text-sm">
        <div>Offset: {cursorOffset}</div>
        <div>No node at cursor</div>
      </div>
    );
  }

  // Check if this is a JSX element we can edit
  const isJsxElement = node.type === "mdx_jsx_element" || node.type === "mdx_jsx_self_closing";
  const componentName = isJsxElement && "name" in node ? (node.name as string)?.toLowerCase() : null;
  const properties = componentName ? COMPONENT_PROPERTIES[componentName] : null;

  return (
    <div className="text-sm space-y-3">
      <div>
        <div className="text-xs uppercase text-neutral-400 mb-1">Node Type</div>
        <div className="text-purple-400 font-mono">{node.type}</div>
        {componentName && "name" in node && (
          <div className="text-neutral-300 text-xs mt-1">
            {"<"}{String(node.name)}{">"}
          </div>
        )}
      </div>

      {isJsxElement && properties && "attributes" in node && (
        <PropertyEditor
          node={node as JsxNode}
          properties={properties}
          source={source}
          onSourceChange={onSourceChange}
        />
      )}

      {!isJsxElement && <NodeProperties node={node} />}
    </div>
  );
}

type JsxNode = {
  type: "mdx_jsx_element" | "mdx_jsx_self_closing";
  name: string;
  attributes: JsxAttribute[];
  position?: { start: number; end: number };
};

interface PropertyEditorProps {
  node: JsxNode;
  properties: PropertyDefinition[];
  source: string;
  onSourceChange: (newSource: string) => void;
}

function PropertyEditor({ node, properties, source, onSourceChange }: PropertyEditorProps) {
  // Get current attribute values
  const currentAttrs = new Map<string, string>();
  for (const attr of node.attributes) {
    if (attr.value !== undefined) {
      currentAttrs.set(attr.name, attr.value);
    }
  }

  // Group properties by group
  const grouped = new Map<string, PropertyDefinition[]>();
  for (const prop of properties) {
    const group = prop.group;
    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group)!.push(prop);
  }

  const handlePropertyChange = (propName: string, value: string | null) => {
    if (!node.position) return;

    const hasAttr = currentAttrs.has(propName);
    const isDefault = value === null || value === "";

    if (isDefault && !hasAttr) {
      // No change needed
      return;
    }

    // We need to modify the source
    // Strategy: rebuild the opening tag with updated attributes
    const tagStart = node.position.start;

    // Find the end of the opening tag (before children or self-closing)
    // We need to find either ">" or "/>" after the tag name and attributes
    let tagEnd = tagStart;
    let depth = 0;
    let inString = false;
    let stringChar = "";

    for (let i = tagStart; i < source.length; i++) {
      const char = source[i];

      if (inString) {
        if (char === stringChar && source[i - 1] !== "\\") {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === "{") {
        depth++;
        continue;
      }

      if (char === "}") {
        depth--;
        continue;
      }

      if (depth === 0) {
        if (char === ">") {
          tagEnd = i + 1;
          break;
        }
        if (char === "/" && source[i + 1] === ">") {
          tagEnd = i + 2;
          break;
        }
      }
    }

    // Extract the opening tag
    const openingTag = source.slice(tagStart, tagEnd);
    const isSelfClosing = openingTag.trimEnd().endsWith("/>");

    // Build new attributes
    const newAttrs = new Map(currentAttrs);
    if (isDefault) {
      newAttrs.delete(propName);
    } else {
      newAttrs.set(propName, value!);
    }

    // Rebuild the tag
    let newTag = `<${node.name}`;
    for (const [name, val] of newAttrs) {
      newTag += ` ${name}="${val}"`;
    }
    newTag += isSelfClosing ? " />" : ">";

    // Replace in source
    const newSource = source.slice(0, tagStart) + newTag + source.slice(tagEnd);
    onSourceChange(newSource);
  };

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([group, props]) => (
        <div key={group}>
          <div className="text-xs uppercase text-neutral-400 mb-2">
            {GROUP_LABELS[group] || group}
          </div>
          <div className="space-y-2">
            {props.map((prop) => (
              <PropertyInput
                key={prop.name}
                property={prop}
                value={currentAttrs.get(prop.name)}
                onChange={(value) => handlePropertyChange(prop.name, value)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface PropertyInputProps {
  property: PropertyDefinition;
  value: string | undefined;
  onChange: (value: string | null) => void;
}

function PropertyInput({ property, value, onChange }: PropertyInputProps) {
  const isSet = value !== undefined;
  const displayValue = value ?? property.default ?? "";

  const handleToggle = () => {
    if (isSet) {
      // Remove the property
      onChange(null);
    } else {
      // Add with default value
      onChange(property.default ?? "");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Enable/disable toggle */}
      <button
        onClick={handleToggle}
        className={`w-4 h-4 rounded border flex items-center justify-center text-xs
          ${isSet
            ? "bg-purple-600 border-purple-500 text-white"
            : "bg-neutral-700 border-neutral-600 text-neutral-500 hover:border-neutral-500"
          }`}
        title={isSet ? "Remove property" : "Add property"}
      >
        {isSet ? "✓" : ""}
      </button>

      {/* Property name */}
      <span className={`text-xs w-20 truncate ${isSet ? "text-neutral-200" : "text-neutral-500"}`}>
        {property.name}
      </span>

      {/* Value input */}
      {property.type === "select" && property.options ? (
        <select
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={!isSet}
          className={`flex-1 text-xs px-2 py-1 rounded border
            ${isSet
              ? "bg-neutral-700 border-neutral-600 text-neutral-200"
              : "bg-neutral-800 border-neutral-700 text-neutral-500"
            }`}
        >
          {property.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : property.type === "color" ? (
        <input
          type="text"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={!isSet}
          placeholder="e.g. blue-500"
          className={`flex-1 text-xs px-2 py-1 rounded border
            ${isSet
              ? "bg-neutral-700 border-neutral-600 text-neutral-200"
              : "bg-neutral-800 border-neutral-700 text-neutral-500"
            }`}
        />
      ) : (
        <input
          type="text"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={!isSet}
          className={`flex-1 text-xs px-2 py-1 rounded border
            ${isSet
              ? "bg-neutral-700 border-neutral-600 text-neutral-200"
              : "bg-neutral-800 border-neutral-700 text-neutral-500"
            }`}
        />
      )}
    </div>
  );
}

function NodeProperties({ node }: { node: Node }) {
  const props: Record<string, unknown> = {};

  // Extract relevant properties based on node type
  if ("value" in node) props.value = node.value;
  if ("url" in node) props.url = node.url;
  if ("level" in node) props.level = node.level;
  if ("lang" in node) props.lang = node.lang;
  if ("name" in node) props.name = node.name;
  if ("attributes" in node) props.attributes = node.attributes;

  const entries = Object.entries(props);
  if (entries.length === 0) return null;

  return (
    <div>
      <div className="text-xs uppercase text-neutral-400 mb-1">Properties</div>
      <div className="space-y-2">
        {entries.map(([key, value]) => (
          <div key={key}>
            <div className="text-neutral-500 text-xs">{key}</div>
            <div className="text-neutral-300 font-mono text-xs break-all">
              {typeof value === "string" ? (
                value.length > 100 ? value.slice(0, 100) + "..." : value
              ) : (
                <pre className="whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
