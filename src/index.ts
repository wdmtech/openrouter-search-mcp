#!/usr/bin/env node

/**
 * OpenRouter Search MCP Server
 * 
 * This MCP server provides web search functionality using OpenRouter's online-enabled models.
 * It allows customizable model selection via environment variables and tool parameters.
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

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'openai/gpt-4o:online';

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

// Define Tool Output Schema (optional but good practice)
const WebSearchOutputSchema = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          link: { type: 'string' },
          snippet: { type: 'string' }
        }
      }
    }
  }
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
        // Recommended headers by OpenRouter
        'HTTP-Referer': 'http://localhost', // Replace with your actual site URL or app name
        'X-Title': 'MCP OpenRouter Search', // Replace with your actual site URL or app name
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

      const { query } = request.params.arguments;
      const model = request.params.arguments.model || DEFAULT_MODEL;

      try {
        const response = await this.axiosInstance.post('/chat/completions', {
          model: model, // Use customizable model
          messages: [
            {
              role: 'user',
              content: query
            }
          ]
        });

        // The online model should return search results
        // Parse the response to extract structured search results
        const content = response.data.choices[0]?.message?.content || '';
        
        // For now, return the raw content as text
        // In a real implementation, you might want to parse this into structured SearchResult objects
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
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('OpenRouter Search MCP server running on stdio');
  }
}

const server = new OpenRouterSearchServer();
server.run().catch(console.error);
