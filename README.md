# Browserbase MCP Server

![cover](assets/cover.png)

[The Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) is an open protocol that enables seamless integration between LLM applications and external data sources and tools. Whether you're building an AI-powered IDE, enhancing a chat interface, or creating custom AI workflows, MCP provides a standardized way to connect LLMs with the context they need.

This server provides browser automation capabilities using [Browserbase](https://www.browserbase.com/) and [Stagehand](https://github.com/browserbase/stagehand). It enables LLMs to interact with web pages, extract information, and perform automated actions.

It supports two modes:

- **Browserbase (remote/cloud) mode** – the default. Uses Browserbase cloud infrastructure. Requires `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID`.
- **Local mode** – runs against a local Chromium browser via Stagehand. No Browserbase credentials needed. Requires an LLM API key for AI tools (act/observe/extract).

This is a self-hostable version of the [Browserbase hosted MCP server](https://mcp.browserbase.com/mcp) with the same tools and functionality. **We recommend using the hosted version for the easiest setup.**

## Tools

This server exposes 6 tools that match the [hosted Browserbase MCP server](https://docs.browserbase.com/integrations/mcp/introduction):

| Tool       | Description                             | Input                      |
| ---------- | --------------------------------------- | -------------------------- |
| `start`    | Create or reuse a browser session       | _(none)_                   |
| `end`      | Close the current browser session       | _(none)_                   |
| `navigate` | Navigate to a URL                       | `{ url: string }`          |
| `act`      | Perform an action on the page           | `{ action: string }`       |
| `observe`  | Observe actionable elements on the page | `{ instruction: string }`  |
| `extract`  | Extract data from the page              | `{ instruction?: string }` |

The same 6 tools are available in both Browserbase mode and local mode.

## How to Setup

We currently support 2 transports for our MCP server, STDIO and SHTTP. We recommend you use SHTTP with our hosted MCP server to take advantage of the server at full capacity.

## SHTTP (Hosted MCP):

Use the Browserbase hosted MCP server at `https://mcp.browserbase.com/mcp`. This is the easiest way to get started -- we host the server and provide the LLM costs for Gemini, the [best performing model](https://www.stagehand.dev/evals) in [Stagehand](https://www.stagehand.dev).

For full setup instructions, see the [Browserbase MCP documentation](https://docs.browserbase.com/integrations/mcp/introduction).

If your client supports SHTTP:

```json
{
  "mcpServers": {
    "browserbase": {
      "type": "http",
      "url": "https://mcp.browserbase.com/mcp"
    }
  }
}
```

If your client doesn't support SHTTP:

```json
{
  "mcpServers": {
    "browserbase": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.browserbase.com/mcp"]
    }
  }
}
```

## STDIO (Self-Hosted):

You can either use our server hosted on NPM or run it completely locally by cloning this repo.

> **Note:** If you want to use a different model you have to add --modelName to the args and provide that respective key as an arg. More info below.

### Browserbase mode (remote/cloud)

Browserbase mode is the default. It runs browser sessions in Browserbase cloud and requires:

- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`
- `GEMINI_API_KEY` (or another model API key)

#### To run via NPM (Recommended)

Go into your MCP Config JSON and add the Browserbase Server:

```json
{
  "mcpServers": {
    "browserbase": {
      "command": "npx",
      "args": ["@balajiv113/mcp"],
      "env": {
        "BROWSERBASE_API_KEY": "",
        "BROWSERBASE_PROJECT_ID": "",
        "GEMINI_API_KEY": ""
      }
    }
  }
}
```

That's it! Reload your MCP client and you're ready to go.

### Local mode (Stagehand local browser)

Local mode runs browser sessions against a local Chromium browser via Stagehand. No Browserbase account is needed.

**Required:** An LLM API key for the AI tools (`act`, `observe`, `extract`). Supported providers:

| Provider  | Env var                             |
| --------- | ----------------------------------- |
| OpenAI    | `OPENAI_API_KEY`                    |
| Anthropic | `ANTHROPIC_API_KEY`                 |
| Google    | `GEMINI_API_KEY` / `GOOGLE_API_KEY` |

Enable local mode by passing `--localMode` on the CLI **or** setting `LOCAL_MODE=true` as an environment variable.

#### Via NPM

```json
{
  "mcpServers": {
    "browserbase": {
      "command": "npx",
      "args": ["@balajiv113/mcp", "--localMode"],
      "env": {
        "OPENAI_API_KEY": ""
      }
    }
  }
}
```

Or via environment variable:

```json
{
  "mcpServers": {
    "browserbase": {
      "command": "npx",
      "args": ["@balajiv113/mcp"],
      "env": {
        "LOCAL_MODE": "true",
        "OPENAI_API_KEY": ""
      }
    }
  }
}
```

### To run 100% local:

#### Option 1: Direct installation

```bash
git clone https://github.com/balajiv113/mcp-server-browserbase.git
cd mcp-server-browserbase
npm install && npm run build
```

#### Option 2: Docker

```bash
git clone https://github.com/balajiv113/mcp-server-browserbase.git
cd mcp-server-browserbase
docker build -t mcp-browserbase .
```

Then in your MCP Config JSON run the server:

#### Using Direct Installation — Browserbase mode

```json
{
  "mcpServers": {
    "browserbase": {
      "command": "node",
      "args": ["/path/to/mcp-server-browserbase/cli.js"],
      "env": {
        "BROWSERBASE_API_KEY": "",
        "BROWSERBASE_PROJECT_ID": "",
        "GEMINI_API_KEY": ""
      }
    }
  }
}
```

#### Using Direct Installation — Local mode

```json
{
  "mcpServers": {
    "browserbase": {
      "command": "node",
      "args": ["/path/to/mcp-server-browserbase/cli.js", "--localMode"],
      "env": {
        "OPENAI_API_KEY": ""
      }
    }
  }
}
```

#### Using Docker — Browserbase mode

```json
{
  "mcpServers": {
    "browserbase": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "BROWSERBASE_API_KEY",
        "-e",
        "BROWSERBASE_PROJECT_ID",
        "-e",
        "GEMINI_API_KEY",
        "mcp-browserbase"
      ],
      "env": {
        "BROWSERBASE_API_KEY": "",
        "BROWSERBASE_PROJECT_ID": "",
        "GEMINI_API_KEY": ""
      }
    }
  }
}
```

#### Using Docker — Local mode

```json
{
  "mcpServers": {
    "browserbase": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "LOCAL_MODE=true",
        "-e",
        "OPENAI_API_KEY",
        "mcp-browserbase"
      ],
      "env": {
        "OPENAI_API_KEY": ""
      }
    }
  }
}
```

## Configuration

The Browserbase MCP server accepts the following command-line flags:

| Flag                       | Description                                                                 |
| -------------------------- | --------------------------------------------------------------------------- |
| `--localMode`              | Run using a local browser (no Browserbase credentials required)             |
| `--proxies`                | Enable Browserbase proxies for the session                                  |
| `--advancedStealth`        | Enable Browserbase Advanced Stealth (Only for Scale Plan Users)             |
| `--keepAlive`              | Enable Browserbase Keep Alive Session                                       |
| `--contextId <contextId>`  | Specify a Browserbase Context ID to use                                     |
| `--persist`                | Whether to persist the Browserbase context (default: true)                  |
| `--port <port>`            | Port to listen on for HTTP/SHTTP transport                                  |
| `--host <host>`            | Host to bind server to (default: localhost, use 0.0.0.0 for all interfaces) |
| `--browserWidth <width>`   | Browser viewport width (default: 1024)                                      |
| `--browserHeight <height>` | Browser viewport height (default: 768)                                      |
| `--modelName <model>`      | The model to use for Stagehand (default: google/gemini-2.5-flash-lite)      |
| `--modelApiKey <key>`      | API key for the custom model provider (required when using custom models)   |
| `--experimental`           | Enable experimental features (default: false)                               |

These flags can be passed directly to the CLI or configured in your MCP configuration file.

> **Note:** These flags can only be used with the self-hosted server (npx @balajiv113/mcp or Docker).

The following environment variables are also supported:

| Environment variable     | Description                               |
| ------------------------ | ----------------------------------------- |
| `LOCAL_MODE`             | Set to `true` or `1` to enable local mode |
| `BROWSERBASE_API_KEY`    | Browserbase API key (remote mode)         |
| `BROWSERBASE_PROJECT_ID` | Browserbase project ID (remote mode)      |
| `GEMINI_API_KEY`         | Google Gemini API key                     |
| `GOOGLE_API_KEY`         | Alternative for Gemini API key            |
| `OPENAI_API_KEY`         | OpenAI API key (local mode)               |
| `ANTHROPIC_API_KEY`      | Anthropic API key (local mode)            |

### Mode comparison

| Feature                  | Browserbase mode  | Local mode                     |
| ------------------------ | ----------------- | ------------------------------ |
| Browser runs on          | Browserbase cloud | Your machine (local Chromium)  |
| `BROWSERBASE_API_KEY`    | Required          | Not needed                     |
| `BROWSERBASE_PROJECT_ID` | Required          | Not needed                     |
| LLM API key              | Required          | Required (act/observe/extract) |
| Proxies / stealth        | Supported         | Not supported                  |
| Session persistence      | Supported         | Not supported                  |

### Model Configuration

Stagehand defaults to using Google's Gemini 2.5 Flash Lite model, but you can configure it to use other models like GPT-4o, Claude, or other providers.

**Important**: When using any custom model (non-default), you must provide your own API key for that model provider using the `--modelApiKey` flag.

```json
{
  "mcpServers": {
    "browserbase": {
      "command": "npx",
      "args": [
        "@balajiv113/mcp",
        "--modelName",
        "anthropic/claude-sonnet-4-5",
        "--modelApiKey",
        "your-anthropic-api-key"
      ],
      "env": {
        "BROWSERBASE_API_KEY": "",
        "BROWSERBASE_PROJECT_ID": ""
      }
    }
  }
}
```

_Note: The model must be supported in Stagehand. Check out the docs [here](https://docs.stagehand.dev/examples/custom_llms#supported-llms)._

## Links

- [Browserbase MCP Documentation](https://docs.browserbase.com/integrations/mcp/introduction)
- [MCP Documentation](https://modelcontextprotocol.io/docs)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Stagehand Documentation](https://docs.stagehand.dev/)

## License

Licensed under the Apache 2.0 License.

Copyright 2025 Browserbase, Inc.
