#!/usr/bin/env node

/**
 * OpenRouter Search MCP Server
 * 
 * This MCP server provides web search functionality using OpenRouter's online-enabled models.
 * It can run as both an MCP server (stdio) and as a web service for deployment platforms.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { createServer } from "http";
import { URL } from "url";

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'openai/gpt-4o:online';
const PORT = process.env.PORT || 3000;
const MODE = process.env.MODE || 'auto'; // 'mcp', 'web', or 'auto'

if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY environment variable is required');
}

// Types
interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface SearchParams {
  query: string;
  model?: string;
}

// Validation function
const isValidSearchArgs = (args: any): args is SearchParams =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.query === 'string' &&
  (args.model === undefined || typeof args.model === 'string');

// Define Tool Input Schema according to MCP SDK v1.8+
const WebSearchInputSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Search query'
    },
    model: {
      type: 'string',
      description: 'OpenRouter model to use (optional)',
      default: DEFAULT_MODEL
    }
  },
  required: ['query']
} as const;

class OpenRouterSearchServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'openrouter-search',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://openrouter-search-mcp.onrender.com',
        'X-Title': 'MCP OpenRouter Search',
      },
    });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'web_search',
          description: 'Search the web using OpenRouter online models',
          inputSchema: WebSearchInputSchema,
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'web_search') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      if (!isValidSearchArgs(request.params.arguments)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid input: query parameter is missing or not a string.'
        );
      }

      return await this.performSearch(request.params.arguments);
    });
  }

  private async performSearch(params: SearchParams) {
    const { query } = params;
    const model = params.model || DEFAULT_MODEL;

    try {
      const response = await this.axiosInstance.post('/chat/completions', {
        model: model,
        messages: [
          {
            role: 'user',
            content: query
          }
        ]
      });

      const content = response.data.choices[0]?.message?.content || '';
      
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        throw new McpError(
          ErrorCode.InternalError,
          `OpenRouter API error: ${errorMessage}`
        );
      }
      throw error;
    }
  }

  async runMCP() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('OpenRouter Search MCP server running on stdio');
  }

  async runWebServer() {
    const httpServer = createServer(async (req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>OpenRouter Search MCP Server</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
              .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
              code { background: #e0e0e0; padding: 2px 4px; border-radius: 3px; }
            </style>
          </head>
          <body>
            <h1>OpenRouter Search MCP Server</h1>
            <p>This server is running and ready to accept requests.</p>
            
            <h2>Available Endpoints:</h2>
            
            <div class="endpoint">
              <h3>POST /search</h3>
              <p>Perform a web search using OpenRouter models</p>
              <p><strong>Body:</strong> <code>{"query": "your search query", "model": "optional-model-name"}</code></p>
            </div>

            <div class="endpoint">
              <h3>GET /health</h3>
              <p>Health check endpoint</p>
            </div>

            <h2>Usage as MCP Server:</h2>
            <p>To use this as an MCP server locally, run: <code>node build/index.js</code></p>
            
            <h2>Environment Variables:</h2>
            <ul>
              <li><code>OPENROUTER_API_KEY</code> - Required</li>
              <li><code>DEFAULT_MODEL</code> - Optional (default: openai/gpt-4o:online)</li>
              <li><code>PORT</code> - Optional (default: 3000)</li>
              <li><code>MODE</code> - Optional: 'mcp', 'web', or 'auto' (default: auto)</li>
            </ul>
          </body>
          </html>
        `);
        return;
      }

      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        return;
      }

      if (req.method === 'POST' && req.url === '/search') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            
            if (!data.query || typeof data.query !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing or invalid query parameter' }));
              return;
            }

            const result = await this.performSearch({
              query: data.query,
              model: data.model
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error) {
            console.error('Search error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: error instanceof Error ? error.message : 'Internal server error' 
            }));
          }
        });
        return;
      }

      // 404 for all other routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    httpServer.listen(PORT, () => {
      console.log(`OpenRouter Search web server running on port ${PORT}`);
      console.log(`Visit http://localhost:${PORT} for documentation`);
    });

    // Keep the process alive
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully');
      httpServer.close(() => {
        process.exit(0);
      });
    });
  }

  async run() {
    // Determine mode - prefer web mode for deployment platforms
    const isDeployment = process.env.PORT || process.env.RENDER || process.env.HEROKU_APP_NAME || process.env.NODE_ENV === 'production';
    const shouldRunWeb = MODE === 'web' || (MODE === 'auto' && isDeployment);
    const shouldRunMCP = MODE === 'mcp' || (MODE === 'auto' && !isDeployment);

    if (shouldRunWeb) {
      await this.runWebServer();
    } else if (shouldRunMCP) {
      await this.runMCP();
    } else {
      console.error('No valid mode detected. Set MODE environment variable to "mcp" or "web"');
      process.exit(1);
    }
  }
}

const server = new OpenRouterSearchServer();
server.run().catch(console.error);
