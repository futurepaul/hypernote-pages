import { useState, useCallback, useEffect, useMemo, createContext, useContext } from "react";
import { useNostr } from "../components/NostrContext";
import { useNostrQuery, type NostrQuery } from "./useNostrQuery";
import { useComponents } from "./useComponent";
import { evaluate, type EvaluationScope } from "../lib/evaluator";
import { DEFAULT_RELAYS } from "../lib/relays";

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

  // Execute an action — builds event from action def, signs with EventFactory, publishes
  const executeAction = useCallback(async (actionName: string) => {
    const actionDef = frontmatter?.actions?.[actionName];
    if (!actionDef) {
      console.warn(`Unknown action: ${actionName}`);
      return;
    }

    // If readonly, request login instead
    if (nostr.isReadonly) {
      nostr.requestLogin();
      return;
    }

    if (!nostr.factory) {
      console.warn("No EventFactory available");
      return;
    }

    setIsPublishing(true);
    try {
      // Build the evaluation scope for interpolating templates
      const evalScope: EvaluationScope = {
        props: {},
        queries,
        state: frontmatter ?? {},
        form,
        user: nostr.pubkey ?? undefined,
        components,
        updateForm,
        executeAction: async () => {},
        isPublishing: true,
      };

      // Resolve kind
      const kind = typeof actionDef.kind === "number"
        ? actionDef.kind
        : typeof actionDef.kind === "string"
          ? Number(evaluate(actionDef.kind, evalScope) ?? actionDef.kind)
          : 1;

      // Resolve content
      let content = "";
      if (typeof actionDef.content === "string") {
        content = String(evaluate(actionDef.content, evalScope) ?? actionDef.content);
      }

      // Resolve tags
      const tags: string[][] = [];
      if (Array.isArray(actionDef.tags)) {
        for (const tagDef of actionDef.tags) {
          if (!Array.isArray(tagDef)) continue;
          const resolvedTag = tagDef.map((part: any) => {
            if (typeof part === "string") {
              return String(evaluate(part, evalScope) ?? part);
            }
            return String(part);
          });
          tags.push(resolvedTag);
        }
      }

      // Build the event template
      const template = {
        kind,
        content,
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      // Sign with EventFactory (works with any signer type)
      const signed = await nostr.factory.sign(template);

      // Publish to relays
      const relays = actionDef.relays ?? DEFAULT_RELAYS;
      for (const relay of relays) {
        try {
          nostr.pool.relay(relay).publish(signed);
        } catch (e) {
          console.warn(`Failed to publish to ${relay}:`, e);
        }
      }

      // Add to local event store so it appears immediately
      nostr.eventStore.add(signed);

      // Clear form after successful publish
      if (actionDef.clearForm !== false) {
        setForm({});
      }
    } catch (e) {
      console.error(`Action "${actionName}" failed:`, e);
    } finally {
      setIsPublishing(false);
    }
  }, [frontmatter, nostr, queries, form, components, updateForm]);

  return useMemo<EvaluationScope>(() => ({
    props: {},
    queries,
    state: frontmatter ?? {},
    form,
    user: nostr?.pubkey ?? undefined,
    item: undefined,
    index: 0,
    components,
    updateForm,
    executeAction,
    isPublishing,
  }), [queries, frontmatter, form, nostr?.pubkey, components, updateForm, executeAction, isPublishing]);
}
