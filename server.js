import { createServer } from "node:http";
import { readFileSync } from "node:fs";

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const tvHtml = readFileSync("public/tv-widget.html", "utf8");
const orderHtml = readFileSync("public/order-widget.html", "utf8");

const tvs = [
  {
    id: "tv-1",
    name: "Samsung 4K TV",
    price: "$500",
    description: "Sharp 4K picture",
    image: "https://images.unsplash.com/photo-1593784991095-a205069470b6",
  },
  {
    id: "tv-2",
    name: "LG OLED TV",
    price: "$700",
    description: "OLED display",
    image: "https://images.unsplash.com/photo-1461151304267-38535e780c79",
  },
  {
    id: "tv-4",
    name: "TCL Roku TV",
    price: "$450",
    description: "Affordable smart TV with Roku built in",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
  },
];

// in-memory token store
const tokenStore = new Set();

// --------------------
// SCHEMAS
// --------------------

const createOrderInputSchema = z.object({
  tvId: z.string().optional(),
});

const createOrderOutputSchema = z.object({
  order: z.object({
    tvId: z.string(),
    name: z.string(),
    price: z.string(),
    checkoutUrl: z.string(),
    sessionId: z.string(),
  }),
});

const loadCheckoutSessionInputSchema = z.object({
  sessionId: z.string(),
});

const loadCheckoutSessionOutputSchema = z.object({
  order: z.object({
    sessionId: z.string(),
    checkoutUrl: z.string(),
  }),
});

const recommendTvsOutputSchema = z.object({
  tvs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price: z.string(),
      description: z.string(),
      image: z.string(),
    })
  ),
});

// --------------------
// HELPERS
// --------------------

function replyWithTvs() {
  return {
    content: [{ type: "text", text: "TV recommendations" }],
    structuredContent: {
      tvs,
    },
  };
}

function createOrderResponse(tv) {
  const sessionId = `KpiqLYjU`;
  const checkoutUrl = `https://spdpone.syfpos.com/mppcore/d2d/${sessionId}`;

  return {
    content: [
      {
        type: "text",
        text: `Checkout session created for ${tv.name}`,
      },
    ],
    structuredContent: {
      order: {
        tvId: tv.id,
        name: tv.name,
        price: tv.price,
        checkoutUrl,
        sessionId,
      },
    },
  };
}

function loadCheckoutSessionResponse(sessionId) {
  const checkoutUrl = `https://spdpone.syfpos.com/mppcore/d2d/${sessionId}`;

  return {
    content: [
      {
        type: "text",
        text: `Checkout session loaded`,
      },
    ],
    structuredContent: {
      order: {
        sessionId,
        checkoutUrl,
      },
    },
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

// --------------------
// MCP SERVER
// --------------------

function createTvServer() {
  const server = new McpServer({
    name: "tv-app",
    version: "1.0.0",
  });

  registerAppResource(
    server,
    "tv-widget",
    "ui://widget/tv.html",
    {},
    async () => ({
      contents: [
        {
          uri: "ui://widget/tv.html",
          mimeType: RESOURCE_MIME_TYPE,
          text: tvHtml,
          _meta: {
            "openai/widgetCSP": {
              resource_domains: [
                "https://images.unsplash.com"
              ],
              redirect_domains: [
                "https://spdpone.syfpos.com"
              ]
            }
          }
        },
      ],
    })
  );

  registerAppResource(
    server,
    "order-widget",
    "ui://widget/order.html",
    {},
    async () => ({
      contents: [
        {
          uri: "ui://widget/order.html",
          mimeType: RESOURCE_MIME_TYPE,
          text: orderHtml,

        },
      ],
    })
  );

  registerAppTool(
    server,
    "recommend_tvs",
    {
      title: "TV Recommendation Expert",
      description: "Show TV recommendations",
      inputSchema: z.object({}),
      outputSchema: recommendTvsOutputSchema,
      _meta: {
        ui: {
          resourceUri: "ui://widget/tv.html",
        }
      }
    },
    async () => {
      return replyWithTvs();
    }
  );

  registerAppTool(
    server,
    "create_order",
    {
      title: "Create Order",
      description: "Create a checkout session and return session details",
      inputSchema: createOrderInputSchema,
      outputSchema: createOrderOutputSchema,
      _meta: {},
    },
    async (args) => {
      const requestedTvId = args?.tvId;
      const tv = tvs.find((item) => item.id === requestedTvId) || tvs[0];

      return createOrderResponse(tv);
    }
  );

  registerAppTool(
    server,
    "load_checkout_session",
    {
      title: "Load Checkout Session",
      description: "Load checkout session widget using a session id",
      inputSchema: loadCheckoutSessionInputSchema,
      outputSchema: loadCheckoutSessionOutputSchema,
      _meta: {
        ui: {
          resourceUri: "ui://widget/order.html",
        },
      },
    },
    async (args) => {
      return loadCheckoutSessionResponse(args.sessionId);
    }
  );

  return server;
}

// --------------------
// CONFIG
// --------------------

const port = 8787;
const MCP_PATH = "/mcp";
const TOKEN_API_PATH = "/api/token";
const TOKEN_FLUSH = "/api/token/flush";

// --------------------
// HTTP SERVER
// --------------------

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (url.pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Server running");
    return;
  }

  // POST /api/token
  // body: { "tokenId": "abc123" }
  if (url.pathname === TOKEN_API_PATH && req.method === "POST") {
    try {
      const data = await readJsonBody(req);
      const tokenId = data?.tokenId;

      if (!tokenId || typeof tokenId !== "string") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "tokenId is required" }));
        return;
      }

      tokenStore.add(tokenId);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Token stored successfully",
          tokenId,
        })
      );
      return;
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }
  }

  // GET /api/token?tokenId=abc123
  if (url.pathname === TOKEN_API_PATH && req.method === "GET") {
    const tokenId = url.searchParams.get("tokenId");

    if (!tokenId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "tokenId query param is required" }));
      return;
    }

    if (tokenStore.has(tokenId)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ exists: true, tokenId }));
      return;
    }

    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/token?tokenId=abc123
  if (url.pathname === TOKEN_FLUSH&& req.method === "GET") {
    tokenStore.clear();
    res.writeHead(200);
    res.end();
    return;
  }

  // MCP endpoint
  if (url.pathname === MCP_PATH) {
    const server = createTvServer();
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

// --------------------
// START SERVER
// --------------------

httpServer.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`MCP endpoint: http://localhost:${port}${MCP_PATH}`);
  console.log(`POST endpoint: http://localhost:${port}${TOKEN_API_PATH}`);
  console.log(
    `GET endpoint: http://localhost:${port}${TOKEN_API_PATH}?tokenId=your-token`
  );
});