import { Stagehand } from "@browserbasehq/stagehand";
import type { Config } from "../config.d.ts";
import type { BrowserSession } from "./types/types.js";
import type { ISessionManager } from "./sessionManager.js";
import { randomUUID } from "crypto";

/**
 * Create a Stagehand instance running against a local browser (no Browserbase credentials).
 *
 * An LLM model API key is still required for act/observe/extract tools.
 * Supported env vars (checked in order): OPENAI_API_KEY, ANTHROPIC_API_KEY,
 * GEMINI_API_KEY / GOOGLE_API_KEY.
 */
export const createLocalStagehandInstance = async (
  config: Config,
  sessionId: string,
): Promise<Stagehand> => {
  const modelName = config.modelName || "google/gemini-2.5-flash-lite";
  const modelApiKey =
    config.modelApiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  const stagehand = new Stagehand({
    env: "LOCAL",
    model: modelApiKey
      ? {
          apiKey: modelApiKey,
          modelName: modelName,
        }
      : modelName,
    localBrowserLaunchOptions: {
      headless: true,
      ...(config.viewPort &&
        {
          // viewport is set on the page after init; launch options don't carry it
        }),
    },
    experimental: config.experimental ?? false,
    logger: (logLine) => {
      console.error(`StagehandLocal[${sessionId}]: ${logLine.message}`);
    },
  });

  await stagehand.init();
  return stagehand;
};

/**
 * SessionManager variant for local mode.
 *
 * Mirrors the public API of SessionManager so it can be used interchangeably
 * via the ISessionManager interface. The only difference is that sessions are
 * backed by a local Chromium browser instead of Browserbase.
 */
export class LocalSessionManager implements ISessionManager {
  private browsers: Map<string, BrowserSession>;
  private defaultBrowserSession: BrowserSession | null;
  private readonly defaultSessionId: string;
  private activeSessionId: string;
  private defaultSessionCreationPromise: Promise<BrowserSession> | null = null;
  private cleaningUpSessions: Set<string> = new Set();

  constructor(contextId?: string) {
    this.browsers = new Map();
    this.defaultBrowserSession = null;
    const uniqueId = randomUUID();
    this.defaultSessionId = `local_session_${contextId || "default"}_${Date.now()}_${uniqueId}`;
    this.activeSessionId = this.defaultSessionId;
  }

  getDefaultSessionId(): string {
    return this.defaultSessionId;
  }

  setActiveSessionId(id: string): void {
    if (this.browsers.has(id)) {
      this.activeSessionId = id;
    } else if (id === this.defaultSessionId) {
      this.activeSessionId = id;
    } else {
      process.stderr.write(
        `[LocalSessionManager] WARN - Set active session failed for non-existent ID: ${id}\n`,
      );
    }
  }

  getActiveSessionId(): string {
    return this.activeSessionId;
  }

  /**
   * Creates a new local browser session using Stagehand with env: "LOCAL".
   */
  async createNewLocalSession(
    newSessionId: string,
    config: Config,
  ): Promise<BrowserSession> {
    try {
      process.stderr.write(
        `[LocalSessionManager] Creating local Stagehand session ${newSessionId}...\n`,
      );

      const stagehand = await createLocalStagehandInstance(
        config,
        newSessionId,
      );

      const page = stagehand.context.pages()[0];
      if (!page) {
        throw new Error("No pages available in local Stagehand context");
      }

      process.stderr.write(
        `[LocalSessionManager] Local session initialized: ${newSessionId}\n`,
      );

      const sessionObj: BrowserSession = {
        page,
        sessionId: newSessionId,
        stagehand,
      };

      this.browsers.set(newSessionId, sessionObj);

      if (newSessionId === this.defaultSessionId) {
        this.defaultBrowserSession = sessionObj;
      }

      this.setActiveSessionId(newSessionId);
      process.stderr.write(
        `[LocalSessionManager] Session created and active: ${newSessionId}\n`,
      );

      return sessionObj;
    } catch (creationError) {
      const errorMessage =
        creationError instanceof Error
          ? creationError.message
          : String(creationError);
      process.stderr.write(
        `[LocalSessionManager] Creating session ${newSessionId} failed: ${errorMessage}\n`,
      );
      throw new Error(
        `Failed to create local session ${newSessionId}: ${errorMessage}`,
      );
    }
  }

  private async closeBrowserGracefully(
    session: BrowserSession | undefined | null,
    sessionIdToLog: string,
  ): Promise<void> {
    if (this.cleaningUpSessions.has(sessionIdToLog)) {
      process.stderr.write(
        `[LocalSessionManager] Session ${sessionIdToLog} is already being cleaned up, skipping.\n`,
      );
      return;
    }

    this.cleaningUpSessions.add(sessionIdToLog);

    try {
      if (session?.stagehand) {
        try {
          process.stderr.write(
            `[LocalSessionManager] Closing Stagehand for session: ${sessionIdToLog}\n`,
          );
          await session.stagehand.close();
          process.stderr.write(
            `[LocalSessionManager] Successfully closed Stagehand for session: ${sessionIdToLog}\n`,
          );
        } catch (closeError) {
          process.stderr.write(
            `[LocalSessionManager] WARN - Error closing Stagehand for session ${sessionIdToLog}: ${
              closeError instanceof Error
                ? closeError.message
                : String(closeError)
            }\n`,
          );
        }
      }
    } finally {
      this.cleaningUpSessions.delete(sessionIdToLog);
    }
  }

  async ensureDefaultSessionInternal(config: Config): Promise<BrowserSession> {
    if (this.defaultSessionCreationPromise) {
      process.stderr.write(
        `[LocalSessionManager] Default session creation already in progress, waiting...\n`,
      );
      return await this.defaultSessionCreationPromise;
    }

    const sessionId = this.defaultSessionId;
    let needsReCreation = false;

    if (!this.defaultBrowserSession) {
      needsReCreation = true;
      process.stderr.write(
        `[LocalSessionManager] Default session ${sessionId} not found, creating.\n`,
      );
    } else {
      try {
        const pages = this.defaultBrowserSession.stagehand.context.pages();
        if (!pages || pages.length === 0) {
          throw new Error("No pages available");
        }
      } catch {
        needsReCreation = true;
        process.stderr.write(
          `[LocalSessionManager] Default session ${sessionId} is stale, recreating.\n`,
        );
        await this.closeBrowserGracefully(
          this.defaultBrowserSession,
          sessionId,
        );
        this.defaultBrowserSession = null;
        this.browsers.delete(sessionId);
      }
    }

    if (needsReCreation) {
      this.defaultSessionCreationPromise = (async () => {
        try {
          this.defaultBrowserSession = await this.createNewLocalSession(
            sessionId,
            config,
          );
          return this.defaultBrowserSession;
        } catch (creationError) {
          process.stderr.write(
            `[LocalSessionManager] Initial creation attempt for default session ${sessionId} failed. Error: ${
              creationError instanceof Error
                ? creationError.message
                : String(creationError)
            }\n`,
          );
          process.stderr.write(
            `[LocalSessionManager] Retrying creation of default session ${sessionId} after error...\n`,
          );
          try {
            this.defaultBrowserSession = await this.createNewLocalSession(
              sessionId,
              config,
            );
            return this.defaultBrowserSession;
          } catch (retryError) {
            const finalErrorMessage =
              retryError instanceof Error
                ? retryError.message
                : String(retryError);
            process.stderr.write(
              `[LocalSessionManager] Failed to recreate default session ${sessionId} after retry: ${finalErrorMessage}\n`,
            );
            throw new Error(
              `Failed to ensure default local session ${sessionId} after initial error and retry: ${finalErrorMessage}`,
            );
          }
        } finally {
          this.defaultSessionCreationPromise = null;
        }
      })();

      return await this.defaultSessionCreationPromise;
    }

    this.setActiveSessionId(sessionId);
    return this.defaultBrowserSession!;
  }

  async getSession(
    sessionId: string,
    config: Config,
    createIfMissing: boolean = true,
  ): Promise<BrowserSession | null> {
    if (sessionId === this.defaultSessionId && createIfMissing) {
      try {
        return await this.ensureDefaultSessionInternal(config);
      } catch {
        process.stderr.write(
          `[LocalSessionManager] Failed to get default session for ${sessionId}. See previous messages for details.\n`,
        );
        return null;
      }
    }

    process.stderr.write(
      `[LocalSessionManager] Getting session: ${sessionId}\n`,
    );
    const sessionObj = this.browsers.get(sessionId);

    if (!sessionObj) {
      process.stderr.write(
        `[LocalSessionManager] WARN - Session not found in map: ${sessionId}\n`,
      );
      return null;
    }

    try {
      const pages = sessionObj.stagehand.context.pages();
      if (!pages || pages.length === 0) {
        throw new Error("No pages available");
      }
    } catch {
      process.stderr.write(
        `[LocalSessionManager] WARN - Found session ${sessionId} is stale, removing.\n`,
      );
      await this.closeBrowserGracefully(sessionObj, sessionId);
      this.browsers.delete(sessionId);
      if (this.activeSessionId === sessionId) {
        process.stderr.write(
          `[LocalSessionManager] WARN - Invalidated active session ${sessionId}, resetting to default.\n`,
        );
        this.setActiveSessionId(this.defaultSessionId);
      }
      return null;
    }

    this.setActiveSessionId(sessionId);
    process.stderr.write(
      `[LocalSessionManager] Using valid session: ${sessionId}\n`,
    );
    return sessionObj;
  }

  async cleanupSession(sessionId: string): Promise<void> {
    process.stderr.write(
      `[LocalSessionManager] Cleaning up session: ${sessionId}\n`,
    );

    const session = this.browsers.get(sessionId);
    if (session) {
      await this.closeBrowserGracefully(session, sessionId);
    }

    this.browsers.delete(sessionId);

    if (sessionId === this.defaultSessionId && this.defaultBrowserSession) {
      this.defaultBrowserSession = null;
    }

    if (this.activeSessionId === sessionId) {
      process.stderr.write(
        `[LocalSessionManager] Cleaned up active session ${sessionId}, resetting to default.\n`,
      );
      this.setActiveSessionId(this.defaultSessionId);
    }
  }

  async closeAllSessions(): Promise<void> {
    process.stderr.write(`[LocalSessionManager] Closing all sessions...\n`);
    const closePromises: Promise<void>[] = [];
    for (const [id, session] of this.browsers.entries()) {
      process.stderr.write(`[LocalSessionManager] Closing session: ${id}\n`);
      closePromises.push(this.closeBrowserGracefully(session, id));
    }
    try {
      await Promise.all(closePromises);
    } catch {
      process.stderr.write(
        `[LocalSessionManager] WARN - Some errors occurred during batch session closing. See individual messages.\n`,
      );
    }

    this.browsers.clear();
    this.defaultBrowserSession = null;
    this.setActiveSessionId(this.defaultSessionId);
    process.stderr.write(
      `[LocalSessionManager] All sessions closed and cleared.\n`,
    );
  }
}
