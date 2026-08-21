// config.ts - Environment variable validation and configuration
//
// Required:
//   M00N_API_URL  - M00N Report API URL (e.g., https://m00nreport.com)
//   M00N_API_KEY  - MCP API key from Settings → MCP Keys
//
// Optional:
//   M00N_INSECURE_SSL  - Skip SSL verification (for self-signed certs)
//   M00N_DEBUG         - Enable verbose logging
//   M00N_TIMEOUT_MS    - Request timeout in ms (default: 30000)

import { z } from 'zod';

// Configuration schema with validation
const ConfigSchema = z.object({
  apiUrl: z
    .string()
    .url('M00N_API_URL must be a valid URL')
    .transform((url) => url.replace(/\/+$/, '')), // Remove trailing slashes
  apiKey: z
    .string()
    .min(1, 'M00N_API_KEY is required')
    .refine(
      (key) => key.startsWith('m00n_mcp_'),
      'M00N_API_KEY should start with "m00n_mcp_" - make sure you\'re using an MCP key, not a project API key'
    ),
  insecureSsl: z.boolean().default(false),
  debug: z.boolean().default(false),
  timeoutMs: z.number().int().positive().default(30000),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Parse and validate configuration from environment variables
 * @throws Error if required variables are missing or invalid
 */
export function loadConfig(): Config {
  const rawConfig = {
    apiUrl: process.env.M00N_API_URL,
    apiKey: process.env.M00N_API_KEY,
    insecureSsl: parseBooleanEnv(process.env.M00N_INSECURE_SSL),
    debug: parseBooleanEnv(process.env.M00N_DEBUG),
    timeoutMs: parseIntEnv(process.env.M00N_TIMEOUT_MS, 30000),
  };

  const result = ConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    
    throw new Error(
      `Invalid M00N MCP configuration:\n${errors}\n\n` +
      'Required environment variables:\n' +
      '  M00N_API_URL  - Your M00N Report API URL\n' +
      '  M00N_API_KEY  - MCP key from Settings → MCP Keys\n\n' +
      'Example:\n' +
      '  M00N_API_URL=https://m00nreport.com M00N_API_KEY=m00n_mcp_xxx...'
    );
  }

  return result.data;
}

/**
 * Parse boolean from environment variable
 */
function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

/**
 * Parse integer from environment variable with default
 */
function parseIntEnv(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Log message to stderr (MCP uses stdout for protocol, stderr for logs)
 */
export function log(message: string, config?: Config): void {
  if (config?.debug || !config) {
    console.error(`[m00n-mcp] ${message}`);
  }
}

/**
 * Log debug message (only when M00N_DEBUG=true)
 */
export function debug(message: string, config: Config): void {
  if (config.debug) {
    console.error(`[m00n-mcp:debug] ${message}`);
  }
}
