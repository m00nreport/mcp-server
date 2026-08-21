// version.ts - Package version constant
//
// Reads version from package.json to ensure consistency across:
// - package.json
// - User-Agent header
// - MCP server version

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json at runtime
const require = createRequire(import.meta.url);

interface PackageJson {
  name: string;
  version: string;
}

// Try to load from dist/../package.json (runtime) or src/../package.json (dev)
function loadPackageJson(): PackageJson {
  try {
    // When running from dist/, go up one level to find package.json
    return require(join(__dirname, '..', 'package.json'));
  } catch {
    // Fallback for development
    try {
      return require(join(__dirname, '..', '..', 'package.json'));
    } catch {
      // Ultimate fallback
      return { name: '@m00nsolutions/mcp-server', version: '1.0.0' };
    }
  }
}

const pkg = loadPackageJson();

export const VERSION = pkg.version;
export const PACKAGE_NAME = pkg.name;
