/**
 * Playwright browser tests for hypernote-render
 * Each example runs its own server instance on a unique port.
 */

import { test, expect } from "playwright/test";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn, type ChildProcess } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXAMPLES_DIR = resolve(__dirname, "../../../examples");

// Helper: start a hypernote server via bun subprocess
function startServer(exampleName: string, port: number) {
  const filePath = resolve(EXAMPLES_DIR, `${exampleName}.hnmd`);
  const script = `
    const { startServer } = await import("./src/serve.ts");
    await startServer("${filePath}", ${port}, true);
  `;

  const proc = spawn("bun", ["-e", script], {
    cwd: resolve(__dirname, ".."),
    stdio: "ignore",
  });

  return {
    url: `http://localhost:${port}`,
    async stop() {
      proc.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        proc.on("exit", () => resolve());
        // Fallback timeout
        setTimeout(() => {
          proc.kill("SIGKILL");
          resolve();
        }, 3000);
      });
    },
  };
}

// Wait for the server to be ready
async function waitForServer(url: string, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/page`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

// =============================================================================
// fun-debug-test-cases
// =============================================================================

test.describe("fun-debug-test-cases", () => {
  let server: ReturnType<typeof startServer>;

  test.beforeAll(async () => {
    server = startServer("fun-debug-test-cases", 4001);
    await waitForServer(server.url);
  });

  test.afterAll(async () => {
    await server.stop();
  });

  test("text in parentheses renders correctly", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    const body = page.locator("body");
    await expect(body).toContainText("(text inside a parens shouldn't disappear)");
  });

  test("italic and bold text render as <em> and <strong>", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    await expect(page.locator("em")).toContainText("this text should be italic");
    await expect(page.locator("strong").first()).toContainText("this text should be bold");
  });

  test("headers inside components work", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText("headers should work too");
  });

  test("links with special characters preserved", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    const link = page.locator('a[href="https://hypernote.club"]');
    await expect(link).toContainText("links shouln't disappear with an ! in them");
  });
});

// =============================================================================
// page-with-imports
// =============================================================================

test.describe("page-with-imports", () => {
  let server: ReturnType<typeof startServer>;

  test.beforeAll(async () => {
    server = startServer("page-with-imports", 4002);
    await waitForServer(server.url);
  });

  test.afterAll(async () => {
    await server.stop();
  });

  test("page heading visible", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText("This page uses components!");
  });

  test("profile component shows loading or loaded state", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    // Accept either loaded profile content or loading indicator
    const profileOrLoading = page.locator("text=Loading profile").or(page.locator("a"));
    await expect(profileOrLoading.first()).toBeVisible();
  });

  test("note component shows loading or loaded state", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    const noteOrLoading = page.locator("text=Loading note").or(
      page.locator('div[style*="border"]')
    );
    await expect(noteOrLoading.first()).toBeVisible();
  });

  test("surrounding text for imported component present", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("Here's an imported component");
  });
});

// =============================================================================
// pauls-homepage
// =============================================================================

test.describe("pauls-homepage", () => {
  let server: ReturnType<typeof startServer>;

  test.beforeAll(async () => {
    server = startServer("pauls-homepage", 4003);
    await waitForServer(server.url);
  });

  test.afterAll(async () => {
    await server.stop();
  });

  test("tiled background image", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    // The outermost canvas div (first child of #root) gets background styles
    const canvas = page.locator("#root > div").first();
    const style = await canvas.getAttribute("style");
    expect(style).toContain("repeat");
  });

  test("main heading visible", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    await expect(page.locator("h1").first()).toContainText(
      "Thank you for visiting my home page"
    );
  });

  test("banner image rendered", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    const banner = page.locator('img[alt="banner"]');
    await expect(banner).toBeVisible();
  });

  test("form input with placeholder", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    const input = page.locator('input[placeholder="Type a message..."]');
    await expect(input).toBeVisible();
  });

  test("send button visible", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    await expect(page.locator("button", { hasText: "Send" })).toBeVisible();
  });

  test("link text present", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    await expect(page.locator('a[href="https://paul.lol"]')).toContainText("my website");
    await expect(
      page.locator('a[href="https://creators.spotify.com/pod/profile/futurepaul/"]')
    ).toContainText("my podcast");
  });

  test("white text color from frontmatter", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    // The canvas div (first child of #root) gets the color style
    const canvas = page.locator("#root > div").first();
    const style = await canvas.getAttribute("style");
    // "white" resolves to #ffffff via parseColor
    expect(style).toMatch(/color:\s*(#ffffff|white|rgb\(255,\s*255,\s*255\))/);
  });
});

// =============================================================================
// whats-a-hypernote
// =============================================================================

test.describe("whats-a-hypernote", () => {
  let server: ReturnType<typeof startServer>;

  test.beforeAll(async () => {
    server = startServer("whats-a-hypernote", 4004);
    await waitForServer(server.url);
  });

  test.afterAll(async () => {
    await server.stop();
  });

  test("page title heading visible", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    await expect(page.locator("h1").first()).toContainText("What's a Hypernote?");
  });

  test("italic ALPHA TESTERS WANTED text", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    await expect(page.locator("em")).toContainText("ALPHA TESTERS WANTED");
  });

  test("styled Text with blue-500 color and 2xl size", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    // The <text size="2xl" color="blue-500"> renders as a styled <span>
    // Check computed styles on the element containing the text
    const textEl = page.getByText('"hypermedia"', { exact: true });
    await expect(textEl).toBeVisible();
    // Check computed color and font-size (inherited or direct)
    const color = await textEl.evaluate((el) => getComputedStyle(el).color);
    // blue-500 = #3b82f6 = rgb(59, 130, 246)
    expect(color).toBe("rgb(59, 130, 246)");
    const fontSize = await textEl.evaluate((el) => getComputedStyle(el).fontSize);
    // 2xl = 1.5rem = 24px at default 16px root
    expect(fontSize).toBe("24px");
  });

  test("pink-500 colored text", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    // The Text component applies color to a <span>, check computed style
    const textEl = page.getByText('Let\'s make personal "webpages" fun again!', { exact: true });
    await expect(textEl).toBeVisible();
    const color = await textEl.evaluate((el) => getComputedStyle(el).color);
    // pink-500 = #ec4899 = rgb(236, 72, 153)
    expect(color).toBe("rgb(236, 72, 153)");
  });

  test("multiple images present", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    const images = page.locator("img");
    const count = await images.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("hypernote link", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    const link = page.locator('a[href="https://www.hypernote.club"]').first();
    await expect(link).toContainText("Hypernote");
  });

  test("hstack with pink border", async ({ page }) => {
    await page.goto(server.url, { waitUntil: "networkidle" });
    // The HStack with border="1" borderColor="pink-500" has border-color in style
    // Browsers may render the hex as rgb, so check for either format
    const hstack = page.locator('div[style*="ec4899"], div[style*="236, 72, 153"]').first();
    await expect(hstack).toBeVisible();
  });
});
