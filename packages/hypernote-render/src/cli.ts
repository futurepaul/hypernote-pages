#!/usr/bin/env bun

/**
 * hypernote CLI
 *
 * Usage:
 *   hypernote check <file.hnmd>       - Parse and validate
 *   hypernote serve <file.hnmd>        - Preview server
 *   hypernote screenshot <file.hnmd>   - Capture PNG (requires playwright)
 *   hypernote publish <file.hnmd>      - Publish to Nostr (uses blup keychain)
 */

import { parseHnmdFile } from "./parse";
import { validate } from "./validate";

const args = process.argv.slice(2);
const command = args[0];
const filePath = args[1];

if (!command || command === "--help" || command === "-h") {
  console.log(`
hypernote - Parse, validate, and render Hypernote pages

Usage:
  hypernote check <file.hnmd>       Parse and validate a .hnmd file
  hypernote serve <file.hnmd>       Start preview server with hot reload
  hypernote screenshot <file.hnmd>  Capture a PNG screenshot (needs playwright)
  hypernote publish <file.hnmd>     Publish to Nostr relays (uses blup keychain)

Options:
  --help, -h    Show this help message
  --port <n>    Port for serve command (default: 3456)
  --draft       Publish as draft instead of published (for publish command)
`);
  process.exit(0);
}

if (!filePath) {
  console.error(`Error: Missing file path. Usage: hypernote ${command} <file.hnmd>`);
  process.exit(1);
}

// Resolve file path
const resolvedPath = Bun.file(filePath).name!;

switch (command) {
  case "check":
    await runCheck(resolvedPath);
    break;
  case "serve":
    await runServe(resolvedPath);
    break;
  case "screenshot":
    await runScreenshot(resolvedPath);
    break;
  case "publish":
    await runPublish(resolvedPath);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}

async function runCheck(file: string) {
  console.log(`Checking ${file}...`);

  try {
    const ast = await parseHnmdFile(file);
    const result = validate(ast);

    if (result.errors.length > 0) {
      console.log("\nErrors:");
      for (const error of result.errors) {
        console.log(`  [${error.type}] ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log("\nWarnings:");
      for (const warning of result.warnings) {
        console.log(`  [${warning.type}] ${warning.message}`);
      }
    }

    if (result.frontmatter) {
      console.log(`\nFrontmatter: ${result.frontmatter.title || result.frontmatter.name || "(untitled)"}`);
    }

    if (result.components.length > 0) {
      console.log(`Components used: ${result.components.join(", ")}`);
    }

    if (result.valid && result.warnings.length === 0) {
      console.log("\nAll good!");
      process.exit(0);
    } else if (result.valid) {
      console.log(`\nValid with ${result.warnings.length} warning(s)`);
      process.exit(0);
    } else {
      console.log(`\nFailed with ${result.errors.length} error(s)`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`Failed to parse ${file}:`, e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

async function runServe(file: string) {
  // Dynamic import to avoid loading serve dependencies for check command
  const { startServer } = await import("./serve");
  const portArg = args.indexOf("--port");
  const port = portArg !== -1 && args[portArg + 1] ? parseInt(args[portArg + 1]!, 10) : 3456;
  await startServer(file, port);
}

async function runPublish(file: string) {
  const { finalizeEvent, getPublicKey, validateEvent } = await import("nostr-tools");
  const { decode, naddrEncode } = await import("nostr-tools/nip19");
  const { SimplePool } = await import("nostr-tools/pool");
  const { secrets } = await import("bun");
  const yaml = (await import("yaml")).default;
  const { DEFAULT_RELAYS, LOOKUP_RELAYS } = await import("./lib/relays");

  const BLUP_SERVICE = "com.blossom.blup";

  // Load keys from blup's keychain
  // First figure out the active account
  const os = await import("os");
  const path = await import("path");
  const home = os.default.homedir();
  const xdgConfigHome = Bun.env.XDG_CONFIG_HOME || path.join(home, ".config");
  const configPath = path.join(xdgConfigHome, "blup", "config.json");

  let activeAccount = "default";
  try {
    const configFile = Bun.file(configPath);
    if (await configFile.exists()) {
      const config = await configFile.json();
      if (config.activeAccount) activeAccount = config.activeAccount;
    }
  } catch {
    // Use default
  }

  const nsec = await secrets.get({ service: BLUP_SERVICE, name: `${activeAccount}.nsec` });
  if (!nsec) {
    // Try legacy key
    const legacyNsec = await secrets.get({ service: BLUP_SERVICE, name: "nsec" });
    if (!legacyNsec) {
      console.error("Error: No keys found. Run 'blup create' first to set up your Nostr identity.");
      process.exit(1);
    }
  }

  const secretKeyData = decode(nsec!);
  if (secretKeyData.type !== "nsec") {
    console.error("Error: Invalid nsec in keychain");
    process.exit(1);
  }
  const secretKey = secretKeyData.data;
  const pubkey = getPublicKey(secretKey);

  // Parse and validate the file
  console.log(`Parsing ${file}...`);
  let ast;
  try {
    ast = await parseHnmdFile(file);
  } catch (e) {
    console.error(`Failed to parse ${file}:`, e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const result = validate(ast);
  if (!result.valid) {
    console.error("Validation errors:");
    for (const error of result.errors) {
      console.error(`  [${error.type}] ${error.message}`);
    }
    process.exit(1);
  }

  // Extract frontmatter
  const fmNode = (ast.children.find((child: any) => child.type === "frontmatter") as any)?.value;
  if (!fmNode) {
    console.error("Error: No frontmatter found. Add a --- block with at least a 'title'.");
    process.exit(1);
  }
  const meta = yaml.parse(fmNode);

  // Determine doc type (page vs component)
  const docType = meta?.name ? "component" : "page";
  const displayName = docType === "page"
    ? (meta?.title || "Untitled")
    : (meta?.name || "Unnamed");

  // Slugify for the d tag
  const d = String(displayName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-\s_]+/g, "")
    .replace(/[\s_]+/g, "-");

  const version = "1.3.0";
  const content = JSON.stringify(ast);
  const isDraft = args.includes("--draft");
  const status = isDraft ? "draft" : "published";

  const typeTag = docType === "page" ? "hypernote-page" : "hypernote-component";
  const tags: string[][] = [
    ["d", d],
    [docType === "page" ? "title" : "name", displayName],
    ["status", status],
    ["hypernote", version],
    ["t", "hypernote"],
    ["t", typeTag],
    ["t", `hypernote-v${version}`],
  ];

  const event = finalizeEvent(
    {
      kind: 32616,
      content,
      tags,
      created_at: Math.floor(Date.now() / 1000),
    },
    secretKey
  );

  if (!validateEvent(event)) {
    console.error("Error: Generated event failed validation");
    process.exit(1);
  }

  // Publish to relays
  console.log(`Publishing ${docType} "${displayName}" (${status})...`);
  const pool = new SimplePool();
  const relays = [...DEFAULT_RELAYS];

  const results = await Promise.allSettled(pool.publish(relays, event));
  const succeeded = results
    .map((r, i) => (r.status === "fulfilled" ? relays[i] : null))
    .filter(Boolean);
  const failed = results
    .map((r, i) => (r.status === "rejected" ? relays[i] : null))
    .filter(Boolean);

  if (succeeded.length === 0) {
    console.error("Error: Failed to publish to any relay");
    process.exit(1);
  }

  const naddr = naddrEncode({
    pubkey,
    kind: 32616,
    identifier: d,
    relays: DEFAULT_RELAYS,
  });

  console.log(`Published to ${succeeded.length}/${relays.length} relays`);
  for (const r of succeeded) console.log(`  ok: ${r}`);
  for (const r of failed) console.log(`  failed: ${r}`);
  console.log(`naddr: ${naddr}`);
  process.exit(0);
}

async function runScreenshot(file: string) {
  // Start the serve in background, take screenshot, shut down
  const { startServer } = await import("./serve");
  const port = 3457; // Use a different port for screenshots

  console.log(`Starting preview server for screenshot...`);
  const server = await startServer(file, port, true);

  try {
    // Dynamic import playwright
    let playwright;
    try {
      playwright = await import("playwright");
    } catch {
      console.error("Error: playwright is required for screenshots.");
      console.error("Install it with: bun install -g playwright");
      process.exit(1);
    }

    const browser = await playwright.chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`http://localhost:${port}`, { waitUntil: "networkidle" });

    // Wait a bit for Nostr data to load
    await page.waitForTimeout(2000);

    const outputArg = args.indexOf("--output");
    const outputPath = outputArg !== -1 && args[outputArg + 1] ? args[outputArg + 1] : file.replace(/\.hnmd$/, ".png");

    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(`Screenshot saved to ${outputPath}`);

    await browser.close();
  } finally {
    server.stop();
    process.exit(0);
  }
}
