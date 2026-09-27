import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { sendTelegramMessage, telegramMessageInputSchema } from "sendkit-core";

const server = new McpServer({
    name: "sendkit-local",
    version: "0.0.0"
});

const getTelegramBotToken = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        throw new Error("Missing TELEGRAM_BOT_TOKEN is required. Configure it in your MCP client enviroment.");
    };

    return token;
};

server.registerTool(
    "telegram",
    {
        title : "Telegram",
        description : "Send a Telegram message",
        inputSchema : telegramMessageInputSchema.shape
    },
    async (input) => {
        const result = await sendTelegramMessage({
            ...input,
            botToken : getTelegramBotToken(),
        });

        return {
            content: [
                {
                    type: "text",
                    text: `Send Telegram message ${result.messageId} to chat ${result.chatId}`,
                },
            ],
            structuredContent: result,
        };
    },
);

const transport = new StdioServerTransport();
await server.connect(transport);