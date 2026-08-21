// cli.ts - CLI entry point for M00N MCP Server
//
// This is the main entry point invoked by bin/m00n-mcp.js
// It loads configuration from environment variables and starts the server.

import { loadConfig, log } from './config.js';
import { createServer } from './server.js';

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Load and validate configuration
    const config = loadConfig();
    
    // Start the server
    await createServer(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Fatal error: ${message}`);
    
    // Print helpful message for common issues
    if (message.includes('M00N_API_URL') || message.includes('M00N_API_KEY')) {
      console.error('\n' +
        '╔═══════════════════════════════════════════════════════════════╗\n' +
        '║                    CONFIGURATION REQUIRED                     ║\n' +
        '╠═══════════════════════════════════════════════════════════════╣\n' +
        '║  Set the following environment variables:                     ║\n' +
        '║                                                               ║\n' +
        '║  M00N_API_URL  - Your M00N Report URL                         ║\n' +
        '║                  (e.g., https://m00nreport.com)           ║\n' +
        '║                                                               ║\n' +
        '║  M00N_API_KEY  - MCP key from Settings → MCP Keys             ║\n' +
        '║                  (starts with m00n_mcp_)                      ║\n' +
        '║                                                               ║\n' +
        '║  For Cursor, add to your MCP config:                          ║\n' +
        '║                                                               ║\n' +
        '║  {                                                            ║\n' +
        '║    "mcpServers": {                                            ║\n' +
        '║      "m00n": {                                                ║\n' +
        '║        "command": "npx",                                      ║\n' +
        '║        "args": ["@m00nsolutions/mcp-server"],                 ║\n' +
        '║        "env": {                                               ║\n' +
        '║          "M00N_API_URL": "https://m00nreport.com",        ║\n' +
        '║          "M00N_API_KEY": "m00n_mcp_..."                       ║\n' +
        '║        }                                                      ║\n' +
        '║      }                                                        ║\n' +
        '║    }                                                          ║\n' +
        '║  }                                                            ║\n' +
        '╚═══════════════════════════════════════════════════════════════╝\n'
      );
    }
    
    process.exit(1);
  }
}

// Run the main function
main();
