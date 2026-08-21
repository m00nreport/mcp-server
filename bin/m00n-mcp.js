#!/usr/bin/env node

// M00N Report MCP Server
// Enables AI assistants (Claude, Cursor) to query test analytics
//
// Usage:
//   M00N_API_URL=https://m00nreport.com M00N_API_KEY=your-key npx @m00nsolutions/mcp-server
//
// For Cursor/Claude Desktop config, see README.md

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = join(__dirname, '..', 'dist', 'cli.js');

// Check if the package has been built (helpful during development)
if (!existsSync(distPath)) {
  console.error('Error: Package not built. Run "npm run build" first.');
  console.error(`Expected: ${distPath}`);
  process.exit(1);
}

import('../dist/cli.js').catch((err) => {
  console.error('Failed to start M00N MCP server:', err.message);
  process.exit(1);
});
