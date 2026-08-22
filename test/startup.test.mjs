import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const SERVER = readFileSync(join(here, '..', 'src', 'server.ts'), 'utf8');
const API_CLIENT = readFileSync(join(here, '..', 'src', 'api-client.ts'), 'utf8');

/**
 * Startup must survive an optional listing coming back in an unexpected shape.
 *
 * A proxy, a stale API version or an auth page answering 200 with HTML all send a
 * 2xx body without the field a listing expects. None of them may stop the server
 * starting, because every tool goes down with it.
 *
 * Asserted against the source rather than by starting a server: reproducing the
 * shape needs a live API answering with a wrong body, which is the situation
 * itself rather than something a unit test should stand up. What these checks pin
 * is the structure that keeps it harmless.
 */

test('every optional listing is normalised to an array before it is measured', () => {
  // The guard has to be OUTSIDE the try that fetches, because that is where the
  // read happens. Inside it would be caught and the next line would still throw.
  for (const name of ['staticResources', 'resourceTemplates', 'prompts']) {
    const guard = new RegExp(`${name}\\s*=\\s*Array\\.isArray\\(${name}\\)`);
    assert.ok(guard.test(SERVER), `${name} is measured without being normalised first`);
  }
});

test('the normalisation happens before the first length read', () => {
  for (const name of ['staticResources', 'resourceTemplates']) {
    const guardAt = SERVER.indexOf(`${name} = Array.isArray(${name})`);
    const hasResourcesAt = SERVER.indexOf('const hasResources =');
    assert.ok(guardAt > -1 && guardAt < hasResourcesAt,
      `${name} must be normalised before hasResources reads it`);
  }
});

test('an optional fetch that fails does not decide whether the server starts', () => {
  // Each of the four goes through optional(), which is what makes it optional:
  // it swallows the failure, retries first, and explains itself. A future fetch
  // added without it would take all the tools down with it.
  const optionalFetches = ['fetchStaticResources', 'fetchResourceTemplates', 'fetchPrompts', 'fetchInstructions'];
  for (const call of optionalFetches) {
    const index = SERVER.indexOf(`apiClient.${call}(`);
    assert.ok(index > -1, `${call} should be called during startup`);
    const before = SERVER.slice(Math.max(0, index - 200), index);
    assert.ok(
      before.includes('optional('),
      `${call} must go through optional(), or a bad answer stops startup`
    );
  }
});

test('an optional fetch is retried before it is given up on', () => {
  // One attempt decides the whole session: capabilities are advertised at
  // startup, so a single 502 from a proxy hides prompts until the client
  // reconnects.
  const helper = SERVER.slice(SERVER.indexOf('const optional ='), SERVER.indexOf('// Step 2a'));
  assert.match(helper, /attempt <= [2-9]/, 'optional() must try more than once');
  assert.match(helper, /setTimeout/, 'and wait between attempts');
});

test('a fetch that is given up on says why', () => {
  // Whether the endpoint is missing, the key lacks a scope or a proxy answered
  // is what decides the next step, and the failure already carries it.
  const helper = SERVER.slice(SERVER.indexOf('const optional ='), SERVER.indexOf('// Step 2a'));
  assert.match(helper, /not available: \$\{reason\}/, 'the failure message must carry the reason');
});

test('a listing endpoint reads its field without assuming it exists', () => {
  // Stated as a rule: returning response.data.<field> straight out turns an
  // unexpected 2xx body into an undefined that travels. The client defends once,
  // so no caller has to remember to.
  const returns = API_CLIENT.match(/return response\.data\.\w+;/g) || [];
  const unguarded = returns.filter((line) => !line.includes('??') && !line.includes('||'));
  assert.ok(
    unguarded.length === 0,
    `these return a field without a fallback, so an unexpected 2xx body yields undefined:\n  ${unguarded.join('\n  ')}`
  );
});
