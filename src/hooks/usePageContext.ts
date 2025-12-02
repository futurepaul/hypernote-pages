import { useState, useCallback, useEffect, useMemo, createContext, useContext } from "react";
import { useNostr } from "@/components/NostrContext";
import { useNostrQuery, type NostrQuery } from "@/hooks/useNostrQuery";
import { useComponents } from "@/hooks/useComponent";
import { evaluate, type EvaluationScope } from "@/lib/evaluator";
import { DEFAULT_RELAYS } from "@/lib/relays";

// Context for builtins to access scope
const ScopeContext = createContext<EvaluationScope | null>(null);
export const ScopeProvider = ScopeContext.Provider;
export const useScope = () => {
  const scope = useContext(ScopeContext);
  if (!scope) throw new Error("useScope must be used within ScopeProvider");
  return scope;
};

/**
 * Single hook that manages the entire page context.
 * Returns a unified scope object with data AND functions.
 */
export function usePageContext(frontmatter: Record<string, any> | null): EvaluationScope {
  const nostr = useNostr();
  const [form, setForm] = useState<Record<string, string>>({});
  const [isPublishing, setIsPublishing] = useState(false);

  // Build query from frontmatter
  const query = useMemo<NostrQuery | undefined>(() => {
    if (!frontmatter) return undefined;
    if (frontmatter.profile) return { type: "profile", pubkey: frontmatter.profile };
    if (frontmatter.event) return { type: "event", id: frontmatter.event };
    if (frontmatter.address) return { type: "address", ...frontmatter.address };
    if (frontmatter.filter) return { type: "timeline", filter: frontmatter.filter };
    return undefined;
  }, [frontmatter]);

  // Fetch data and components
  const queryResult = useNostrQuery(query);
  const components = useComponents(frontmatter?.imports);

  // Build queries object
  const queries = useMemo(() => ({
    profile: query?.type === "profile" ? queryResult : undefined,
    event: query?.type === "event" ? (Array.isArray(queryResult) ? queryResult[0] : queryResult) : undefined,
    events: query?.type === "timeline" ? queryResult : undefined,
    address: query?.type === "address" ? queryResult : undefined,
  }), [query, queryResult]);

  // Update a form field
  const updateForm = useCallback((name: string, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  // Initialize form from frontmatter defaults
  useEffect(() => {
    if (!frontmatter?.form) return;
    const defaults: Record<string, string> = {};
    for (const [key, value] of Object.entries(frontmatter.form)) {
      if (typeof value === "string" && !value.startsWith("queries.") && !value.startsWith("state.")) {
        defaults[key] = value;
      }
    }
    setForm(prev => {
      const updated = { ...prev };
      for (const [k, v] of Object.entries(defaults)) {
        if (updated[k] === undefined) updated[k] = v;
      }
      return updated;
    });
  }, [frontmatter?.form]);

  // Resolve form defaults that reference queries
  useEffect(() => {
    if (!frontmatter?.form) return;
    const hasQueries = queries && Object.values(queries).some(v => v !== undefined);
    if (!hasQueries) return;

    // Build a minimal scope for evaluation
    const evalScope = { queries, state: frontmatter, form, updateForm, executeAction: async () => {}, isPublishing: false } as EvaluationScope;

    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(frontmatter.form)) {
      if (typeof value === "string" && (value.startsWith("queries.") || value.startsWith("state."))) {
        const result = evaluate(value, evalScope);
        if (result !== undefined && result !== null) {
          resolved[key] = String(result);
        }
      }
    }
    if (Object.keys(resolved).length > 0) {
      setForm(prev => {
        const updated = { ...prev };
        for (const [k, v] of Object.entries(resolved)) {
          if (!updated[k]) updated[k] = v;
        }
        return updated;
      });
    }
  }, [queries, frontmatter?.form]);

  // Execute an action (uses current form/queries directly, not scope)
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
      // Build scope for resolving values
      const evalScope = { queries, state: frontmatter, form, user: nostr.pubkey, updateForm, executeAction: async () => {}, isPublishing: true } as EvaluationScope;

      const kind = typeof actionDef.kind === "number" ? actionDef.kind : parseInt(actionDef.kind, 10);
      let content = resolveValue(actionDef.content, evalScope);

      // Handle base merging
      if (actionDef.base) {
        const baseResult = evaluate(actionDef.base, evalScope);
        let baseObj: Record<string, any> = {};
        if (typeof baseResult === "string") {
          try { baseObj = JSON.parse(baseResult); } catch {}
        } else if (typeof baseResult === "object" && baseResult) {
          baseObj = baseResult;
        }

        let contentObj: Record<string, any> = {};
        if (typeof content === "string" && content.trim().startsWith("{")) {
          try { contentObj = JSON.parse(content); } catch {}
        } else if (typeof content === "object" && content) {
          contentObj = content;
        }

        const merged = { ...baseObj, ...contentObj };
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
          tags.push(tag.map((v: any) => String(resolveValue(v, evalScope))));
        }
      }

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

      if (actionDef.clear) {
        setForm({});
      }
    } catch (error) {
      console.error("Action failed:", error);
      alert(error instanceof Error ? error.message : "Action failed");
    } finally {
      setIsPublishing(false);
    }
  }, [frontmatter, queries, form, nostr]);

  // Return unified scope with everything
  return useMemo<EvaluationScope>(() => ({
    props: {},
    queries,
    state: frontmatter ?? {},
    form,
    user: nostr.pubkey ?? undefined,
    item: undefined,
    index: 0,
    components,
    updateForm,
    executeAction,
    isPublishing,
  }), [queries, frontmatter, form, nostr.pubkey, components, updateForm, executeAction, isPublishing]);
}

/** Resolve action values - handles form.x, state.x, queries.x, objects, special values */
function resolveValue(value: any, scope: EvaluationScope): any {
  if (typeof value === "object" && value !== null) {
    const resolved: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveValue(v, scope);
    }
    return resolved;
  }
  if (typeof value !== "string") return value;
  if (value === "now") return Math.floor(Date.now() / 1000);
  if (value === "user" || value === "user.pubkey") return scope.user;
  if (value.startsWith("form.") || value.startsWith("state.") || value.startsWith("queries.")) {
    return evaluate(value, scope);
  }
  return value;
}
