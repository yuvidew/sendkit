import { Command } from "Commander";
import { sendTelegramMessage } from "sendkit-core"

const program = new Command();

program
    .name("sendkit")
    .description("Sendkit tutorial CLI")
    .command("telegram")
    .description("Send a Telegram message")
    .argument("<chatId>", "Telegram chat ID")
    .argument("<message>", "Message text to send")
    .action(async (chatId: string, message: string) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;

        if (!token) {
            console.error("Missing TELEGRAM_BOT_TOKEN environment veriable.");
            process.exit(1);
        };

        if (!chatId) {
            console.error("Missing Telegram chat ID.");
            process.exit(1);
        };

        if (!message) {
            console.error("Missing Telegram message Text.");
            process.exit(1);
        };

        try {
            const result = await sendTelegramMessage({
                chatId,
                message,
                botToken: token,
            });

            console.log(`Sent Telegram message to chat: ${result.chatId}`);
            console.log(`Telegram message ID: ${result.messageId}`);

        } catch (error) {
            const detail =
                error instanceof Error ? error.message : String(error);

            console.error(`Telegram API request failed: ${detail}`);
            process.exit(1);
        };

    });

program.parseAsync(process.argv);
