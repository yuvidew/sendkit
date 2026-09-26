import { Command } from "Commander";

type TelegramResponse = {
    ok: boolean;
    result?: {
        message_id?: number;
    };
    description?: string;
}

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

        const response = await fetch(
            `https://api.telegram.org/bot${token}/sendMessage`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                }),
            }
        );

        const data = (await response.json()) as TelegramResponse;

        if (!response.ok || !data.ok) {
            const detail = data.description ?? response.statusText;

            console.error(`Telegram API request failed: ${detail}`);
            process.exit(1);
        }

        const messageId = data.result?.message_id;

        console.log(`Sent Telegram message to chat ${chatId}.`);

        if (messageId !== undefined) {
            console.log(`Telegram message ID: ${messageId}`);
        }
    })

program.parseAsync(process.argv);

// https://api.telegram.org/bot8227777093:AAEiUFafU8ATYcPlYBX0ikJSe-GGhOQimGE/getUpdates