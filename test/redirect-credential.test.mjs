import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { M00NApiClient } from '../dist/api-client.js';
import { describeApiError } from '../dist/errors.js';

/**
 * The MCP key travels in X-MCP-Key, a header name no HTTP library knows anything
 * about. Redirect handling strips the auth headers it recognises, Authorization
 * among them, and forwards everything else verbatim. So a redirect off the
 * configured origin hands the credential to whatever host answers next.
 *
 * The instance URL is user-supplied and self-hosted instances sit behind
 * proxies, so a redirect is not exotic.
 */

const KEY = 'm00n_mcp_000000000000000000000000000000000000000000000000';

/** Start a server and resolve once it is listening. */
function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const close = (server) => new Promise((resolve) => server.close(resolve));

test('the MCP key is not handed to a host we were redirected to', async () => {
  // The second host records what actually arrived.
  const received = [];
  const second = await listen((req, res) => {
    received.push({ url: req.url, headers: req.headers });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: 'other-host' }));
  });

  // 127.0.0.1 and localhost are different hosts to a redirect follower, which is
  // the case that matters: same machine here, a different origin in the wild.
  const first = await listen((req, res) => {
    res.writeHead(302, { Location: `http://localhost:${second.port}${req.url}` });
    res.end();
  });

  const client = new M00NApiClient({
    apiUrl: `http://127.0.0.1:${first.port}`,
    apiKey: KEY,
    insecureSsl: false,
    debug: false,
    timeoutMs: 5000,
  });

  // Either outcome is acceptable for the CALL. What is not acceptable is the key
  // arriving at the second host.
  await client.checkHealth().catch(() => undefined);

  await close(first.server);
  await close(second.server);

  const leaked = received.filter((r) => r.headers['x-mcp-key'] !== undefined);
  assert.deepEqual(
    leaked.map((r) => r.url),
    [],
    `the key was sent to the redirect target on: ${leaked.map((r) => r.url).join(', ')}`,
  );
});

test('a redirect does not silently succeed against another host', async () => {
  // Following a redirect quietly would also mean every answer came from a host
  // the user never configured, which is worth failing over even without a
  // credential attached.
  const second = await listen((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: 'other-host' }));
  });

  const first = await listen((req, res) => {
    res.writeHead(302, { Location: `http://localhost:${second.port}${req.url}` });
    res.end();
  });

  const client = new M00NApiClient({
    apiUrl: `http://127.0.0.1:${first.port}`,
    apiKey: KEY,
    insecureSsl: false,
    debug: false,
    timeoutMs: 5000,
  });

  let result;
  let error;
  try {
    result = await client.checkHealth();
  } catch (e) {
    error = e;
  }

  await close(first.server);
  await close(second.server);

  assert.ok(error, 'the call resolved against a host that was never configured');
  assert.notEqual(result?.version, 'other-host');
});

/**
 * What the refusal says. A message that names the wrong problem sends the reader
 * to change a setting that was never at fault.
 */

const axiosError = (status, headers) => ({
  isAxiosError: true,
  message: `Request failed with status code ${status}`,
  response: { status, data: undefined, headers },
});

test('304 Not Modified is not reported as a redirect', () => {
  // It carries no destination and nothing moved. Calling it a redirect would
  // tell the user to change M00N_API_URL over a cache answer.
  const message = describeApiError(axiosError(304, {}), 'checking health', 'https://x.test').message;
  assert.doesNotMatch(message, /redirected/);
});

test('a real redirect names where it pointed, whatever the header case', () => {
  // Header casing is not guaranteed across HTTP versions and proxies.
  const message = describeApiError(
    axiosError(301, { Location: 'https://elsewhere.test/api/health' }),
    'checking health',
    'https://x.test',
  ).message;
  assert.match(message, /redirected to https:\/\/elsewhere\.test\/api\/health/);
  assert.match(message, /Set M00N_API_URL/);
});

test('a relative redirect is not blamed on the base URL', () => {
  // The host answered; a proxy rewrote the path. Telling the user to change
  // M00N_API_URL would have them chase the wrong thing.
  const message = describeApiError(
    axiosError(302, { location: '/v2/api/health' }),
    'checking health',
    'https://x.test',
  ).message;
  assert.match(message, /relative redirect/);
  assert.doesNotMatch(message, /Set M00N_API_URL/);
});

test('every relocating status is covered', () => {
  for (const status of [301, 302, 303, 307, 308]) {
    const message = describeApiError(
      axiosError(status, { location: 'https://elsewhere.test/' }),
      'checking health',
      'https://x.test',
    ).message;
    assert.match(message, /redirected/, `status ${status} was not treated as a redirect`);
  }
});
