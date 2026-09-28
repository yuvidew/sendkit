import { Hono, type Context } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { sendTelegramMessage, telegramMessageInputSchema } from "sendkit-core";
import { createClerkClient } from "@clerk/backend";
import { generateClerkProtectedResourceMetadata } from "@clerk/mcp-tools/server";

// Clerk publishable key used to identify this app to Clerk's frontend/backend APIs
const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;
// Clerk secret key used for server-side authentication with Clerk
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

if (!clerkPublishableKey) {
    throw new Error("CLERK_PUBLISHABLE_KEY environment variable is required");
}

if (!clerkSecretKey) {
    throw new Error("CLERK_SECRET_KEY environment variable is required");
}


// Clerk client instance used to verify/manage auth for incoming requests
const clerkClient = createClerkClient({
    publishableKey: clerkPublishableKey,
    secretKey: clerkSecretKey,
});

// Builds a fresh MCP server instance bound to a specific Telegram bot token
const createServer = (botToken: string) => {
    const server = new McpServer({
        name: "sendkit-remote",
        version: "0.0.0"
    });

    // Registers the "telegram" tool that MCP clients can call to send messages
    server.registerTool(
        "telegram",
        {
            title: "Telegram",
            description: "Send a Telegram message",
            inputSchema: telegramMessageInputSchema.shape
        },
        async (input) => {
            // Delegates the actual Telegram API call to sendkit-core
            const result = await sendTelegramMessage({
                ...input,
                botToken,
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

    return server;
};

// Hono app that exposes the MCP server over HTTP
const app = new Hono();

// protected the url
const protectedResourceMetadataUrl = (c: Context, botToken: string) => {
  return new URL(
    `/.well-known/oauth-protected-resource/${botToken}/mcp`,
    c.req.url
  ).toString();
};

// protecting the un authorized response
const unauthorizedMcpResponse = (c: Context, botToken: string) => {
  c.header(
    "WWW-Authenticate",
    `Bearer resource_metadata="${protectedResourceMetadataUrl(c, botToken)}"`
  );

  return c.json({ error: "Unauthorized" }, 401);
}

// Serves OAuth protected resource metadata so MCP clients can discover how to authenticate
app.get("/.well-known/oauth-protected-resource/:botToken/mcp", (c) => {
    return c.json(
        generateClerkProtectedResourceMetadata({
            publishableKey: clerkPublishableKey,
            resourceUrl: new URL(
                `/${c.req.param("botToken")}/mcp`,
                c.req.url
            ).toString(),
        })
    );
});

// Handles MCP requests, using the botToken from the URL to scope each session's server/transport
app.post("/:botToken/mcp", async (c) => {
    const botToken = c.req.param("botToken");
    const authHeader = c.req.header("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return unauthorizedMcpResponse(c, botToken);
    };

    try {
        const requestState = await clerkClient.authenticateRequest(c.req.raw, {
            acceptsToken : "oauth_token",
        });

        if (!requestState.isAuthenticated) {
            return unauthorizedMcpResponse(c, botToken);
        }

    } catch (error) {
        return unauthorizedMcpResponse(c, botToken);
    }

    const server = createServer(botToken);

    // Stateless HTTP transport (no session persistence) that streams JSON responses
    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });

    await server.connect(transport);

    try {
        return await transport.handleRequest(c.req.raw);
    } catch (error) {
        await server.close();
    }
});

// Fallback handler for unmatched routes
app.notFound((c) => {
    return c.json({
        error: "Not found"
    }, 404);
});

// Server port, defaulting to 3000 when not set in the environment
const port = Number(process.env.PORT ?? 3000);

// Entry point consumed by the Bun/Node runtime to start the HTTP server
export default {
    port,
    fetch: (req: Request) => {
        const url = new URL(req.url);

        url.protocol = req.headers.get("x-forwarded-proto") ?? url.protocol;
        url.host = req.headers.get("x-forwarded-host") ?? url.host;

        return app.fetch(new Request(url, req));
    },
};