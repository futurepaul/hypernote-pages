import { useMemo } from "react";
import { usePage } from "./nostr";
import { parseAddress } from "../lib/nip19";

export function useComponent(naddr: string | undefined) {
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
      return JSON.parse(event.content);
    } catch (e) {
      console.warn("Failed to parse component:", e);
      return undefined;
    }
  }, [isValid, event]);
}

export function useComponents(
  imports: Record<string, string> | undefined
): Record<string, any> {
  const importEntries = useMemo(
    () => Object.entries(imports ?? {}),
    [imports]
  );

  const component0 = usePage(importEntries[0]?.[1] ?? "");
  const component1 = usePage(importEntries[1]?.[1] ?? "");
  const component2 = usePage(importEntries[2]?.[1] ?? "");
  const component3 = usePage(importEntries[3]?.[1] ?? "");

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
