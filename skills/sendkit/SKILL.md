---
name: sendkit
description: Send Telegram messages from an agent through the SendKit MCP `telegram` tool, with the SendKit CLI (`@yuvi_dew_1234/sendkit`) as a fallback. Use when a user asks to send a Telegram message, mentions SendKit, wants to interact with the SendKit toolset, asks to verify SendKit manually, or needs to choose between the SendKit MCP and CLI workflows.
---

# SendKit

SendKit sends Telegram messages. It exposes the same operation two ways, both backed by `@yuvi_dew_1234/sendkit-core`:

- **MCP tool** (`sendkit` server → `telegram` tool) — preferred for agents.
- **CLI** (`@yuvi_dew_1234/sendkit`, binary `sendkit`) — fallback when MCP is unavailable or for manual verification.

Both take a `chatId` and a `message`, call the Telegram Bot API, and return `{ ok: true, chatId, messageId }`.

## Choosing MCP vs CLI

Prefer the **MCP tool** whenever the `sendkit` MCP server is connected — it needs no shell and the bot token is supplied by the MCP client environment.

Use the **CLI** when:
- The MCP server is not connected in this session.
- Verifying behavior manually or from a script / terminal.
- A local bot token (not the MCP env token) should be used.

## MCP workflow (preferred)

Call the `telegram` tool on the `sendkit` MCP server with:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `chatId` | string | yes | Telegram chat ID (non-empty) |
| `message` | string | yes | Message text (non-empty) |

The bot token is read from `TELEGRAM_BOT_TOKEN` in the MCP server environment (see `.mcp.json`) — do not pass it in the tool input. On success the tool returns `{ ok: true, chatId, messageId }`.

## CLI workflow (fallback)

First-time setup writes a token to `~/.config/sendkit/config.json` (mode `0600`):

```bash
sendkit init --telegram-bot-token <botToken>
```

Send a message:

```bash
sendkit telegram <chatId> <message>
```

On success it prints the JSON result, e.g. `{"ok":true,"chatId":"123","messageId":42}`. If no token is configured it errors with `Telegram bot token is required. Run \`sendkit init\`.`

Run the CLI without a global install via `bunx @yuvi_dew_1234/sendkit telegram <chatId> <message>` (or the `npx` equivalent).

## Verifying manually

To confirm SendKit works end to end, send a test message to a known chat ID and check the response includes `ok: true` and a numeric `messageId`. Use the CLI for this so the result JSON is visible in the terminal:

```bash
sendkit telegram <yourChatId> "SendKit test message"
```

A non-`ok` response or a thrown error surfaces the Telegram API `description` (e.g. invalid token, unknown chat ID).