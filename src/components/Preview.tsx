import type { AST } from "zig-mdx";
import yaml from "yaml";
import { useEffect, useState, useMemo, useCallback } from "react";
import { NodeRenderer } from "@/components/NodeRenderer";
import { useNostrQuery, type NostrQuery } from "@/hooks/useNostrQuery";
import { useComponents } from "@/hooks/useComponent";
import { FormContext } from "@/components/FormContext";
import { useNostr } from "@/components/NostrContext";
import { evaluate, type EvaluationScope } from "@/lib/evaluator";
import { DEFAULT_RELAYS } from "@/lib/relays";

export function Preview({ ast, naddr, parseError }: { ast: AST; naddr?: string; parseError?: string | null }) {
  const nostr = useNostr();
  const [frontmatter, setFrontmatter] = useState<Record<string, any> | null>(
    null
  );
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    const fmNode = ast.children.find((child) => child.type === "frontmatter");
    if (fmNode?.value) {
      try {
        const parsed = yaml.parse(fmNode.value);
        setFrontmatter(parsed);
      } catch {
        // Keep old frontmatter on parse error
      }
    }
  }, [ast]);

  // Parse query from frontmatter
  const query = useMemo<NostrQuery | undefined>(() => {
    if (!frontmatter) return undefined;

    // Handle different query types based on frontmatter
    if (frontmatter.profile) {
      return { type: "profile", pubkey: frontmatter.profile };
    }
    if (frontmatter.event) {
      return { type: "event", id: frontmatter.event };
    }
    if (frontmatter.address) {
      return {
        type: "address",
        kind: frontmatter.address.kind,
        pubkey: frontmatter.address.pubkey,
        identifier: frontmatter.address.identifier,
      };
    }
    if (frontmatter.filter) {
      return { type: "timeline", filter: frontmatter.filter };
    }

    return undefined;
  }, [frontmatter]);

  // ONE HOOK - get the data
  const queryResult = useNostrQuery(query);

  // Load imported components from frontmatter
  const importedComponents = useComponents(frontmatter?.imports);

  // Form update callback
  const updateForm = useCallback((name: string, value: string) => {
    setFormState(prev => ({ ...prev, [name]: value }));
  }, []);

  // Build scope for evaluations (used by form init and actions)
  const scope: EvaluationScope = useMemo(() => ({
    props: {},
    queries: {
      profile: query?.type === "profile" ? queryResult : undefined,
      event: query?.type === "event" ? (Array.isArray(queryResult) ? queryResult[0] : queryResult) : undefined,
      events: query?.type === "timeline" ? queryResult : undefined,
      address: query?.type === "address" ? queryResult : undefined,
    },
    state: frontmatter ?? {},
    form: formState,
    user: nostr.pubkey ?? undefined,
    item: undefined,
    index: 0,
    components: importedComponents,
  }), [query, queryResult, frontmatter, formState, nostr.pubkey, importedComponents]);

  // Initialize form from frontmatter defaults (runs once when frontmatter loads)
  useEffect(() => {
    if (!frontmatter?.form) return;
    const defaults: Record<string, string> = {};
    for (const [key, value] of Object.entries(frontmatter.form)) {
      if (typeof value === "string") {
        defaults[key] = value;
      }
    }
    setFormState(prev => {
      // Only set defaults for keys not already set
      const updated = { ...prev };
      for (const [k, v] of Object.entries(defaults)) {
        if (updated[k] === undefined) updated[k] = v;
      }
      return updated;
    });
  }, [frontmatter?.form]);

  // Resolve form defaults that reference queries (after data loads)
  useEffect(() => {
    if (!frontmatter?.form || !queryResult) return;
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(frontmatter.form)) {
      if (typeof value === "string" && (value.startsWith("queries.") || value.startsWith("state."))) {
        const result = evaluate(value, scope);
        if (result !== undefined && result !== null) {
          resolved[key] = String(result);
        }
      }
    }
    if (Object.keys(resolved).length > 0) {
      setFormState(prev => {
        const updated = { ...prev };
        for (const [k, v] of Object.entries(resolved)) {
          // Only set if empty or undefined
          if (!updated[k]) updated[k] = v;
        }
        return updated;
      });
    }
  }, [queryResult, frontmatter?.form, scope]);

  // Execute an action defined in frontmatter
  const executeAction = useCallback(async (actionName: string) => {
    const actionDef = frontmatter?.actions?.[actionName];
    if (!actionDef) {
      console.warn(`Unknown action: ${actionName}`);
      return;
    }

    if (nostr.isReadonly) {
      alert("Login with extension to publish");
      return;
    }

    setIsPublishing(true);
    try {
      // Resolve kind
      const kind = typeof actionDef.kind === "number" ? actionDef.kind : parseInt(actionDef.kind, 10);

      // Resolve content - can be form.x, state.x, queries.x, or literal
      let content = resolveActionValue(actionDef.content, scope);

      // Handle base merging (for profile updates etc)
      if (actionDef.base) {
        const baseResult = evaluate(actionDef.base, scope);
        let baseObj: Record<string, any> = {};
        if (typeof baseResult === "string") {
          try { baseObj = JSON.parse(baseResult); } catch {}
        } else if (typeof baseResult === "object" && baseResult) {
          baseObj = baseResult;
        }

        // If content is object-like, merge with base
        let contentObj: Record<string, any> = {};
        if (typeof content === "string" && content.trim().startsWith("{")) {
          try { contentObj = JSON.parse(content); } catch {}
        } else if (typeof content === "object" && content) {
          contentObj = content;
        }

        // Merge and re-stringify
        const merged = { ...baseObj, ...contentObj };
        // Remove empty strings
        for (const k of Object.keys(merged)) {
          if (merged[k] === "") delete merged[k];
        }
        content = JSON.stringify(merged);
      } else if (typeof content === "object") {
        content = JSON.stringify(content);
      }

      // Resolve tags
      const tags: string[][] = [];
      if (actionDef.tags) {
        for (const tag of actionDef.tags) {
          const resolvedTag = tag.map((v: any) => String(resolveActionValue(v, scope)));
          tags.push(resolvedTag);
        }
      }

      // Build and sign event
      const eventTemplate = {
        kind,
        content: String(content),
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signed = await nostr.signer.signEvent(eventTemplate);
      const published = await nostr.pool.publish(DEFAULT_RELAYS, signed);

      if (published.length === 0) {
        throw new Error("Failed to publish to any relay");
      }

      // Clear form if requested
      if (actionDef.clear) {
        setFormState({});
      }
    } catch (error) {
      console.error("Action failed:", error);
      alert(error instanceof Error ? error.message : "Action failed");
    } finally {
      setIsPublishing(false);
    }
  }, [frontmatter?.actions, scope, nostr]);

  return (
    <div className="border rounded-sm shadow-2xl bg-neutral-200 text-neutral-800 overflow-hidden max-w-full">
      <div className="p-2 border-b border-neutral-300">
        <h2 className="font-bold text-center">
          {frontmatter?.title || "Untitled"}
        </h2>
        {naddr && (
          <div className="text-sm text-neutral-500">
            <button onClick={() => navigator.clipboard.writeText(naddr)}>
              Copy naddr
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-h-full text-neutral-800 overflow-x-hidden overflow-y-auto">
        {parseError && <div className="text-red-500">{parseError}</div>}
        <div className="p-4 break-words">
          <FormContext.Provider value={{ form: formState, updateForm, executeAction, isPublishing }}>
            <NodeRenderer
              node={{ type: "root", children: ast.children }}
              key="root"
              keyName="root"
              scope={scope}
            />
          </FormContext.Provider>
        </div>
      </div>
      <div className="p-2 border-t border-neutral-300 max-h-64 overflow-y-auto">
        <pre className="text-xs bg-neutral-900 text-neutral-200 p-4 rounded-sm whitespace-pre-wrap break-all">
          {JSON.stringify(ast, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/**
 * Resolve a value from action definition - handles form.x, state.x, queries.x, special values
 */
function resolveActionValue(value: any, scope: EvaluationScope): any {
  // Handle object content defined in YAML (recurse into properties)
  if (typeof value === "object" && value !== null) {
    const resolved: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveActionValue(v, scope);
    }
    return resolved;
  }

  // Non-strings pass through
  if (typeof value !== "string") return value;

  // Special values
  if (value === "now") return Math.floor(Date.now() / 1000);
  if (value === "user" || value === "user.pubkey") return scope.user;

  // References - use the evaluator
  if (value.startsWith("form.") || value.startsWith("state.") || value.startsWith("queries.")) {
    return evaluate(value, scope);
  }

  return value;
}
