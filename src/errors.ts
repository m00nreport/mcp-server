/**
 * Turning an API failure into a message the user can act on.
 *
 * Kept apart from the client, and exported, because this is the part a test can
 * hold still: the mapping from a response to a sentence. Inside the class it was
 * a private method that nothing could reach, which is how two of the messages
 * below came to say the opposite of what the server had said.
 */

/** The error body our API sends. Every field is optional in practice. */
export interface ApiErrorBody {
  error?: string;
  message?: string;
  code?: string;
  retryAfter?: number;
  [key: string]: unknown;
}

interface ErrorLike {
  isAxiosError?: boolean;
  code?: string;
  message?: string;
  response?: {
    status: number;
    data?: ApiErrorBody;
    headers?: Record<string, string | number | undefined>;
  };
}

function isAxiosLike(error: unknown): error is ErrorLike {
  return Boolean(error && typeof error === 'object' && (error as ErrorLike).isAxiosError);
}

/** The server's own explanation, when it sent one. */
function serverSaid(data: ApiErrorBody | undefined): string | undefined {
  const said = data?.message || data?.error;
  return typeof said === 'string' && said.trim().length > 0 ? said.trim() : undefined;
}

function headerValue(
  headers: Record<string, string | number | undefined> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const found = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );
  return found && found[1] !== undefined ? String(found[1]) : undefined;
}

/**
 * How long to wait before retrying, from whichever of the three places the
 * server put it. All three are sent, and the client kept none of them - so the
 * agent that hit the limit had no way to know whether to wait a second or a
 * minute, and a bulk edit stopped half-applied.
 */
export function retryAfterSeconds(error: unknown): number | undefined {
  if (!isAxiosLike(error) || !error.response) return undefined;
  const headers = error.response.headers;

  const retryAfter = headerValue(headers, 'retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
    // The header also allows an HTTP date.
    const at = Date.parse(retryAfter);
    if (!Number.isNaN(at)) return Math.max(0, Math.ceil((at - Date.now()) / 1000));
  }

  const reset = headerValue(headers, 'x-ratelimit-reset');
  if (reset) {
    const value = Number(reset);
    if (Number.isFinite(value) && value >= 0) {
      // A reset is either seconds-from-now or an epoch second; anything past the
      // start of 2001 is far too large to be a delay.
      return value > 978_307_200 ? Math.max(0, Math.ceil(value - Date.now() / 1000)) : Math.ceil(value);
    }
  }

  const body = error.response.data?.retryAfter;
  if (typeof body === 'number' && Number.isFinite(body) && body >= 0) return Math.ceil(body);

  return undefined;
}

/**
 * Describe an API failure in one sentence, preferring what the server said over
 * anything this client can guess.
 */
export function describeApiError(error: unknown, context: string, apiUrl: string): Error {
  if (!isAxiosLike(error)) {
    if (error instanceof Error) return error;
    return new Error(`Unknown error during ${context}: ${String(error)}`);
  }

  if (!error.response) {
    if (error.code === 'ECONNREFUSED') {
      return new Error(
        `Cannot connect to M00N Report API at ${apiUrl}. ` +
        'Please verify the URL is correct and the server is running.'
      );
    }
    if (error.code === 'ENOTFOUND') {
      return new Error(
        `Cannot resolve M00N Report API host: ${apiUrl}. Please check the URL is correct.`
      );
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return new Error(
        'Request to M00N Report API timed out. ' +
        'Try increasing M00N_TIMEOUT_MS or check network connectivity.'
      );
    }
    const message = error.message || '';
    if (message.includes('self-signed') || message.includes('certificate')) {
      return new Error(
        `SSL certificate error connecting to ${apiUrl}. ` +
        'For self-signed certificates, set M00N_INSECURE_SSL=true'
      );
    }
    return new Error(`Network error during ${context}: ${message}`);
  }

  const status = error.response.status;
  const said = serverSaid(error.response.data);

  switch (status) {
    case 401:
      return new Error(
        'Authentication failed: Invalid or expired MCP key. ' +
        'Please check M00N_API_KEY is a valid MCP key from Settings -> MCP Keys.'
      );
    case 403:
      return new Error(
        `Access denied: ${said || 'You do not have permission for this operation.'}`
      );
    case 404:
      // The server's own message is the useful half and it used to be discarded
      // for a guess. A 404 from a tool call names what was not found and often
      // lists what is - "Project not found. Available projects: ..." - and the
      // client replaced that with "API version mismatch or incorrect URL",
      // sending the user to check three settings that were all correct.
      return new Error(
        said
          ? `Not found during ${context}: ${said}`
          : `API endpoint not found: ${context}. ` +
            'This may indicate an API version mismatch or incorrect URL.'
      );
    case 429: {
      const seconds = retryAfterSeconds(error);
      const wait = seconds !== undefined ? ` Retry after ${seconds}s.` : '';
      return new Error(`Rate limit exceeded.${wait}${said ? ` ${said}` : ''}`);
    }
    case 500:
    case 502:
    case 503:
      return new Error(
        `M00N Report API server error (${status}): ${said || 'Please try again later.'}`
      );
    default:
      return new Error(
        `API error (${status}) during ${context}: ${said || error.message || 'no reason given'}`
      );
  }
}
