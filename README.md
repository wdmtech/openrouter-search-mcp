# OpenRouter Search MCP Server

A Model Context Protocol (MCP) server that provides web search functionality using OpenRouter's online-enabled models.

## Features

- **Web Search**: Search the web using OpenRouter's online models
- **Customizable Models**: Configure which OpenRouter model to use via environment variables or per-request parameters
- **Flexible Configuration**: Support for both global and per-request model selection

## Installation

1. Clone or create this server in your MCP servers directory
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the server:
   ```bash
   npm run build
   ```

## Configuration

### Environment Variables

- `OPENROUTER_API_KEY` (required): Your OpenRouter API key
- `DEFAULT_MODEL` (optional): Default model to use (defaults to `openai/gpt-4o:online`)

### MCP Settings

Add to your MCP settings configuration:

```json
{
  "mcpServers": {
    "openrouter-search": {
      "command": "node",
      "args": ["/path/to/openrouter-search/build/index.js"],
      "env": {
        "OPENROUTER_API_KEY": "your-api-key-here",
        "DEFAULT_MODEL": "openai/gpt-4o:online"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Available Tools

### `web_search`

Search the web using OpenRouter's online models.

**Parameters:**
- `query` (string, required): The search query
- `model` (string, optional): OpenRouter model to use for this search

**Example:**
```json
{
  "query": "latest developments in AI",
  "model": "anthropic/claude-3-5-sonnet:online"
}
```

## Supported Models

For web search functionality, you can use any OpenRouter model with the `:online` suffix:

- `openai/gpt-4o:online` (default)
- `anthropic/claude-3-5-sonnet:online`
- `anthropic/claude-3-haiku:online`
- `google/gemini-pro:online`
- `openrouter/auto` (automatically selects best model with web plugin)

**How it works**: Adding `:online` to any model slug enables web search via OpenRouter's web plugin powered by Exa. This is equivalent to using the web plugin explicitly.

**Alternative**: You can also use `openrouter/auto` which automatically selects the best model and enables web search.

## Usage Examples

Once configured, you can use the search functionality through your MCP client:

1. **Basic search**: "Search for information about quantum computing"
2. **Model-specific search**: Use the `web_search` tool with a specific model parameter
3. **Environment-based**: Set `DEFAULT_MODEL` to change the default model globally

## Deployment

This server can be deployed as a web service on platforms like Render.com, Heroku, or Railway.

### Render.com Deployment

1. Fork or clone this repository to your GitHub account
2. Connect your GitHub repository to Render.com
3. Create a new Web Service with these settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `OPENROUTER_API_KEY`: Your OpenRouter API key
     - `NODE_ENV`: `production` (optional)
     - `DEFAULT_MODEL`: Your preferred model (optional)

The server will automatically detect the deployment environment and run in web mode, providing both a documentation interface and REST API endpoints.

### Web API Endpoints

When deployed as a web service:

- `GET /` - Documentation and status page
- `GET /health` - Health check endpoint
- `POST /search` - Web search endpoint

**Example API usage:**
```bash
curl -X POST https://your-deployment-url.com/search \
  -H "Content-Type: application/json" \
  -d '{"query": "latest AI developments", "model": "openai/gpt-4o:online"}'
```

## Development

To modify or extend this server:

1. Edit `src/index.ts`
2. Run `npm run build` to compile
3. Restart your MCP client to reload the server

## License

MIT License
