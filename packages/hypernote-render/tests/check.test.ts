/**
 * Unit tests for hypernote-render: parsing and validation
 */

import { test, expect, describe } from "bun:test";
import { parseHnmdFile } from "../src/parse";
import { validate } from "../src/validate";
import { resolve } from "path";

const EXAMPLES_DIR = resolve(import.meta.dir, "../../../examples");

const EXAMPLES = [
  "simple-mdx",
  "fun-debug-test-cases",
  "test-chat-room",
  "pauls-homepage",
  "page-with-imports",
  "whats-a-hypernote",
];

const EXPECTED_TITLES: Record<string, string> = {
  "simple-mdx": "Simple MDX demo",
  "fun-debug-test-cases": "Fun Debug Test cases",
  "test-chat-room": "Test Chat Room",
  "pauls-homepage": "Paul's Homepage",
  "page-with-imports": "Page with imports",
  "whats-a-hypernote": "What's a Hypernote?",
};

// ---------------------------------------------------------------------------
// Parse + validate all 6 examples
// ---------------------------------------------------------------------------

describe("parse and validate all examples", () => {
  for (const name of EXAMPLES) {
    test(`${name} parses and validates`, async () => {
      const ast = await parseHnmdFile(resolve(EXAMPLES_DIR, `${name}.hnmd`));
      const result = validate(ast);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.frontmatter).not.toBeNull();
      expect(result.frontmatter!.title).toBe(EXPECTED_TITLES[name]);
    });
  }
});

// ---------------------------------------------------------------------------
// Specific frontmatter properties
// ---------------------------------------------------------------------------

describe("frontmatter properties", () => {
  test("pauls-homepage has filter, actions, bg, and bgMode", async () => {
    const ast = await parseHnmdFile(resolve(EXAMPLES_DIR, "pauls-homepage.hnmd"));
    const { frontmatter } = validate(ast);

    expect(frontmatter).not.toBeNull();
    expect(frontmatter!.filter).toBeDefined();
    expect(frontmatter!.filter.kinds).toContain(9);
    expect(frontmatter!.actions).toBeDefined();
    expect(frontmatter!.actions.send).toBeDefined();
    expect(frontmatter!.bg).toContain("cdn.satellite.earth");
    expect(frontmatter!.bgMode).toBe("tile");
  });

  test("page-with-imports has imports", async () => {
    const ast = await parseHnmdFile(resolve(EXAMPLES_DIR, "page-with-imports.hnmd"));
    const { frontmatter } = validate(ast);

    expect(frontmatter).not.toBeNull();
    expect(frontmatter!.imports).toBeDefined();
    expect(frontmatter!.imports.TestComponent).toBeDefined();
  });

  test("test-chat-room has padding '0'", async () => {
    const ast = await parseHnmdFile(resolve(EXAMPLES_DIR, "test-chat-room.hnmd"));
    const { frontmatter } = validate(ast);

    expect(frontmatter).not.toBeNull();
    expect(frontmatter!.padding).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// Component detection
// ---------------------------------------------------------------------------

describe("component detection", () => {
  test("simple-mdx uses HStack, Text, VStack", async () => {
    const ast = await parseHnmdFile(resolve(EXAMPLES_DIR, "simple-mdx.hnmd"));
    const { components } = validate(ast);

    const lower = components.map((c) => c.toLowerCase());
    expect(lower).toContain("hstack");
    expect(lower).toContain("text");
    expect(lower).toContain("vstack");
  });

  test("page-with-imports uses Profile, Note, and TestComponent", async () => {
    const ast = await parseHnmdFile(resolve(EXAMPLES_DIR, "page-with-imports.hnmd"));
    const { components } = validate(ast);

    const lower = components.map((c) => c.toLowerCase());
    expect(lower).toContain("profile");
    expect(lower).toContain("note");
    expect(lower).toContain("testcomponent");
  });

  test("test-chat-room uses VStack, HStack, Each, Profile, Text, Input, Button", async () => {
    const ast = await parseHnmdFile(resolve(EXAMPLES_DIR, "test-chat-room.hnmd"));
    const { components } = validate(ast);

    const lower = components.map((c) => c.toLowerCase());
    expect(lower).toContain("vstack");
    expect(lower).toContain("hstack");
    expect(lower).toContain("each");
    expect(lower).toContain("profile");
    expect(lower).toContain("text");
    expect(lower).toContain("input");
    expect(lower).toContain("button");
  });

  test("whats-a-hypernote uses Text, HStack, VStack", async () => {
    const ast = await parseHnmdFile(resolve(EXAMPLES_DIR, "whats-a-hypernote.hnmd"));
    const { components } = validate(ast);

    const lower = components.map((c) => c.toLowerCase());
    expect(lower).toContain("text");
    expect(lower).toContain("hstack");
    expect(lower).toContain("vstack");
  });
});
