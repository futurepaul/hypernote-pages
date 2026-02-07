/**
 * Frontend for hypernote-render preview server
 * Fetches AST from /api/page and renders with HypernotePreview
 * Listens for WebSocket reload messages
 */

import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import { NostrProvider } from "./components/NostrContext";
import { HypernotePreview } from "./components/HypernotePreview";
import type { AST } from "zig-mdx";

function App() {
  const [ast, setAst] = useState<AST | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  // Fetch page data
  async function fetchPage() {
    try {
      const res = await fetch("/api/page");
      const data = await res.json();
      if (data.ast) {
        setAst(data.ast);
        setFileName(data.file || "");
        setError(null);
      } else {
        setError("No AST in response");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch page");
    }
  }

  // Initial load
  useEffect(() => {
    fetchPage();
  }, []);

  // WebSocket for hot reload
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "reload") {
          fetchPage();
        }
      } catch {}
    };

    ws.onclose = () => {
      // Try to reconnect after a delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    };

    return () => ws.close();
  }, []);

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "#ef4444" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Error</h1>
        <pre style={{ background: "#fef2f2", padding: "1rem", borderRadius: "0.5rem" }}>
          {error}
        </pre>
      </div>
    );
  }

  if (!ast) {
    return (
      <div style={{ padding: "2rem", color: "#6b7280" }}>
        Loading...
      </div>
    );
  }

  return (
    <NostrProvider>
      <HypernotePreview ast={ast} />
    </NostrProvider>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
