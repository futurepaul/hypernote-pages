import { useMemo } from "react";
import { usePage } from "./nostr";
import { parseAddress } from "@/lib/nip19";

/**
 * Load a component by naddr
 * Returns the parsed AST or undefined if loading
 * Throws helpful error if naddr is invalid
 */
export function useComponent(naddr: string | undefined) {
  // Validate naddr format
  const isValid = useMemo(() => {
    if (!naddr) return false;
    try {
      parseAddress(naddr);
      return true;
    } catch {
      console.warn(`Invalid component naddr: ${naddr}`);
      return false;
    }
  }, [naddr]);

  const event = usePage(isValid ? naddr! : "");

  return useMemo(() => {
    if (!isValid || !event) return undefined;

    try {
      // Component content is stored as JSON AST
      return JSON.parse(event.content);
    } catch (e) {
      console.warn("Failed to parse component:", e);
      return undefined;
    }
  }, [isValid, event]);
}

/**
 * Load multiple components by naddr
 * Returns a map of component name -> AST
 */
export function useComponents(
  imports: Record<string, string> | undefined
): Record<string, any> {
  // We need to call hooks unconditionally, so we create a stable list of imports
  const importEntries = useMemo(
    () => Object.entries(imports ?? {}),
    [imports]
  );

  // Load each component - hooks must be called unconditionally
  // We'll use a single usePage call pattern that works with our constraints
  const component0 = usePage(importEntries[0]?.[1] ?? "");
  const component1 = usePage(importEntries[1]?.[1] ?? "");
  const component2 = usePage(importEntries[2]?.[1] ?? "");
  const component3 = usePage(importEntries[3]?.[1] ?? "");

  // Build the components map
  return useMemo(() => {
    const result: Record<string, any> = {};
    const events = [component0, component1, component2, component3];

    for (let i = 0; i < importEntries.length && i < 4; i++) {
      const [name, _naddr] = importEntries[i]!;
      const event = events[i];
      if (event) {
        try {
          result[name] = JSON.parse(event.content);
        } catch (e) {
          console.warn(`Failed to parse component ${name}:`, e);
        }
      }
    }

    return result;
  }, [importEntries, component0, component1, component2, component3]);
}
