import {
    telegramMessageOutputSchema,
    telegramMessageOptionsSchema,
    telegramSendMessageRequestSchema,
    telegramSendMessageResponseSchema,
    type TelegramMessageOptions,
    type TelegramMessageOutput,
} from "./schemas";


// Sends a text message to a Telegram chat via the Bot API.
export const sendTelegramMessage = async (
    input: TelegramMessageOptions
): Promise<TelegramMessageOutput> => {
    const { chatId, message, botToken } = telegramMessageOptionsSchema.parse(input);
    const requestBody = telegramSendMessageRequestSchema.parse({
        chat_id: chatId,
        text: message,
    });

    const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: await Response.json(requestBody).text(),
        }
    );

    const data = telegramSendMessageResponseSchema.parse(await response.json());

    if (!response.ok || !data.ok || !data.result) {
        throw new Error(
            data.description ?? "Telegram message request failed"
        );
    };

    return telegramMessageOutputSchema.parse({
        ok: true,
        chatId,
        messageId: data.result.message_id
    });
};