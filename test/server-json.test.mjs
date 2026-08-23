import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * server.json is what the MCP Registry lists, and every fact in it is a copy of
 * something that already lives in package.json or in the source. A copy drifts,
 * and the registry is the worst place to find that out: the publish either fails
 * with an ownership error or, worse, succeeds and advertises a version, an env
 * var or a package name that is no longer true.
 *
 * These tests pin the copies to their originals.
 */

const root = new URL('../', import.meta.url);
const server = JSON.parse(readFileSync(new URL('server.json', root), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

/** Every environment variable the listing declares, across all package entries. */
const declaredEnv = server.packages.flatMap((p) => p.environmentVariables ?? []);

test('server.json carries the three fields the schema requires', () => {
  for (const field of ['name', 'description', 'version']) {
    assert.ok(server[field], `server.json is missing ${field}`);
  }
});

test('the server name matches the registry name pattern', () => {
  // ^[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+$ in the published schema. A name outside it
  // is rejected on publish, not on save.
  assert.match(server.name, /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
  assert.ok(server.name.length <= 200);
});

test('the namespace matches the GitHub org that owns the repository', () => {
  // Ownership of io.github.<org>/* is proven by publishing from that org. A
  // namespace naming an org we do not own cannot be published at all.
  const org = new URL(server.repository.url).pathname.split('/').filter(Boolean)[0];
  assert.equal(server.name.split('/')[0], `io.github.${org}`);
});

test('package.json mcpName matches the server name', () => {
  // This is the ownership check the registry actually runs against npm: it reads
  // mcpName out of the published package and compares it to the server name.
  // They disagree, the publish is refused as impersonation.
  assert.equal(pkg.mcpName, server.name);
});

test('the description fits the 100 character limit', () => {
  // The npm description is far longer than this and is the obvious thing to
  // paste in. The schema caps it at 100.
  assert.ok(server.description.length > 0);
  assert.ok(
    server.description.length <= 100,
    `description is ${server.description.length} characters, limit is 100`,
  );
});

test('the title is present and fits the 100 character limit', () => {
  // The schema allows it to be absent, but a listing without one shows the raw
  // reverse-DNS name in client UIs. We ship a title, so guard it as present
  // rather than skipping when it disappears.
  assert.ok(server.title.length > 0 && server.title.length <= 100);
});

test('every version in server.json matches package.json', () => {
  // Two copies of the version, and the registry validates the package version
  // against npm. A stale copy points the listing at a release that may not carry
  // mcpName yet.
  assert.equal(server.version, pkg.version);
  for (const entry of server.packages) {
    assert.equal(entry.version, pkg.version);
  }
});

test('the npm package entry points at this package', () => {
  const npmEntry = server.packages.find((p) => p.registryType === 'npm');
  assert.ok(npmEntry, 'server.json declares no npm package');
  assert.equal(npmEntry.identifier, pkg.name);
  assert.equal(npmEntry.transport.type, 'stdio');
  // The registry supports the public npm registry and nothing else.
  assert.equal(npmEntry.registryBaseUrl, 'https://registry.npmjs.org');
});

test('the repository url matches package.json', () => {
  const fromPkg = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
  assert.equal(server.repository.url, fromPkg);
  assert.equal(server.repository.source, 'github');
});

/** Every environment variable the shipped code actually reads. */
function envVarsInSource() {
  const found = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = new URL(entry, dir);
      if (statSync(path).isDirectory()) {
        walk(new URL(`${entry}/`, dir));
        continue;
      }
      if (!/\.(ts|js|mjs)$/.test(entry)) continue;
      const text = readFileSync(path, 'utf8');
      for (const m of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) found.add(m[1]);
    }
  };
  walk(new URL('src/', root));
  walk(new URL('bin/', root));
  return found;
}

test('server.json declares exactly the environment variables the code reads', () => {
  // Both directions matter. A variable the code reads and the listing omits is a
  // user who cannot configure the server from the registry entry; a variable the
  // listing invents is a user setting something that does nothing.
  const declared = new Set(declaredEnv.map((v) => v.name));
  const actual = envVarsInSource();

  const missing = [...actual].filter((v) => !declared.has(v)).sort();
  const phantom = [...declared].filter((v) => !actual.has(v)).sort();

  assert.deepEqual(missing, [], `read by the code but not declared: ${missing.join(', ')}`);
  assert.deepEqual(phantom, [], `declared but never read: ${phantom.join(', ')}`);
});

test('the two variables a client must supply are the required ones', () => {
  // Named for the registry's reader, not for startup: since 1.5.0 the server does
  // start without them, in preview mode. isRequired stays true because a client
  // configuring this server for real does have to supply both.
  const required = declaredEnv.filter((v) => v.isRequired).map((v) => v.name).sort();
  assert.deepEqual(required, ['M00N_API_KEY', 'M00N_API_URL']);
});

test('the API key is marked secret', () => {
  // Clients use this flag to decide whether to mask the value. Unmarked, a key
  // gets echoed into a config file or a screenshot.
  const key = declaredEnv.find((v) => v.name === 'M00N_API_KEY');
  assert.equal(key.isSecret, true);
});
