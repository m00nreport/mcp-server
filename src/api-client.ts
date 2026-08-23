// api-client.ts - HTTP client for M00N Report API
//
// Handles:
// - Authentication via X-MCP-Key header
// - SSL verification bypass for self-hosted
// - Timeout and error handling
// - Tool discovery and execution

import axios, { AxiosInstance, AxiosError } from 'axios';
import { describeApiError } from './errors.js';
import https from 'https';
import { Config, debug } from './config.js';
import { VERSION } from './version.js';

// Tool annotations (MCP 2025 spec)
export interface ToolAnnotations {
  /** When true, the tool does not modify any state */
  readOnlyHint?: boolean;
  /** When true, the tool may perform destructive updates */
  destructiveHint?: boolean;
  /** When true, calling repeatedly with same args has no additional effect */
  idempotentHint?: boolean;
  /** When true, tool interacts with external entities beyond its direct args */
  openWorldHint?: boolean;
}

// Tool definition from API
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  annotations?: ToolAnnotations;
}

// Health check response
export interface HealthResponse {
  status: string;
  version?: string;
  mode?: string;
}

// Tool call result
export interface ToolCallResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// Static resource from API
export interface StaticResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

// Resource template from API (dynamic URIs)
export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
}

// Resource content from API
export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

// Prompt argument definition
export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

// Prompt definition from API
export interface Prompt {
  name: string;
  description: string;
  arguments: PromptArgument[];
}

// Prompt message content
export interface PromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
}

// Error response from API
export interface ApiError {
  error: string;
  message: string;
  code?: string;
}

/**
 * M00N Report API Client
 */
export class M00NApiClient {
  private client: AxiosInstance;
  private config: Config;

  constructor(config: Config) {
    this.config = config;

    // Create axios instance with configuration
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeoutMs,
      headers: {
        'X-MCP-Key': config.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': `m00n-mcp-server/${VERSION}`,
      },
      // The credential rides in a custom header, and redirect followers only
      // strip the auth headers they recognise. Following a redirect would hand
      // the key to whatever host answered next, so do not follow one at all.
      // A redirect surfaces as an error naming where it pointed.
      maxRedirects: 0,
      // HTTPS agent with connection reuse and optional SSL verification skip
      httpsAgent: new https.Agent({
        rejectUnauthorized: !config.insecureSsl,
        keepAlive: true,
      }),
    });
  }

  /**
   * Check API health and get version info
   */
  async checkHealth(): Promise<HealthResponse> {
    try {
      debug(`Checking health at ${this.config.apiUrl}/api/health`, this.config);
      const response = await this.client.get<HealthResponse>('/api/health');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'health check');
    }
  }

  /**
   * Fetch server instructions for AI agents
   */
  async fetchInstructions(): Promise<string | null> {
    try {
      debug(`Fetching instructions from ${this.config.apiUrl}/api/mcp/instructions`, this.config);
      const response = await this.client.get<{ instructions: string }>('/api/mcp/instructions');
      return response.data.instructions || null;
    } catch (error) {
      debug('Instructions not available (API may not support them yet)', this.config);
      return null;
    }
  }

  /**
   * Fetch available tools from API
   */
  async fetchTools(): Promise<Tool[]> {
    try {
      debug(`Fetching tools from ${this.config.apiUrl}/api/mcp/tools`, this.config);
      const response = await this.client.get<{ tools: Tool[]; count: number }>('/api/mcp/tools');
      return response.data.tools ?? [];
    } catch (error) {
      throw this.handleError(error, 'fetch tools');
    }
  }

  /**
   * Execute a tool with given arguments
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    try {
      debug(`Calling tool: ${name} with args: ${JSON.stringify(args)}`, this.config);
      const response = await this.client.post<ToolCallResult>('/api/mcp/tools/call', {
        name,
        arguments: args,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, `tool call: ${name}`);
    }
  }

  /**
   * Fetch static resources from API
   */
  async fetchStaticResources(): Promise<StaticResource[]> {
    try {
      debug(`Fetching static resources from ${this.config.apiUrl}/api/mcp/resources`, this.config);
      const response = await this.client.get<{ resources: StaticResource[]; count: number }>('/api/mcp/resources');
      return response.data.resources ?? [];
    } catch (error) {
      throw this.handleError(error, 'fetch resources');
    }
  }

  // Every listing below answers with an empty array when a 2xx body lacks the field it
  // expects. A proxy, a stale API version or an auth page answering 200 with HTML all
  // produce such a body, and returning the field straight out would hand the caller an
  // undefined that only throws somewhere further along.

  /**
   * Fetch resource templates from API (dynamic URIs)
   */
  async fetchResourceTemplates(): Promise<ResourceTemplate[]> {
    try {
      debug(`Fetching resource templates from ${this.config.apiUrl}/api/mcp/resources/templates`, this.config);
      const response = await this.client.get<{ resourceTemplates: ResourceTemplate[]; count: number }>('/api/mcp/resources/templates');
      return response.data.resourceTemplates ?? [];
    } catch (error) {
      throw this.handleError(error, 'fetch resource templates');
    }
  }

  /**
   * Read a resource by URI
   */
  async readResource(uri: string): Promise<ResourceContent[]> {
    try {
      debug(`Reading resource: ${uri}`, this.config);
      const response = await this.client.get<{ contents: ResourceContent[] }>('/api/mcp/resources/read', {
        params: { uri }
      });
      return response.data.contents ?? [];
    } catch (error) {
      throw this.handleError(error, `read resource: ${uri}`);
    }
  }

  /**
   * Fetch available prompts from API
   */
  async fetchPrompts(): Promise<Prompt[]> {
    try {
      debug(`Fetching prompts from ${this.config.apiUrl}/api/mcp/prompts`, this.config);
      const response = await this.client.get<{ prompts: Prompt[]; count: number }>('/api/mcp/prompts');
      return response.data.prompts ?? [];
    } catch (error) {
      throw this.handleError(error, 'fetch prompts');
    }
  }

  /**
   * Get prompt messages with arguments
   */
  async getPromptMessages(name: string, args: Record<string, unknown>): Promise<{ messages: PromptMessage[] }> {
    try {
      debug(`Getting prompt: ${name} with args: ${JSON.stringify(args)}`, this.config);
      const response = await this.client.post<{ messages: PromptMessage[] }>('/api/mcp/prompts/get', {
        name,
        arguments: args
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, `get prompt: ${name}`);
    }
  }

  /**
   * Handle API errors with meaningful messages.
   *
   * The mapping itself lives in errors.ts, where a test can reach it directly.
   */
  private handleError(error: unknown, context: string): Error {
    return describeApiError(error, context, this.config.apiUrl);
  }
}
