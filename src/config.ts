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

  warnIfPlaintext(result.data.apiUrl);
  return result.data;
}

/**
 * An http:// instance sends the MCP key in clear on every request, and no
 * redirect is involved: the first request already carries it. Loopback is
 * exempt because nothing leaves the machine.
 */
function warnIfPlaintext(apiUrl: string): void {
  let host: string;
  try {
    const parsed = new URL(apiUrl);
    if (parsed.protocol !== 'http:') return;
    host = parsed.hostname;
  } catch {
    return;
  }

  const loopback =
    host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
  if (loopback) return;

  console.error(
    `[m00n-mcp] WARNING: M00N_API_URL is http://${host}, so your MCP key is sent unencrypted ` +
    'on every request. Use https unless this is a trusted private network.'
  );
}

/**
 * Whether this process can talk to an instance, or can only describe itself.
 */
export type Startup = { mode: 'live'; config: Config } | { mode: 'preview' };

/**
 * Decide how to start.
 *
 * Preview is for a process nobody has configured yet: an inspector, a directory
 * building the server to see what it offers, someone running it to look before
 * signing up. It answers the listings from a snapshot and refuses tool calls.
 *
 * The trigger is BOTH variables being absent, never one of them. Setting only
 * the URL, or only the key, is someone half way through configuring, and
 * quietly showing them a preview would hide the mistake behind a server that
 * looks like it started.
 *
 * @throws Error if either variable is present and the pair does not validate
 */
export function resolveStartup(): Startup {
  const url = process.env.M00N_API_URL?.trim();
  const key = process.env.M00N_API_KEY?.trim();

  if (!url && !key) {
    return { mode: 'preview' };
  }

  return { mode: 'live', config: loadConfig() };
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
export function parseIntEnv(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === null) return defaultValue;
  const trimmed = String(value).trim();
  if (trimmed === '') return defaultValue;

  // Strict, because parseInt is not: parseInt("60s", 10) is 60 and reports no
  // problem, so a unit suffix would quietly become a 60 millisecond timeout.
  if (!/^[+-]?\d+$/.test(trimmed)) {
    console.error(
      `[m00n-mcp] Ignoring "${trimmed}": this setting is a plain number of ` +
      `milliseconds, with no unit suffix. Using ${defaultValue}.`
    );
    return defaultValue;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(`[m00n-mcp] Ignoring "${trimmed}": must be a positive number. Using ${defaultValue}.`);
    return defaultValue;
  }
  return parsed;
}

/**
 * Log message to stderr (MCP uses stdout for protocol, stderr for logs)
 */
export function log(message: string, _config?: Config): void {
  // Unconditional, and on stderr, where an MCP client collects a server's log:
  // startup steps and errors are the lines worth having without being asked for.
  // Per-request detail goes through debug(), which stays gated on M00N_DEBUG.
  console.error(`[m00n-mcp] ${message}`);
}

/**
 * Log debug message (only when M00N_DEBUG=true)
 */
export function debug(message: string, config: Config): void {
  if (config.debug) {
    console.error(`[m00n-mcp:debug] ${message}`);
  }
}
