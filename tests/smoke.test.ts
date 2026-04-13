import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const EXPECTED_TOOLS = [
  "start",
  "end",
  "navigate",
  "act",
  "observe",
  "extract",
];

describe("MCP server smoke test", () => {
  it("lists exactly 6 tools with correct names via STDIO (Browserbase mode)", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["./cli.js"],
      env: {
        ...process.env,
        BROWSERBASE_API_KEY: "test-key",
        BROWSERBASE_PROJECT_ID: "test-project",
      },
      stderr: "pipe",
    });

    const client = new Client({ name: "smoke-test", version: "1.0.0" });

    try {
      await client.connect(transport);
      const { tools } = await client.listTools();

      expect(tools).toHaveLength(6);

      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual([...EXPECTED_TOOLS].sort());

      for (const tool of tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
      }
    } finally {
      await client.close();
    }
  }, 15_000);

  it("lists exactly 6 tools with correct names via STDIO (local mode)", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["./cli.js", "--localMode"],
      env: {
        ...process.env,
        // No Browserbase credentials — verifies local mode works without them
        BROWSERBASE_API_KEY: undefined,
        BROWSERBASE_PROJECT_ID: undefined,
      },
      stderr: "pipe",
    });

    const client = new Client({ name: "smoke-test-local", version: "1.0.0" });

    try {
      await client.connect(transport);
      const { tools } = await client.listTools();

      expect(tools).toHaveLength(6);

      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual([...EXPECTED_TOOLS].sort());

      for (const tool of tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
      }
    } finally {
      await client.close();
    }
  }, 15_000);

  it("selects local backend when LOCAL_MODE env var is set", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["./cli.js"],
      env: {
        ...process.env,
        LOCAL_MODE: "true",
        BROWSERBASE_API_KEY: undefined,
        BROWSERBASE_PROJECT_ID: undefined,
      },
      stderr: "pipe",
    });

    const client = new Client({
      name: "smoke-test-local-env",
      version: "1.0.0",
    });

    try {
      await client.connect(transport);
      const { tools } = await client.listTools();

      // All 6 tools must be present regardless of backend
      expect(tools).toHaveLength(6);
      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual([...EXPECTED_TOOLS].sort());
    } finally {
      await client.close();
    }
  }, 15_000);
});
