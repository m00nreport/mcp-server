import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeApiError, retryAfterSeconds } from '../dist/errors.js';

/**
 * What the user is told when a call fails.
 *
 * Two of these messages used to throw away the answer and replace it with a
 * guess. That is worse than saying nothing: the server had already sent the fix,
 * and the client sent the user somewhere else.
 *
 * The shapes below are what axios hands the client - `isAxiosError`, a `response`
 * with a status, a body and headers - so the mapping is exercised exactly as it
 * runs, without standing up an HTTP server to produce a 404 on demand.
 */

const API_URL = 'https://api.m00nreport.com';

function axiosError({ status, data, headers, code, message = 'Request failed' }) {
  return {
    isAxiosError: true,
    code,
    message,
    ...(status !== undefined && { response: { status, data, headers } }),
  };
}

// ------------------------------------------------------------------ 404

test('a 404 carries the reason the server gave', () => {
  // The everyday 404 here is a tool call naming something that does not exist,
  // and the answer usually contains the remedy verbatim. The client replaced it
  // with "API version mismatch or incorrect URL", sending the user to check
  // three settings that were all correct.
  const error = describeApiError(
    axiosError({
      status: 404,
      data: { message: 'Project not found. Available projects: "Checkout Flow", "WEB-CRM"' },
    }),
    'tool call: list_test_cases',
    API_URL
  );

  assert.match(error.message, /Available projects/);
  assert.match(error.message, /Checkout Flow/);
  assert.doesNotMatch(error.message, /version mismatch/,
    'a guess must not replace the answer the server sent');
});

test('a 404 with no body still explains itself', () => {
  // The other direction: an actual missing endpoint has no message to relay, and
  // that is the case the old text was written for. It keeps it.
  const error = describeApiError(axiosError({ status: 404 }), 'fetch prompts', API_URL);

  assert.match(error.message, /version mismatch|not found/i);
  assert.match(error.message, /fetch prompts/);
});

test('an error body under `error` rather than `message` is used too', () => {
  const error = describeApiError(
    axiosError({ status: 404, data: { error: 'No such collection' } }),
    'tool call: get_test_collection',
    API_URL
  );

  assert.match(error.message, /No such collection/);
});

test('an empty message is not mistaken for one', () => {
  const error = describeApiError(
    axiosError({ status: 404, data: { message: '   ' } }),
    'fetch tools',
    API_URL
  );

  assert.match(error.message, /version mismatch|not found/i);
});

// ------------------------------------------------------------------ 429

test('a rate limit says how long to wait', () => {
  // The server sends Retry-After, X-RateLimit-Reset and the seconds in the body,
  // and the client kept none of them. The id-resolution loop our own
  // instructions mandate makes 60/min easy to reach, and the result was a bulk
  // edit stopped half-applied with no idea when to resume.
  const error = describeApiError(
    axiosError({ status: 429, headers: { 'retry-after': '30' } }),
    'tool call: update_test_case',
    API_URL
  );

  assert.match(error.message, /30s/);
});

test('the reset header is used when Retry-After is absent', () => {
  const error = describeApiError(
    axiosError({ status: 429, headers: { 'X-RateLimit-Reset': '45' } }),
    'tool call: update_test_case',
    API_URL
  );

  assert.match(error.message, /45s/);
});

test('a reset given as an epoch second is turned into a delay', () => {
  const inTwentySeconds = Math.floor(Date.now() / 1000) + 20;
  const seconds = retryAfterSeconds(
    axiosError({ status: 429, headers: { 'x-ratelimit-reset': String(inTwentySeconds) } })
  );

  assert.ok(seconds >= 18 && seconds <= 22, `expected about 20 seconds, got ${seconds}`);
});

test('a Retry-After given as an HTTP date is turned into a delay', () => {
  const at = new Date(Date.now() + 15000).toUTCString();
  const seconds = retryAfterSeconds(axiosError({ status: 429, headers: { 'Retry-After': at } }));

  assert.ok(seconds >= 13 && seconds <= 17, `expected about 15 seconds, got ${seconds}`);
});

test('the body carries the delay when no header does', () => {
  const error = describeApiError(
    axiosError({ status: 429, data: { message: 'Too many requests', retryAfter: 12 } }),
    'tool call: search_tests',
    API_URL
  );

  assert.match(error.message, /12s/);
});

test('a rate limit with nothing to go on does not invent a number', () => {
  const error = describeApiError(axiosError({ status: 429 }), 'tool call: search_tests', API_URL);

  assert.match(error.message, /Rate limit exceeded/);
  assert.doesNotMatch(error.message, /\d+s/);
});

test('a nonsense Retry-After is ignored rather than propagated', () => {
  assert.equal(retryAfterSeconds(axiosError({ status: 429, headers: { 'retry-after': 'soon' } })), undefined);
});

// ------------------------------------------------- the messages that were right

test('401 still points at the key', () => {
  const error = describeApiError(axiosError({ status: 401 }), 'fetch tools', API_URL);
  assert.match(error.message, /MCP key/);
});

test('a refused connection still names the URL', () => {
  const error = describeApiError(axiosError({ code: 'ECONNREFUSED' }), 'health check', API_URL);
  assert.match(error.message, /api\.m00nreport\.com/);
});

test('a timeout still names the setting that raises it', () => {
  const error = describeApiError(axiosError({ code: 'ETIMEDOUT' }), 'fetch tools', API_URL);
  assert.match(error.message, /M00N_TIMEOUT_MS/);
});

test('a plain Error passes through unchanged', () => {
  const original = new Error('something local went wrong');
  assert.equal(describeApiError(original, 'fetch tools', API_URL), original);
});

test('a thrown non-error still produces a message', () => {
  const error = describeApiError('just a string', 'fetch tools', API_URL);
  assert.match(error.message, /just a string/);
});

test('a 500 relays the server message', () => {
  const error = describeApiError(
    axiosError({ status: 500, data: { message: 'database connection lost' } }),
    'tool call: list_projects',
    API_URL
  );

  assert.match(error.message, /database connection lost/);
});
