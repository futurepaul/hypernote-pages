#!/usr/bin/env bun

/**
 * hypernote-render CLI
 *
 * Usage:
 *   hypernote-render check <file.hnmd>       - Parse and validate
 *   hypernote-render serve <file.hnmd>        - Preview server
 *   hypernote-render screenshot <file.hnmd>   - Capture PNG (requires playwright)
 */

import { parseHnmdFile } from "./parse";
import { validate } from "./validate";

const args = process.argv.slice(2);
const command = args[0];
const filePath = args[1];

if (!command || command === "--help" || command === "-h") {
  console.log(`
hypernote-render - Parse, validate, and render Hypernote pages

Usage:
  hypernote-render check <file.hnmd>       Parse and validate a .hnmd file
  hypernote-render serve <file.hnmd>       Start preview server with hot reload
  hypernote-render screenshot <file.hnmd>  Capture a PNG screenshot (needs playwright)

Options:
  --help, -h    Show this help message
  --port <n>    Port for serve command (default: 3456)
`);
  process.exit(0);
}

if (!filePath) {
  console.error(`Error: Missing file path. Usage: hypernote-render ${command} <file.hnmd>`);
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
  const port = portArg !== -1 && args[portArg + 1] ? parseInt(args[portArg + 1], 10) : 3456;
  await startServer(file, port);
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
      console.error("Install it with: bun add playwright");
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
