# Todo MCP App

A simple to-do list app built with the OpenAI Apps SDK and Model Context Protocol (MCP).

## Project Structure

```
chatgpt extention/
├── package.json              # Node.js dependencies
├── server.js                 # MCP server implementation
└── public/
    └── todo-widget.html      # Web component UI
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Server Locally

```bash
node server.js
```

The server will start on `http://localhost:8787/mcp`

## Features

- **Add Todos**: Create new todo items through the UI
- **Complete Todos**: Mark todos as done with a checkbox
- **MCP Integration**: Full integration with OpenAI's Model Context Protocol
- **Clean UI**: Built with vanilla HTML/CSS/JavaScript

## Testing with MCP Inspector

You can test the server locally using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector@latest --server-url http://localhost:8787/mcp --transport http
```

This opens a browser window where you can test the tools.

## Exposing to the Internet

To use this with ChatGPT, you need to expose your local server to the internet using ngrok:

```bash
ngrok http 8787
```

This gives you a public URL like `https://<subdomain>.ngrok.app/mcp`

## Adding to ChatGPT

1. Enable [developer mode](https://platform.openai.com/docs/guides/developer-mode) in ChatGPT
2. Go to Settings → Connectors and click Create
3. Paste your public URL with `/mcp` path (e.g., `https://<subdomain>.ngrok.app/mcp`)
4. Name your connector and provide a description
5. Click Create and start using it in a new chat!

## How It Works

### Architecture

1. **Web Component** (`public/todo-widget.html`):
   - User interface rendered in ChatGPT
   - Communicates with the server via JSON-RPC over postMessage
   - Displays todo list and handles user interactions

2. **MCP Server** (`server.js`):
   - Exposes two tools: `add_todo` and `complete_todo`
   - Manages todo state
   - Returns structured content to update the UI
   - Handles HTTP requests to the `/mcp` endpoint

### Tool Definitions

- **add_todo**: Creates a new todo with a title
  - Input: `{ title: string }`
  - Returns: Updated task list

- **complete_todo**: Marks a todo as completed
  - Input: `{ id: string }`
  - Returns: Updated task list

## Next Steps

- Customize the UI in `public/todo-widget.html`
- Add more tools (delete, edit, etc.)
- Add authentication if needed
- Deploy to a hosting provider (Vercel, Heroku, etc.)
- Submit to OpenAI's app marketplace

## Resources

- [Apps SDK Documentation](https://developers.openai.com/apps-sdk)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Examples Repository](https://github.com/openai/openai-apps-sdk-examples)
