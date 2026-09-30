# SendKit

SendKit lets AI agents and developers send Telegram messages. One core operation is exposed three ways:

| Surface | Package / path | Transport | Auth |
|---------|----------------|-----------|------|
| Local MCP server | `@yuvi_dew_1234/sendkit-mcp` | stdio | `TELEGRAM_BOT_TOKEN` env var |
| Remote MCP server | `apps/remote-mcp` | Streamable HTTP | Clerk OAuth; bot token in the URL |
| CLI | `@yuvi_dew_1234/sendkit` (binary `sendkit`) | terminal | token saved by `sendkit init` |

All three call `@yuvi_dew_1234/sendkit-core`, which talks to the Telegram Bot API.

## Contents

- [How it works](#how-it-works)
- [The `telegram` tool](#the-telegram-tool)
- [Prerequisites](#prerequisites)
- [Local MCP server](#local-mcp-server)
- [Remote MCP server](#remote-mcp-server)
- [CLI](#cli)
- [Core library](#core-library)
- [Agent skill](#agent-skill)
- [Development](#development)
- [Publishing](#publishing)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)

## How it works

```
 MCP client (Claude, etc.)            Terminal
        │                                │
  ┌─────┴──────┐  ┌──────────────┐  ┌────┴─────┐
  │ local-mcp  │  │  remote-mcp  │  │   cli    │
  │  (stdio)   │  │ (HTTP+Clerk) │  │          │
  └─────┬──────┘  └──────┬───────┘  └────┬─────┘
        └────────────────┼───────────────┘
                   ┌─────┴─────┐
                   │   core    │  validates input with zod
                   └─────┬─────┘
                         │ POST /bot<token>/sendMessage
                   Telegram Bot API
```

## The `telegram` tool

Both MCP servers register a single tool named `telegram`.

**Input**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `chatId` | string | yes | Telegram chat ID, non-empty |
| `message` | string | yes | Message text, non-empty |

The bot token is never part of the tool input. It comes from the server environment (local) or the URL (remote).

**Output** (as `structuredContent`)

```json
{ "ok": true, "chatId": "123456789", "messageId": 42 }
```

The text content reads `Send Telegram message <messageId> to chat <chatId>`. On failure the tool throws with Telegram's `description` (for example an invalid token or an unknown chat).

## Prerequisites

1. **A Telegram bot token.** Message [@BotFather](https://t.me/BotFather) on Telegram, send `/newbot`, and copy the token.
2. **A chat ID.** Open a chat with your bot and send it any message. Then open `https://api.telegram.org/bot<token>/getUpdates` and read `message.chat.id`. A bot can only message chats that have started a conversation with it.
3. **[Bun](https://bun.sh)** for development. Node 20 or newer is enough to run the published packages.

## Local MCP server

Package: `@yuvi_dew_1234/sendkit-mcp`. It runs over stdio, so the MCP client starts it as a child process.

Add it to your MCP client config, for example `.mcp.json` for Claude Code:

```json
{
  "mcpServers": {
    "sendkit": {
      "type": "stdio",
      "command": "bunx",
      "args": ["-y", "@yuvi_dew_1234/sendkit-mcp"],
      "env": {
        "TELEGRAM_BOT_TOKEN": "<your-bot-token>"
      }
    }
  }
}
```

`npx -y @yuvi_dew_1234/sendkit-mcp` works in place of `bunx`. If `TELEGRAM_BOT_TOKEN` is missing, the tool call fails with an error telling you to set it in the MCP client environment.

## Remote MCP server

Location: `apps/remote-mcp`. A [Hono](https://hono.dev) app that serves MCP over stateless Streamable HTTP (JSON responses, no sessions). Requests are authenticated with [Clerk](https://clerk.com) OAuth.

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/:botToken/mcp` | MCP endpoint. The bot token in the path is used to send messages. |
| `GET` | `/.well-known/oauth-protected-resource/:botToken/mcp` | OAuth protected-resource metadata so MCP clients can discover Clerk. |
| any other | `*` | `404 { "error": "Not found" }` |

### Auth flow

1. The client calls `POST /<botToken>/mcp` without a `Bearer` token.
2. The server answers `401` with `WWW-Authenticate: Bearer resource_metadata="<metadata url>"`.
3. The client reads the metadata, runs the Clerk OAuth flow, and retries with `Authorization: Bearer <token>`.
4. The server checks the token with Clerk (`acceptsToken: "oauth_token"`). If it is valid, a fresh MCP server is created for the request and the `telegram` tool is available.

### Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `CLERK_PUBLISHABLE_KEY` | yes | Clerk publishable key (`pk_...`) |
| `CLERK_SECRET_KEY` | yes | Clerk secret key (`sk_...`) |
| `PORT` | no | HTTP port, default `3000` |

Get both keys from the Clerk dashboard under **API Keys**. The server refuses to start if either is missing. Bun loads a `.env` file from the directory you run it in.

### Run

```bash
bun run dev:remote-mcp        # from the repo root
```

The server reads `x-forwarded-proto` and `x-forwarded-host`, so it works behind a reverse proxy or a tunnel such as ngrok.

### Connect a client

Point the client at `https://<your-host>/<botToken>/mcp`. The token in the URL is sensitive. See [Security notes](#security-notes).

## CLI

Package: `@yuvi_dew_1234/sendkit`, binary `sendkit`.

```bash
# one-time setup: saves the token to ~/.config/sendkit/config.json (mode 0600)
sendkit init --telegram-bot-token <botToken>

# send a message
sendkit telegram <chatId> <message>
```

On success it prints the JSON result, for example `{"ok":true,"chatId":"123","messageId":42}`. Without a saved token it exits with `Telegram bot token is required. Run \`sendkit init\`.` and a non-zero exit code.

Run it without installing:

```bash
bunx @yuvi_dew_1234/sendkit telegram <chatId> "hello"
```

## Core library

Package: `@yuvi_dew_1234/sendkit-core`. It is the shared implementation and can be used on its own:

```ts
import { sendTelegramMessage } from "@yuvi_dew_1234/sendkit-core";

const result = await sendTelegramMessage({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: "123456789",
  message: "Hello from SendKit",
});
// { ok: true, chatId: "123456789", messageId: 42 }
```

It also exports the zod schemas (`telegramMessageInputSchema`, `telegramMessageOptionsSchema`, `telegramMessageOutputSchema`, and the Telegram request and response schemas) and their TypeScript types. Input is validated before any network call.

## Agent skill

`skills/sendkit/SKILL.md` teaches an agent when to use the MCP tool and when to fall back to the CLI. It prefers MCP when the `sendkit` server is connected.

## Development

This is a Bun workspace.

```
apps/remote-mcp      Hono + Clerk remote MCP server
packages/core        shared send logic and schemas
packages/local-mcp   stdio MCP server
packages/cli         commander-based CLI
skills/sendkit       agent skill
```

| Command | What it does |
|---------|--------------|
| `bun install` | Install dependencies |
| `bun run dev:cli <args>` | Run the CLI from source |
| `bun run dev:local-mcp` | Run the stdio MCP server from source |
| `bun run dev:remote-mcp` | Run the remote MCP server |
| `bun run build:core` / `build:local-mcp` / `build:cli` | Build a package with tsdown |
| `bun run typecheck` | Type-check with `tsc --noEmit` |
| `bun run lint` / `lint:fix` | Lint with oxlint |
| `bun run format` / `format:check` | Format with oxfmt |
| `bun run release:pack:<core\|local-mcp\|cli>` | Build and dry-run the npm tarball |

Example: `bun run dev:cli telegram "<chatId>" "hello from cli"`.

## Publishing

`core` must be published first, because `cli` and `local-mcp` depend on it.

1. Log in with `npm login`. The npm scope must match your npm username or an org you own.
2. Enable 2FA on your npm account for "Authorization and publishing".
3. From each package directory, in the order core, local-mcp, cli, run `npm publish --access public`. `prepublishOnly` builds first.
4. Enter your one-time code when npm asks for it.

`workspace:*` dependencies are replaced with real versions when `bun pm pack` or `bun publish` builds the tarball. Check the packed `package.json` before publishing with `npm publish`.

## Security notes

- **Treat the bot token as a password.** Anyone who has it can send messages as your bot. If it leaks, revoke it with `/revoke` in @BotFather.
- **Never commit secrets.** `.env` holds the Clerk keys and is git-ignored. Keep real values out of `.env.example`, and keep bot tokens out of a committed `.mcp.json`.
- **The remote server puts the bot token in the URL path.** It can end up in access logs, proxy logs and browser history. Use HTTPS only, and avoid logging request paths.
- The CLI config file is created with mode `0600`, which has limited effect on Windows.

## Troubleshooting

| Symptom | Cause and fix |
|---------|---------------|
| `CLERK_PUBLISHABLE_KEY environment variable is required` | Create a `.env` file in the directory you run from, with both Clerk keys. |
| `Missing TELEGRAM_BOT_TOKEN ...` | Set `TELEGRAM_BOT_TOKEN` in the MCP client's `env` block. |
| `Telegram bot token is required. Run sendkit init.` | Run `sendkit init --telegram-bot-token <token>`. |
| `Unauthorized` or `chat not found` from Telegram | The token is wrong, or the chat hasn't messaged the bot yet. |
| `401` from the remote server | The client has no valid Clerk OAuth token. Check the Clerk keys and the OAuth setup. |
| `npm publish` returns 404 | The package scope doesn't match your npm username. |
| `npm publish` returns 403 about 2FA | Enable 2FA for publishing and pass `--otp=<code>`. |
