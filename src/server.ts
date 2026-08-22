// server.ts - MCP Server setup and tool/resource registration
//
// This module:
// 1. Fetches available tools and resources from M00N Report API
// 2. Registers them with the MCP SDK
// 3. Handles tool invocations and resource reads by proxying to the API

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { M00NApiClient, Tool, StaticResource, ResourceTemplate, Prompt } from './api-client.js';
import { Config, log, debug } from './config.js';
import { VERSION, PACKAGE_NAME } from './version.js';

/**
 * Create and start the MCP server
 */
export async function createServer(config: Config): Promise<void> {
  log('Starting M00N MCP Server...', config);

  // Create API client
  const apiClient = new M00NApiClient(config);

  // Step 1: Check API health
  log(`Connecting to M00N Report API at ${config.apiUrl}...`, config);
  let healthInfo;
  try {
    healthInfo = await apiClient.checkHealth();
    log(`Connected to M00N Report API (version: ${healthInfo.version || 'unknown'}, mode: ${healthInfo.mode || 'unknown'})`, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to connect to M00N Report API: ${message}`);
  }

  // Step 2: Fetch available tools
  log('Fetching available tools...', config);
  let tools: Tool[];
  try {
    tools = await apiClient.fetchTools();
    log(`Loaded ${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch tools from API: ${message}`);
  }

  if (tools.length === 0) {
    throw new Error('No tools available from M00N Report API. Please check your API key permissions.');
  }

  // One attempt was all an optional listing ever got, and its result decided
  // the SESSION: a single 502 from a proxy, or a restart landing mid-startup,
  // and the client is told for as long as it stays connected that this server
  // has no prompts and no resources. Users concluded their instance did not
  // support them. Two more tries, half a second apart, cost nothing on the path
  // where the first one works.
  const optional = async <T>(what: string, fetch: () => Promise<T>): Promise<T | undefined> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await fetch();
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
    }
    // With the reason. "Not available" said nothing about whether the endpoint
    // is missing, the key lacks a scope, or a proxy was in the way.
    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    log(`${what} not available: ${reason}`, config);
    return undefined;
  };

  // Step 2a: Fetch server instructions
  log('Fetching server instructions...', config);
  let instructions: string | undefined;
  const fetched = await optional('Server instructions', () => apiClient.fetchInstructions());
  if (fetched) {
    instructions = fetched;
    log(`Loaded server instructions (${fetched.length} chars)`, config);
  }

  // Step 2b: Fetch available resources (static and templates)
  log('Fetching available resources...', config);
  let staticResources: StaticResource[] = [];
  let resourceTemplates: ResourceTemplate[] = [];
  staticResources =
    (await optional('Static resources', () => apiClient.fetchStaticResources())) ?? [];
  resourceTemplates =
    (await optional('Resource templates', () => apiClient.fetchResourceTemplates())) ?? [];
  // Normalised because a 2xx with an unexpected body assigns undefined here: the
  // API client returns response.data.staticResources without checking it exists,
  // the assignment succeeds, and the .length that throws does so INSIDE the try.
  // This line is outside it, so the TypeError escaped and took down startup -
  // losing all the tools over an optional resource listing.
  staticResources = Array.isArray(staticResources) ? staticResources : [];
  resourceTemplates = Array.isArray(resourceTemplates) ? resourceTemplates : [];
  const hasResources = staticResources.length > 0 || resourceTemplates.length > 0;

  // Step 2c: Fetch available prompts
  log('Fetching available prompts...', config);
  let prompts: Prompt[] = [];
  prompts = (await optional('Prompts', () => apiClient.fetchPrompts())) ?? [];

  prompts = Array.isArray(prompts) ? prompts : [];

  // Step 3: Create MCP server with tools, resources, and prompts capabilities
  const server = new Server(
    {
      name: PACKAGE_NAME,
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: hasResources ? {} : undefined,
        prompts: prompts.length > 0 ? {} : undefined,
      },
      ...(instructions && { instructions }),
    }
  );

  // Register list_tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    debug('Handling list_tools request', config);
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        // Include annotations if present (MCP 2025 spec)
        ...(tool.annotations && { annotations: tool.annotations }),
      })),
    };
  });

  // Register call_tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    debug(`Handling call_tool request: ${name}`, config);

    // Validate tool exists
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    try {
      // Execute tool via API
      const result = await apiClient.callTool(name, args || {});
      
      // Return result as JSON content
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      // Return error as content (not throwing, so Claude can see the error)
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Register resource handlers (if resources available)
  if (hasResources) {
    // Handle list_resources - return static resources
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      debug('Handling list_resources request', config);
      return {
        resources: staticResources.map((r) => ({
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: r.mimeType,
        })),
      };
    });

    // Handle list_resource_templates - dynamic URI templates
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      debug('Handling list_resource_templates request', config);
      return {
        resourceTemplates: resourceTemplates.map((rt) => ({
          uriTemplate: rt.uriTemplate,
          name: rt.name,
          description: rt.description,
          mimeType: rt.mimeType,
        })),
      };
    });

    // Register read_resource handler (works for both static and templated)
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      debug(`Handling read_resource request: ${uri}`, config);

      try {
        const contents = await apiClient.readResource(uri);
        
        return {
          contents: contents.map((c) => ({
            uri: c.uri,
            mimeType: c.mimeType,
            text: c.text,
          })),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InternalError, `Failed to read resource: ${message}`);
      }
    });

    log(`Resources enabled: ${staticResources.length} static, ${resourceTemplates.length} templates`, config);
  }

  // Register prompt handlers (if prompts available)
  if (prompts.length > 0) {
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      debug('Handling list_prompts request', config);
      return {
        prompts: prompts.map((p) => ({
          name: p.name,
          description: p.description,
          arguments: p.arguments.map((arg) => ({
            name: arg.name,
            description: arg.description,
            required: arg.required,
          })),
        })),
      };
    });

    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      debug(`Handling get_prompt request: ${name}`, config);

      // Validate prompt exists
      const prompt = prompts.find((p) => p.name === name);
      if (!prompt) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown prompt: ${name}`);
      }

      try {
        const result = await apiClient.getPromptMessages(name, args || {});
        return {
          messages: result.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InternalError, `Failed to get prompt: ${message}`);
      }
    });

    log(`Prompts enabled: ${prompts.map((p) => p.name).join(', ')}`, config);
  }

  // Step 4: Connect via stdio transport
  const transport = new StdioServerTransport();
  
  // Handle server errors
  server.onerror = (error) => {
    log(`Server error: ${error.message}`, config);
  };

  // Handle process signals for graceful shutdown
  process.on('SIGINT', async () => {
    log('Received SIGINT, shutting down...', config);
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    log('Received SIGTERM, shutting down...', config);
    await server.close();
    process.exit(0);
  });

  // Connect and start serving
  await server.connect(transport);
  log('M00N MCP Server running (stdio transport)', config);
  log('Ready to receive requests from Claude/Cursor', config);
}
