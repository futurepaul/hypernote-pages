/**
 * Preview server for hypernote-render
 * Serves a .hnmd file with hot reload via WebSocket
 */

import { parseHnmdFile } from "./parse";
import { validate } from "./validate";
import { watch } from "fs";
import { resolve } from "path";
import index from "./serve-index.html";

export async function startServer(filePath: string, port: number = 3456, silent: boolean = false) {
  const absolutePath = resolve(filePath);
  let currentAst: any = null;
  let currentSource: string = "";

  // Parse the file initially
  async function loadFile() {
    try {
      currentSource = await Bun.file(absolutePath).text();
      currentAst = await parseHnmdFile(absolutePath);
      const result = validate(currentAst);
      if (!silent) {
        if (result.errors.length > 0) {
          console.log(`[hypernote] ${result.errors.length} error(s) in ${filePath}`);
          for (const e of result.errors) console.log(`  ${e.message}`);
        }
        if (result.warnings.length > 0) {
          for (const w of result.warnings) console.log(`  [warn] ${w.message}`);
        }
      }
      return true;
    } catch (e) {
      if (!silent) {
        console.error(`[hypernote] Failed to parse: ${e instanceof Error ? e.message : e}`);
      }
      return false;
    }
  }

  await loadFile();

  // Track connected WebSocket clients for hot reload
  const clients = new Set<any>();

  const wasmPath = resolve(import.meta.dir, "../node_modules/zig-mdx/dist/mdx.wasm");

  const server = Bun.serve({
    port,
    routes: {
      "/": index,
      "/api/page": () => {
        return Response.json({
          ast: currentAst,
          source: currentSource,
          file: filePath,
        });
      },
      "/mdx.wasm": () => {
        const file = Bun.file(wasmPath);
        return new Response(file.stream(), {
          headers: { "Content-Type": "application/wasm" },
        });
      },
    },
    fetch(req, server) {
      // Handle WebSocket upgrade
      if (req.url.endsWith("/ws")) {
        if (server.upgrade(req)) return;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws) {
        clients.add(ws);
      },
      message(_ws, _msg) {
        // No client -> server messages needed
      },
      close(ws) {
        clients.delete(ws);
      },
    },
    development: !silent && {
      hmr: true,
      console: true,
    },
  });

  // Watch the file for changes
  const watcher = watch(absolutePath, async (eventType) => {
    if (eventType === "change") {
      if (!silent) console.log(`[hypernote] File changed, reloading...`);
      await loadFile();
      // Notify all connected clients
      for (const client of clients) {
        try {
          client.send(JSON.stringify({ type: "reload" }));
        } catch {
          clients.delete(client);
        }
      }
    }
  });

  if (!silent) {
    console.log(`\n  hypernote-render preview server`);
    console.log(`  Serving: ${filePath}`);
    console.log(`  URL:     http://localhost:${port}\n`);
  }

  // Return server handle for programmatic usage
  return {
    stop() {
      watcher.close();
      server.stop();
    },
    port: server.port,
    url: `http://localhost:${server.port}`,
  };
}

// Allow running directly: bun src/serve.ts <file>
if (import.meta.main) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: bun src/serve.ts <file.hnmd>");
    process.exit(1);
  }
  await startServer(file);
}
