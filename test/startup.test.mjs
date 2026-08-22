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
 * The failure was quiet and total. fetchStaticResources returns
 * response.data.staticResources without checking the field exists, so a 2xx with
 * a body that lacks it assigns undefined. The assignment succeeds; the .length
 * that throws does so INSIDE the try, where it is caught and logged as "not
 * available". The next line reads .length again, OUTSIDE the try - and that
 * TypeError propagated out of startup.
 *
 * The cost is out of all proportion to the cause: the server refuses to start
 * and all its tools disappear from the client, over an optional resource listing
 * that nobody was using. A proxy, a stale API version or an auth page returning
 * 200 with HTML is enough.
 *
 * Asserted against the source rather than by starting a server, because
 * reproducing it needs a running API answering with a wrong body - which is the
 * situation, not something a unit test should have to stand up. What the source
 * check pins is the specific shape that made it possible.
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
  // One attempt used to decide the whole SESSION: a single 502 from a proxy and
  // the client is told, for as long as it stays connected, that this server has
  // no prompts. Users concluded their instance did not support them.
  const helper = SERVER.slice(SERVER.indexOf('const optional ='), SERVER.indexOf('// Step 2a'));
  assert.match(helper, /attempt <= [2-9]/, 'optional() must try more than once');
  assert.match(helper, /setTimeout/, 'and wait between attempts');
});

test('a fetch that is given up on says why', () => {
  // "Prompts not available" named neither the cause nor the remedy. Whether the
  // endpoint is missing, the key lacks a scope, or a proxy answered is exactly
  // what the user needs to know, and the server had it in hand.
  const helper = SERVER.slice(SERVER.indexOf('const optional ='), SERVER.indexOf('// Step 2a'));
  assert.match(helper, /not available: \$\{reason\}/, 'the failure message must carry the reason');
});

test('a listing endpoint reads its field without assuming it exists', () => {
  // The root cause, stated as a rule rather than as a patch: returning
  // response.data.<field> straight out is what turns an unexpected 2xx body into
  // an undefined that travels. Either the client defends, or every caller must -
  // and the caller that forgot is the one that broke startup.
  const returns = API_CLIENT.match(/return response\.data\.\w+;/g) || [];
  const unguarded = returns.filter((line) => !line.includes('??') && !line.includes('||'));
  assert.ok(
    unguarded.length === 0,
    `these return a field without a fallback, so an unexpected 2xx body yields undefined:\n  ${unguarded.join('\n  ')}`
  );
});
