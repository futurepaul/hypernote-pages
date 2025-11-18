import { serve } from "bun";
import index from "./index.html";
import { resolve } from "path";

const server = serve({
  routes: {
    "/mdx.wasm": () => {
      console.log("Serving mdx.wasm");
      const file = Bun.file(resolve(import.meta.dir, "../public/mdx.wasm"));
      console.log(file);
      return new Response(file.stream());
    },
    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },

  port: 3423
});

console.log(`🚀 Server running at ${server.url}`);
