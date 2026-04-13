import { z } from "zod";
import type { Tool, ToolSchema, ToolResult } from "./tool.js";
import type { Context } from "../context.js";
import type { ToolActionResult } from "../types/types.js";
import type { BrowserSession } from "../types/types.js";

// --- Tool: start ---
const StartInputSchema = z.object({});

const startSchema: ToolSchema<typeof StartInputSchema> = {
  name: "start",
  description:
    "Create or reuse a browser session (Browserbase cloud or local depending on configuration)",
  inputSchema: StartInputSchema,
};

async function handleStart(context: Context): Promise<ToolResult> {
  const action = async (): Promise<ToolActionResult> => {
    try {
      const sessionManager = context.getSessionManager();
      const config = context.config;
      const targetSessionId = sessionManager.getDefaultSessionId();

      const session: BrowserSession =
        await sessionManager.ensureDefaultSessionInternal(config);

      if (
        !session ||
        !session.page ||
        !session.sessionId ||
        !session.stagehand
      ) {
        throw new Error(
          `SessionManager failed to return a valid session object for ID: ${targetSessionId}`,
        );
      }

      // In local mode, stagehand.browserbaseSessionId is undefined; use session.sessionId instead
      const sessionId =
        session.stagehand.browserbaseSessionId ?? session.sessionId;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              data: {
                sessionId,
              },
            }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create browser session: ${errorMessage}`);
    }
  };

  return {
    action: action,
    waitForNetwork: false,
  };
}

const startTool: Tool<typeof StartInputSchema> = {
  capability: "core",
  schema: startSchema,
  handle: handleStart,
};

// --- Tool: end ---
const EndInputSchema = z.object({});

const endSchema: ToolSchema<typeof EndInputSchema> = {
  name: "end",
  description: "Close the current browser session",
  inputSchema: EndInputSchema,
};

async function handleEnd(context: Context): Promise<ToolResult> {
  const action = async (): Promise<ToolActionResult> => {
    const previousSessionId = context.currentSessionId;
    const sessionManager = context.getSessionManager();

    try {
      const session = await sessionManager.getSession(
        previousSessionId,
        context.config,
        false,
      );

      if (session && session.stagehand) {
        await sessionManager.cleanupSession(previousSessionId);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to close session: ${errorMessage}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true }),
        },
      ],
    };
  };

  return {
    action: action,
    waitForNetwork: false,
  };
}

const endTool: Tool<typeof EndInputSchema> = {
  capability: "core",
  schema: endSchema,
  handle: handleEnd,
};

export default [startTool, endTool];
