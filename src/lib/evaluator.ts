export interface EvaluationScope {
  props?: Record<string, any>;
  queries?: Record<string, any>;
  state?: Record<string, any>;
  form?: Record<string, any>;
  // User pubkey
  user?: string;
  // For <each> contexts
  item?: any;
  index?: number;
  // Imported components
  // TODO: do we need this?
  // components?: Record<string, ParsedComponent>;
}
/**
 * Evaluate an expression against a scope
 *
 * @example
 * evaluate("note.content", { note: { content: "Hello" } }) // "Hello"
 * evaluate("note.content | truncate(10)", { note: { content: "Hello World" } }) // "Hello Worl"
 * evaluate("profile.name // 'Anon'", { profile: {} }) // "Anon"
 */
export function evaluate(expression: string, scope: EvaluationScope): any {
    if (!expression || typeof expression !== "string") {
      return undefined;
    }
  
    // Remove curly braces if present
    const cleaned = expression.trim().replace(/^{|}$/g, "").trim();
  
    // Split by default operator (//)
    const defaultParts = splitByDefault(cleaned);
  
    // Try each part until we get a truthy value
    for (const part of defaultParts) {
      const result = evaluatePart(part.trim(), scope);
      if (result !== undefined && result !== null && result !== "") {
        return result;
      }
    }
  
    return undefined;
  }
  
  /**
   * Split expression by // operator (not inside strings or function calls)
   */
  function splitByDefault(expr: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;
    let inString = false;
    let stringChar = "";
  
    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];
      const next = expr[i + 1];
  
      // Handle strings
      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }
  
      if (char === stringChar && inString) {
        inString = false;
        current += char;
        continue;
      }
  
      if (inString) {
        current += char;
        continue;
      }
  
      // Handle depth (parentheses, brackets)
      if (char === "(" || char === "[" || char === "{") {
        depth++;
      }
      if (char === ")" || char === "]" || char === "}") {
        depth--;
      }
  
      // Split on // at depth 0
      if (char === "/" && next === "/" && depth === 0) {
        parts.push(current);
        current = "";
        i++; // Skip next /
        continue;
      }
  
      current += char;
    }
  
    parts.push(current);
    return parts.filter((p) => p.trim());
  }
  
  /**
   * Evaluate a single part (without default operator)
   */
  function evaluatePart(expr: string, scope: EvaluationScope): any {
    // Split by pipe operator
    const pipeParts = splitByPipe(expr);

    if (!pipeParts || pipeParts.length === 0 || !pipeParts[0]) {
      return undefined;
    }

    // Start with the first part (the value)
    let value = resolveValue(pipeParts[0].trim(), scope);
  
    // Apply filters
    for (let i = 1; i < pipeParts.length; i++) {
        let item = pipeParts[i];
        if (!item || !item.trim()) {
          continue;
        }

      const filterExpr = item.trim();
      value = applyFilter(filterExpr, value, scope);
    }
  
    return value;
  }
  
  /**
   * Split expression by | operator (not inside strings or function calls)
   */
  function splitByPipe(expr: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;
    let inString = false;
    let stringChar = "";
  
    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];
  
      // Handle strings
      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }
  
      if (char === stringChar && inString) {
        inString = false;
        current += char;
        continue;
      }
  
      if (inString) {
        current += char;
        continue;
      }
  
      // Handle depth
      if (char === "(" || char === "[" || char === "{") {
        depth++;
      }
      if (char === ")" || char === "]" || char === "}") {
        depth--;
      }
  
      // Split on | at depth 0
      if (char === "|" && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
  
      current += char;
    }
  
    parts.push(current);
    return parts.filter((p) => p.trim());
  }
  
  /**
   * Resolve a value from scope (e.g., "note.content", "queries.notes.[0]")
   */
  function resolveValue(path: string, scope: EvaluationScope): any {
    // Handle literals
    if (path.startsWith('"') || path.startsWith("'")) {
      return path.slice(1, -1); // Remove quotes
    }
  
    if (path.trim() === "true") return true;
    if (path.trim() === "false") return false;
    if (path.trim() === "null") return null;
    if (path.trim() === "undefined") return undefined;
  
    // Try to parse as number
    const num = Number(path);
    if (!isNaN(num) && path.trim() !== "") {
      return num;
    }
  
    // Resolve from scope
    const parts = parsePath(path);
    let current: any = scope;
  
    console.log("🔍 resolveValue - path:", path, "parts:", parts, "scope keys:", Object.keys(scope), "scope:", scope);
  
    for (const part of parts) {
      console.log("  → stepping into part:", part, "current:", current, "current[part]:", current?.[part]);
  
      if (current === undefined || current === null) {
        console.log("  ⚠️ current is null/undefined, stopping");
        return undefined;
      }
  
      if (typeof part === "number") {
        // Array index
        current = current[part];
      } else {
        // Property access
        current = current[part];
      }
    }
  
    console.log("  ✅ final result:", current);
    return current;
  }
  
  /**
   * Parse a path string into parts
   * "note.content" -> ["note", "content"]
   * "queries.notes.[0]" -> ["queries", "notes", 0]
   * "queries.event?.pubkey" -> ["queries", "event", "pubkey"] (strip optional chaining)
   */
  function parsePath(path: string): (string | number)[] {
    // First, normalize optional chaining by removing all ? characters
    // queries.event?.pubkey -> queries.event.pubkey
    const normalized = path.replace(/\?/g, "");
  
    const parts: (string | number)[] = [];
    let current = "";
    let inBracket = false;
  
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
  
      if (char === ".") {
        if (current) {
          parts.push(current);
          current = "";
        }
        continue;
      }
  
      if (char === "[") {
        if (current) {
          parts.push(current);
          current = "";
        }
        inBracket = true;
        continue;
      }
  
      if (char === "]") {
        if (inBracket && current) {
          const index = parseInt(current, 10);
          if (!isNaN(index)) {
            parts.push(index);
          }
          current = "";
        }
        inBracket = false;
        continue;
      }
  
      current += char;
    }
  
    if (current) {
      parts.push(current);
    }
  
    return parts;
  }
  
  /**
   * Apply a filter to a value
   */
  function applyFilter(filterExpr: string, value: any, scope: EvaluationScope): any {
    // Parse filter name and args
    const parenIndex = filterExpr.indexOf("(");
  
    let filterName: string;
    let argsStr: string | undefined;
  
    if (parenIndex === -1) {
      // No arguments
      filterName = filterExpr.trim();
    } else {
      // Has arguments
      filterName = filterExpr.slice(0, parenIndex).trim();
      const closeParenIndex = filterExpr.lastIndexOf(")");
      argsStr = filterExpr.slice(parenIndex + 1, closeParenIndex).trim();
    }
  
    // Parse arguments
    const args: any[] = [];
    if (argsStr) {
      // Simple argument parsing (comma-separated)
      const argParts = argsStr.split(",").map((a) => a.trim());
      for (const arg of argParts) {
        args.push(resolveValue(arg, scope));
      }
    }
  
    // Apply filter
    return applyBuiltinFilter(filterName, value, args);
  }
  
  /**
   * Built-in filters
   */
  function applyBuiltinFilter(name: string, value: any, args: any[]): any {
    switch (name) {
      case "first":
        return Array.isArray(value) ? value[0] : value;
  
      case "last":
        return Array.isArray(value) ? value[value.length - 1] : value;
  
      case "fromjson":
        if (typeof value === "string") {
          try {
            return JSON.parse(value);
          } catch {
            return undefined;
          }
        }
        return value;
  
      case "format_date": {
        const timestamp = typeof value === "number" ? value : parseInt(value, 10);
        if (isNaN(timestamp)) return value;
  
        const date = new Date(timestamp * 1000); // Nostr timestamps are in seconds
        const format = args[0] || "datetime";
  
        if (format === "datetime") {
          return date.toLocaleString();
        } else if (format === "date") {
          return date.toLocaleDateString();
        } else if (format === "time") {
          return date.toLocaleTimeString();
        } else if (format === "relative") {
          return formatRelativeTime(timestamp);
        }
  
        return date.toLocaleString();
      }
  
      case "truncate": {
        const length = args[0] || 100;
        if (typeof value !== "string") return value;
        if (value.length <= length) return value;
        return value.slice(0, length - 3) + "...";
      }
  
      case "uppercase":
        return typeof value === "string" ? value.toUpperCase() : value;
  
      case "lowercase":
        return typeof value === "string" ? value.toLowerCase() : value;
  
      case "length":
        if (Array.isArray(value)) return value.length;
        if (typeof value === "string") return value.length;
        return 0;
  
      default:
        console.warn(`Unknown filter: ${name}`);
        return value;
    }
  }
  
  /**
   * Format a timestamp as relative time (e.g., "2 hours ago")
   */
  function formatRelativeTime(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
  
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 604800)}w ago`;
  }

  /**
 * Parse JSX attributes and evaluate expressions
 */
export function parseAttributes(attributes: any[], scope: EvaluationScope): Record<string, any> {
    const result: Record<string, any> = {};
  
    for (const attr of attributes) {
      const name = attr.name;
      const value = attr.value;
      const attrType = attr.type; // "literal" or "expression"
  
      if (!name) continue;
  
      if (!value) {
        result[name] = true; // Boolean attribute
        continue;
      }
  
      // Use the type field from zig-mdx to determine if it's a literal or expression
      if (attrType === "literal") {
        // String literal like as="note" or gap="12px"
        result[name] = value;
      } else if (attrType === "expression") {
        // Expression like from={queries.notes}
        try {
          const evaluated = evaluate(value, scope);
          console.log(`📊 parseAttributes - ${name}={${value}} -> `, evaluated, "scope.queries:", scope.queries);
          result[name] = evaluated;
        } catch (error) {
          console.warn(`[parseAttributes] Failed to evaluate ${name}={${value}}:`, error);
          result[name] = undefined;
        }
      } else {
        // Fallback for older AST format without type field
        if (typeof value === "string") {
          // Check if it looks like an expression
          if (value.includes(".") || value.includes("[")) {
            try {
              result[name] = evaluate(value, scope);
            } catch {
              result[name] = value;
            }
          } else {
            result[name] = value;
          }
        } else {
          result[name] = value;
        }
      }
    }
  
    return result;
  }