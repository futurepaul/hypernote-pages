import { nodeAtOffset, type AST, type Node } from "@/lib/wasm";

interface Props {
  ast: AST | null;
  cursorOffset: number;
}

export function PropertiesPanel({ ast, cursorOffset }: Props) {
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

  return (
    <div className="text-sm space-y-3">
      <div>
        <div className="text-xs uppercase text-neutral-400 mb-1">Cursor</div>
        <div className="text-neutral-300">Offset: {cursorOffset}</div>
      </div>

      <div>
        <div className="text-xs uppercase text-neutral-400 mb-1">Node Type</div>
        <div className="text-purple-400 font-mono">{node.type}</div>
      </div>

      {node.position && (
        <div>
          <div className="text-xs uppercase text-neutral-400 mb-1">Position</div>
          <div className="text-neutral-300 font-mono text-xs">
            {node.position.start} - {node.position.end}
          </div>
        </div>
      )}

      <NodeProperties node={node} />
    </div>
  );
}

function NodeProperties({ node }: { node: Node }) {
  const props: Record<string, any> = {};

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
