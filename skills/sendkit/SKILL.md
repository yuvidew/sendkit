---
name: sendkit
description: SendKit by @yuvi_dev_1234. Use SendKit to send Telegram messages from agents through the SendKit MCP tool or CLI fallback. Use when a user asks to send a Telegram message, use SendKit, interact with the SendKit toolset, verify SendKit manually, or choose between SendKit MCP and CLI workflows. Trigger this even if the user only says "message me on Telegram", "notify chat <id>", or "ping me when done" and a SendKit tool or the `sendkit` command is available.
---

# SendKit

SendKit sends Telegram text messages through the Telegram Bot API. One shared core function (`sendTelegramMessage`) sits behind three front ends, so they all behave the same:

| Front end | How you reach it | Where the bot token comes from |
|---|---|---|
| Local MCP (`sendkit-local`) | MCP tool `telegram`, over stdio | `TELEGRAM_BOT_TOKEN` in the MCP client's env |
| Remote MCP (`sendkit-remote`) | MCP tool `telegram`, over HTTP with Clerk OAuth | Bot token in the server URL path; the user signs in via Clerk |
| CLI | `sendkit telegram <chatId> <message>` | `~/.config/sendkit/config.json`, written by `sendkit init` |

Maintained by @yuvi_dev_1234. Packages are published on npm under that author's scope: `@yuvi_dew_1234/sendkit` (CLI), `@yuvi_dew_1234/sendkit-mcp` (local MCP server) and `@yuvi_dew_1234/sendkit-core` (shared library).

## Choosing a path

Prefer the MCP tool. It is already authenticated, needs no shell, and returns structured output. Fall back to the CLI only when no SendKit MCP tool is available in the session (it may appear as `telegram` under a `sendkit` server, e.g. `mcp__sendkit__telegram`). MCP-first matters because the CLI needs its own token setup and shell access, which many agent environments lack.

## MCP workflow (preferred)

1. Confirm a SendKit MCP tool is available (`telegram`, e.g. `mcp__sendkit__telegram`). If not, switch to the CLI workflow.
2. Get the `chatId` and message text from the user. Ask if the chat ID is missing.
3. Call `telegram`.
4. Read the result and tell the user it was sent, including the message ID. On error, use Troubleshooting below.

Call `telegram` with two required strings:

- `chatId`: the Telegram chat ID (user, group, or channel). Pass it as a string.
- `message`: the plain text to send.

Success returns `{ ok: true, chatId, messageId }` and text like `Send Telegram message 42 to chat 123`. Report the message ID back to the user so they can confirm delivery.

Use the chat ID the user gave you. If they did not give one and none is configured in context, ask for it rather than guessing, since a wrong ID either fails or messages the wrong person.

## CLI workflow (fallback)

Use this only when no SendKit MCP tool is available.

1. Pick how to run it: a global `sendkit` if `sendkit --help` works, otherwise no install is needed, use `bunx @cwa-dev/sendkit` (or `npx @cwa-dev/sendkit`) in place of `sendkit` below.
2. Check it is configured: `~/.config/sendkit/config.json` must hold a token. If not, run `init` with the user's bot token.
3. Run `sendkit telegram "<chatId>" "<message>"`.
4. Parse the JSON on stdout and report the message ID. A non-zero exit means failure, so read stderr and use Troubleshooting below.

```bash
# one-time setup: stores the token at ~/.config/sendkit/config.json (mode 0600)
sendkit init --telegram-bot-token "<bot token>"

# send
sendkit telegram "<chatId>" "<message>"
```

Output is one line of JSON (`{"ok":true,"chatId":"...","messageId":N}`). Errors go to stderr with exit code 1. Quote the message so the shell does not split it.

### Install and use

Run without a global install (nothing to clean up afterward):

```bash
bunx @cwa-dev/sendkit init --telegram-bot-token "<bot token>"   # once
bunx @cwa-dev/sendkit telegram <chatId> <message>
# npx equivalent
npx @cwa-dev/sendkit telegram <chatId> <message>
```

Or install globally to get the short `sendkit` command: `npm install -g @cwa-dev/sendkit` (or `bun add -g @cwa-dev/sendkit`), then use the `sendkit ...` commands above. Inside the SendKit repo itself, use `bun run dev:cli telegram "<chatId>" "<message>"`.

## Verifying manually

To check the setup end to end, send a short test message to a chat the user owns (their own chat ID), then ask them to confirm it arrived. Do this instead of assuming a success response means the right person saw it.

- MCP: call `telegram` with a message like `SendKit test`.
- CLI: `sendkit telegram "<chatId>" "SendKit test"` and confirm the JSON has `"ok":true`.
- Local repo dev: `bun run dev:cli telegram "<chatId>" "hello from cli"` or `bun run dev:local-mcp` to start the stdio server.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Missing TELEGRAM_BOT_TOKEN ...` | Local MCP has no token. Add `TELEGRAM_BOT_TOKEN` to the MCP server's `env` in the client config and restart the client. |
| `Telegram bot token is required. Run \`sendkit init\`.` | CLI not configured. Run `sendkit init --telegram-bot-token ...`. |
| `Chat ID is required` / `Message is required` | Empty string passed. Both fields must be non-empty. |
| Telegram error like `chat not found` or `Forbidden` | The bot cannot reach that chat. The user must message the bot first (or add it to the group/channel), and the chat ID must be correct. |
| 401 from remote MCP | Clerk sign-in not completed; re-authenticate in the MCP client. |

## Handling secrets

Bot tokens grant full control of the bot. Never echo a token back in chat, put it in a message, commit it, or paste it into a command line that gets logged if an env var or the config file works instead. If you notice a real token in a tracked file such as `.env.example`, tell the user so they can revoke it via BotFather and replace it with a placeholder.

## Scope

SendKit currently sends plain text only: no attachments, formatting modes, or reading incoming messages. If the user asks for those, say so instead of improvising with raw Bot API calls.
