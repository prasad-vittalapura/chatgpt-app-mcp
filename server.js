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

const recommendTvsInputSchema = {};

const createOrderInputSchema = {
  tvId: z.string(),
  name: z.string(),
  price: z.string(),
};

const tvs = [
  {
    id: "tv-1",
    name: "Samsung 4K TV",
    price: "$500",
    description:
      "Sharp 4K picture, slim design, and great value for everyday streaming.",
    image:
      "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "tv-2",
    name: "LG OLED TV",
    price: "$700",
    description:
      "Premium OLED contrast with vibrant colors for movies and gaming.",
    image:
      "https://images.unsplash.com/photo-1461151304267-38535e780c79?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "tv-3",
    name: "Sony Bravia LED TV",
    price: "$650",
    description:
      "Balanced sound and picture quality with a polished smart TV experience",
    image:
      "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80",
  },
];

function replyWithTvs(message) {
  return {
    content: message ? [{ type: "text", text: message }] : [],
    structuredContent: { tvs },
  };
}

function replyWithOrder(tvId, name, price) {
      let token = "VipUkIFc";
  const checkoutUrl =
    "https://spdpone.syfpos.com/mppcore/d2d/" +token;

  return {
    content: [
      {
        type: "text",
        text: `Checkout created for ${name}`,
      },
    ],
    structuredContent: {
      order: {
        tvId,
        name,
        price,
        checkoutUrl,
      },
    },
  };
}

function createTvServer() {
  const server = new McpServer({
    name: "tv-app",
    version: "0.1.0",
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
        },
      ],
    })
  );

  registerAppTool(
    server,
    "recommend_tvs",
    {
      title: "Recommend TVs",
      description: "Shows the best TV recommendations.",
      inputSchema: recommendTvsInputSchema,
      _meta: {
        ui: { resourceUri: "ui://widget/tv.html" },
      },
    },
    async () => {
      return replyWithTvs("Here are the best TV recommendations.");
    }
  );

  registerAppTool(
    server,
    "create_order",
    {
      title: "Create Order",
      description: "Creates a TV order and returns a checkout URL",
      inputSchema: createOrderInputSchema,
      _meta: {
        ui: {
          visibility: ["app"],
        },
      },
    },
    async ({ tvId, name, price }) => {
      return replyWithOrder(tvId, name, price);
    }
  );

  return server;
}

const port = Number(process.env.PORT || 8787);
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("TV MCP Server is running");
    return;
  }

  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);

  if (url.pathname === MCP_PATH && MCP_METHODS.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createTvServer();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }

    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`TV MCP server listening on http://localhost:${port}${MCP_PATH}`);
});