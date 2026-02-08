import index from "./index.html";
import { resolve } from "path";
import { fetchPageEvent, eventStore, pool } from "./ssr/fetchPage";
import { renderPageToString } from "./ssr/renderPage";
import YAML from "yaml";
import { extractCanvasProps, parseColor, detectBgType } from "@futurepaul/hypernote";

const server = Bun.serve({
  routes: {
    "/mdx.wasm": () => {
      console.log("Serving mdx.wasm");
      const file = Bun.file(resolve(import.meta.dir, "../public/mdx.wasm"));
      console.log(file);
      return new Response(file.stream());
    },
    // Internal route: SSR fetches this to get the Bun-bundled HTML template
    "/__ssr_template": index,
    "/hn/:id": async (req): Promise<Response> => {
      const naddr = req.params.id;

      // Get Bun-processed HTML (hashed assets + HMR) via self-fetch
      const bundled = await fetch(`http://localhost:${server.port}/__ssr_template`);

      try {
        const event = await fetchPageEvent(naddr);
        if (!event) {
          return bundled;
        }

        const ast = JSON.parse(event.content);

        // Extract frontmatter from the AST
        let frontmatter: Record<string, any> | null = null;
        if (ast.children) {
          const fmNode = ast.children.find((n: any) => n.type === "frontmatter");
          if (fmNode?.value) {
            try {
              frontmatter = YAML.parse(fmNode.value);
            } catch {}
          }
        }

        const title = frontmatter?.title || "Hypernote Page";
        const description = frontmatter?.title
          ? `A hypernote page: ${frontmatter.title}`
          : "A hypernote page";

        // Render static HTML from the AST using React SSR
        const ssrHtml = renderPageToString(ast, frontmatter, eventStore, pool);

        // Inject meta tags + SSR content into the bundled HTML
        const rewriter = new HTMLRewriter()
          .on("title", {
            element(el) {
              el.setInnerContent(title);
            },
          })
          .on("head", {
            element(el) {
              el.append(
                `<meta property="og:title" content="${escapeAttr(title)}">` +
                `<meta property="og:description" content="${escapeAttr(description)}">` +
                `<meta name="description" content="${escapeAttr(description)}">` +
                `<meta property="og:type" content="website">`,
                { html: true },
              );
            },
          })
          .on("#root", {
            element(el) {
              el.setInnerContent(ssrHtml, { html: true });
            },
          })
          .on("body", {
            element(el) {
              // Embed the event so the client can seed its EventStore immediately
              // Escape </script> in content to prevent premature tag closing
              const json = JSON.stringify(event).replace(/<\//g, "<\\/");
              el.prepend(
                `<script id="__SSR_EVENT__" type="application/json">${json}</script>`,
                { html: true },
              );

              // Set canvas background on body so it persists through React mount
              const canvas = extractCanvasProps(frontmatter);
              const bodyStyles: string[] = [];
              if (canvas.bg) {
                const bgType = detectBgType(canvas.bg);
                if (bgType === "color") {
                  const bgColor = parseColor(canvas.bg);
                  if (bgColor) bodyStyles.push(`background-color:${bgColor}`);
                }
              }
              if (canvas.color) {
                const textColor = parseColor(canvas.color);
                if (textColor) bodyStyles.push(`color:${textColor}`);
              }
              if (bodyStyles.length > 0) {
                el.setAttribute("style", bodyStyles.join(";"));
              }
            },
          });

        const transformed = rewriter.transform(bundled);

        // Fix headers: body changed so stale etag/content-length are wrong
        const headers = new Headers(transformed.headers);
        headers.delete("content-length");
        headers.delete("etag");
        headers.set("content-type", "text/html; charset=utf-8");

        return new Response(transformed.body, {
          status: transformed.status,
          headers,
        });
      } catch (e) {
        console.error("[SSR] Error:", e);
        return bundled;
      }
    },
    // Serve index.html for all unmatched routes (SPA fallback)
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },

  port: 3423,
});

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

console.log(`🚀 Server running at ${server.url}`);
