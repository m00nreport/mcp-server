#!/usr/bin/env node
// Regenerates preview-snapshot.json from a live M00N Report instance.
//
// The server normally learns what it offers by asking your instance at startup,
// which means it can say nothing at all until it has a key. The snapshot is what
// it answers with in the meantime, so that a client, an inspector or a directory
// can see the tool surface before anyone has configured anything.
//
// Run it with an UNSCOPED key. A scoped key sees fewer tools, and the snapshot
// is meant to describe what the server offers, not what one key may reach.
//
//   M00N_API_URL=https://m00nreport.com M00N_API_KEY=m00n_mcp_... \
//     node scripts/refresh-snapshot.mjs
//
// The file carries no timestamp on purpose: regenerating it when nothing has
// changed then produces no diff at all, which is the signal worth having.
//
// Server instructions are deliberately not captured: preview mode substitutes its
// own hint, so carrying them would ship 9 KB nobody reads.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../preview-snapshot.json', import.meta.url));

const apiUrl = (process.env.M00N_API_URL ?? '').replace(/\/+$/, '');
const apiKey = process.env.M00N_API_KEY ?? '';

if (!apiUrl || !apiKey) {
  console.error('M00N_API_URL and M00N_API_KEY are both required.');
  process.exit(1);
}

async function get(path) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { 'X-MCP-Key': apiKey },
    redirect: 'error',
  });
  if (!response.ok) {
    throw new Error(`GET ${path} -> ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/** Optional listings must not fail the run: an instance may not serve them all. */
async function optional(path, pick, fallback) {
  try {
    return pick(await get(path)) ?? fallback;
  } catch (error) {
    console.error(`  ${path}: ${error.message}, using ${JSON.stringify(fallback)}`);
    return fallback;
  }
}

const byName = (a, b) => a.name.localeCompare(b.name);

console.error(`Reading ${apiUrl} ...`);

const tools = (await get('/api/mcp/tools')).tools ?? [];
if (tools.length === 0) {
  console.error('The instance returned no tools. Refusing to write an empty snapshot.');
  process.exit(1);
}

const prompts = await optional('/api/mcp/prompts', (r) => r.prompts, []);
const resources = await optional('/api/mcp/resources', (r) => r.resources, []);
const resourceTemplates = await optional(
  '/api/mcp/resources/templates',
  (r) => r.resourceTemplates,
  [],
);
const snapshot = {
  tools: [...tools].sort(byName),
  prompts: [...prompts].sort(byName),
  resources: [...resources].sort((a, b) => String(a.uri).localeCompare(String(b.uri))),
  resourceTemplates: [...resourceTemplates].sort((a, b) =>
    String(a.uriTemplate).localeCompare(String(b.uriTemplate)),
  ),
};

writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

console.error(
  `Wrote ${tools.length} tools, ${prompts.length} prompts, ` +
    `${resources.length} resources, ${resourceTemplates.length} resource templates.`,
);
