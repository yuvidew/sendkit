import {z} from 'zod';

// Raw caller input for sending a Telegram message.
export const telegramMessageInputSchema = z.object({
    chatId: z.string().min(1, "Chat ID is required"),
    message: z.string().min(1, "Message is required"),
});

// Caller input plus the bot token needed to authenticate with Telegram.
export const telegramMessageOptionsSchema = telegramMessageInputSchema.extend({
    botToken: z.string().min(1, "Telegram bot token is required"),
});

// Body shape expected by Telegram's sendMessage API endpoint.
export const telegramSendMessageRequestSchema = z.object({
    chat_id: z.string().min(1),
    text: z.string().min(1),
});

// Response shape returned by Telegram's sendMessage API endpoint.
export const telegramSendMessageResponseSchema = z.object({
    ok: z.boolean(),
    result: z
    .object({
        message_id: z.number(),
    })
    .optional(),
    description: z.string().optional(),
});

// Normalized result returned to callers after a successful send.
export const telegramMessageOutputSchema = z.object({
    ok: z.literal(true),
    chatId: z.string(),
    messageId: z.number(),
});

// Type for telegramMessageInputSchema.
export type TelegramMessageInput = z.infer<
  typeof telegramMessageInputSchema
>;

// Type for telegramMessageOptionsSchema.
export type TelegramMessageOptions = z.infer<
  typeof telegramMessageOptionsSchema
>;

// Type for telegramMessageOutputSchema.
export type TelegramMessageOutput = z.infer<
  typeof telegramMessageOutputSchema
>;