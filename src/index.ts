import * as dotenv from "dotenv";
dotenv.config();

import { randomUUID } from "crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MCPToolsArray } from "./types/types.js";

import { Context } from "./context.js";
import type { Config } from "../config.d.ts";
import { TOOLS } from "./tools/index.js";
import { RESOURCE_TEMPLATES } from "./mcp/resources.js";

import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Configuration schema - matches existing Config interface
export const configSchema = z
  .object({
    browserbaseApiKey: z
      .string()
      .optional()
      .describe("The Browserbase API Key to use (not required in local mode)"),
    browserbaseProjectId: z
      .string()
      .optional()
      .describe(
        "The Browserbase Project ID to use (not required in local mode)",
      ),
    proxies: z
      .boolean()
      .optional()
      .describe("Whether or not to use Browserbase proxies"),
    advancedStealth: z
      .boolean()
      .optional()
      .describe(
        "Use advanced stealth mode. Only available to Browserbase Scale Plan users",
      ),
    keepAlive: z
      .boolean()
      .optional()
      .describe("Whether or not to keep the Browserbase session alive"),
    context: z
      .object({
        contextId: z
          .string()
          .optional()
          .describe("The ID of the context to use"),
        persist: z
          .boolean()
          .optional()
          .describe("Whether or not to persist the context"),
      })
      .optional(),
    viewPort: z
      .object({
        browserWidth: z
          .number()
          .optional()
          .describe("The width of the browser"),
        browserHeight: z
          .number()
          .optional()
          .describe("The height of the browser"),
      })
      .optional(),
    server: z
      .object({
        port: z
          .number()
          .optional()
          .describe("The port to listen on for SHTTP or MCP transport"),
        host: z
          .string()
          .optional()
          .describe(
            "The host to bind the server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces",
          ),
      })
      .optional(),
    modelName: z
      .string()
      .optional()
      .describe(
        "The model to use for Stagehand (default: google/gemini-2.5-flash-lite)",
      ),
    modelApiKey: z
      .string()
      .optional()
      .describe(
        "API key for the custom model provider. Required when using a model other than the default google/gemini-2.5-flash-lite",
      ),
    experimental: z
      .boolean()
      .optional()
      .describe("Enable experimental Stagehand features"),
    localMode: z
      .boolean()
      .optional()
      .describe(
        "Run in local mode using a local browser instead of Browserbase. No Browserbase credentials required.",
      ),
  })
  .refine(
    (data) => {
      // In Browserbase (remote) mode, API key and project ID are required
      if (!data.localMode) {
        return !!(data.browserbaseApiKey && data.browserbaseProjectId);
      }
      return true;
    },
    {
      message:
        "browserbaseApiKey and browserbaseProjectId are required when not running in local mode",
      path: ["browserbaseApiKey"],
    },
  )
  .refine(
    (data) => {
      // If a non-default model is explicitly specified, API key is required
      if (data.modelName && data.modelName !== "google/gemini-2.5-flash-lite") {
        return (
          data.modelApiKey !== undefined &&
          typeof data.modelApiKey === "string" &&
          data.modelApiKey.length > 0
        );
      }
      return true;
    },
    {
      message: "modelApiKey is required when specifying a custom model",
      path: ["modelApiKey"],
    },
  );

// Default function for creating MCP server instance
export default function ({ config }: { config: z.infer<typeof configSchema> }) {
  if (!config.localMode) {
    if (!config.browserbaseApiKey) {
      throw new Error(
        "browserbaseApiKey is required when not running in local mode",
      );
    }
    if (!config.browserbaseProjectId) {
      throw new Error(
        "browserbaseProjectId is required when not running in local mode",
      );
    }
  }

  const serverName = config.localMode
    ? "Browserbase MCP Server (Local Mode)"
    : "Browserbase MCP Server";
  const serverDescription = config.localMode
    ? "Local browser automation server powered by Stagehand. Enables LLMs to navigate websites, interact with elements, extract data, and capture screenshots using a local browser."
    : "Cloud browser automation server powered by Browserbase and Stagehand. Enables LLMs to navigate websites, interact with elements, extract data, and capture screenshots using natural language commands.";

  const server = new McpServer({
    name: serverName,
    version: "3.0.0",
    description: serverDescription,
    capabilities: {
      resources: {
        subscribe: true,
        listChanged: true,
      },
      tools: {},
    },
  });

  const internalConfig: Config = config as Config;

  // Create the context, passing server instance and config
  const contextId = randomUUID();
  const context = new Context(server.server, internalConfig, contextId);

  server.server.registerCapabilities({
    resources: {
      subscribe: true,
      listChanged: true,
    },
  });

  // Add resource handlers
  server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return context.listResources();
  });

  server.server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request) => {
      return context.readResource(request.params.uri);
    },
  );

  server.server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async () => {
      return { resourceTemplates: RESOURCE_TEMPLATES };
    },
  );

  const tools: MCPToolsArray = [...TOOLS];

  // Register each tool with the MCP server
  tools.forEach((tool) => {
    if (tool.schema.inputSchema instanceof z.ZodObject) {
      server.tool(
        tool.schema.name,
        tool.schema.description,
        tool.schema.inputSchema.shape,
        async (params: z.infer<typeof tool.schema.inputSchema>) => {
          try {
            const result = await context.run(tool, params);
            return result;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            process.stderr.write(
              `[MCP Error] ${new Date().toISOString()} Error running tool ${tool.schema.name}: ${errorMessage}\n`,
            );
            throw new Error(
              `Failed to run tool '${tool.schema.name}': ${errorMessage}`,
            );
          }
        },
      );
    } else {
      console.warn(
        `Tool "${tool.schema.name}" has an input schema that is not a ZodObject. Schema type: ${tool.schema.inputSchema.constructor.name}`,
      );
    }
  });

  return server.server;
}
