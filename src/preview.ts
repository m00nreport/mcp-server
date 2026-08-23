// preview.ts - what the server answers before anyone has configured it
//
// The live server learns what it offers by asking your instance at startup, so
// without a key it used to exit before speaking MCP at all. That made it
// invisible to everything that looks at a server before it is configured: an
// inspector, a directory building it to see what it does, a client offering to
// show the tool surface, or a person deciding whether to sign up.
//
// Preview mode answers the listings from a snapshot of a real instance and
// refuses every call. It is a description of the server, never a working one.

import { createRequire } from 'module';
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
import { Tool, StaticResource, ResourceTemplate, Prompt } from './api-client.js';
import { log } from './config.js';
import {
  toToolDefinition,
  toResourceDefinition,
  toTemplateDefinition,
  toPromptDefinition,
} from './list-shapes.js';
import { VERSION, PACKAGE_NAME } from './version.js';

export interface PreviewSnapshot {
  tools: Tool[];
  prompts: Prompt[];
  resources: StaticResource[];
  resourceTemplates: ResourceTemplate[];
}

/** Said once in the log, and again in every refused call. */
export const CONFIGURE_HINT =
  'This M00N Report MCP server is running unconfigured, so it can describe what it ' +
  'offers but cannot do anything. Set M00N_API_URL and M00N_API_KEY to connect it to ' +
  'an instance. An MCP key comes from Settings, MCP Keys, and starts with m00n_mcp_.';

/**
 * Load the snapshot that ships beside the built code.
 *
 * One resolve, no fallback: this file sits one level below the package root
 * whether it runs from dist/ or from src/, so '../' is right in both cases.
 *
 * The failure is worth reporting properly rather than retrying. It means the
 * file was left out of the package or the image, and the raw module error names
 * a path inside node_modules that tells the reader nothing about what to do.
 */
export function loadSnapshot(): PreviewSnapshot {
  const require = createRequire(import.meta.url);
  const path = new URL('../preview-snapshot.json', import.meta.url).pathname;
  try {
    return require('../preview-snapshot.json') as PreviewSnapshot;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not read the preview snapshot at ${path}: ${reason}\n` +
        'This file ships with the package and is only used when the server starts ' +
        'unconfigured. Set M00N_API_URL and M00N_API_KEY to connect to an instance ' +
        'instead, or reinstall the package.',
    );
  }
}

/**
 * Build the preview server. Separate from starting it so tests can drive it.
 */
export function buildPreviewServer(snapshot: PreviewSnapshot): Server {
  const hasResources =
    snapshot.resources.length > 0 || snapshot.resourceTemplates.length > 0;

  const server = new Server(
    { name: PACKAGE_NAME, version: VERSION },
    {
      capabilities: {
        tools: {},
        resources: hasResources ? {} : undefined,
        prompts: snapshot.prompts.length > 0 ? {} : undefined,
      },
      // The live server's instructions describe an instance this process cannot
      // reach, so they would read as promises. The snapshot does not carry them.
      instructions: CONFIGURE_HINT,
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: snapshot.tools.map(toToolDefinition),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    // An unknown name is worth saying plainly even here, otherwise a typo and an
    // unconfigured server produce the same message.
    const known = snapshot.tools.some((t) => t.name === name);
    return {
      content: [
        {
          type: 'text',
          text: known
            ? `Cannot run ${name}. ${CONFIGURE_HINT}`
            : `Unknown tool: ${name}. ${CONFIGURE_HINT}`,
        },
      ],
      isError: true,
    };
  });

  if (hasResources) {
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: snapshot.resources.map(toResourceDefinition),
    }));

    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: snapshot.resourceTemplates.map(toTemplateDefinition),
    }));

    server.setRequestHandler(ReadResourceRequestSchema, async () => {
      throw new McpError(ErrorCode.InvalidRequest, CONFIGURE_HINT);
    });
  }

  if (snapshot.prompts.length > 0) {
    server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: snapshot.prompts.map(toPromptDefinition),
    }));

    server.setRequestHandler(GetPromptRequestSchema, async () => {
      throw new McpError(ErrorCode.InvalidRequest, CONFIGURE_HINT);
    });
  }

  return server;
}

/**
 * Start the preview server on stdio.
 */
export async function startPreviewServer(): Promise<void> {
  const snapshot = loadSnapshot();
  const server = buildPreviewServer(snapshot);

  log('Starting unconfigured: describing the server, not connecting to one.');
  log(
    `Preview lists ${snapshot.tools.length} tools and ${snapshot.prompts.length} prompts. ` +
      'Every call will be refused.',
  );
  log(CONFIGURE_HINT);

  server.onerror = (error) => {
    log(`Server error: ${error.message}`);
  };

  const shutdown = async (signal: string) => {
    log(`Received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await server.connect(new StdioServerTransport());
  log('M00N MCP Server running in preview mode (stdio transport)');
}
