// cli.ts - CLI entry point for M00N MCP Server
//
// This is the main entry point invoked by bin/m00n-mcp.js
// It loads configuration from environment variables and starts the server.

import { resolveStartup, log } from './config.js';
import { createServer } from './server.js';
import { startPreviewServer } from './preview.js';

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const startup = resolveStartup();

    // Nobody has configured this process. Describe the server rather than
    // exiting, so an inspector or a directory can still see what it offers.
    if (startup.mode === 'preview') {
      await startPreviewServer();
      return;
    }

    await createServer(startup.config);
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
