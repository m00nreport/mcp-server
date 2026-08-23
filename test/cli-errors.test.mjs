import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * The setup banner answers exactly one failure: the configuration is missing or
 * invalid. It used to be chosen by searching the error message for a variable
 * name, so any error that merely MENTIONED M00N_API_URL printed the whole box.
 * A redirect does mention it, and the advice that mattered ended up above 27
 * lines telling the user to set variables they had already set correctly.
 */

const BIN = fileURLToPath(new URL('../bin/m00n-mcp.js', import.meta.url));
const CWD = fileURLToPath(new URL('../', import.meta.url));

/** Run the CLI with exactly these M00N_* variables and collect stderr. */
function runCli(vars, { waitMs = 8000 } = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('M00N_')) delete env[key];
  Object.assign(env, vars);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN], { env, cwd: CWD });
    let stderr = '';
    let settled = false;
    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      resolve({ stderr, exitCode });
    };
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('exit', finish);
    const timer = setTimeout(() => finish(null), waitMs);
  });
}

const BANNER = 'CONFIGURATION REQUIRED';

test('a redirect is diagnosed without the setup banner', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(302, { Location: `https://elsewhere.example.com${req.url}` });
    res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));

  const { stderr, exitCode } = await runCli({
    M00N_API_URL: `http://127.0.0.1:${server.address().port}`,
    M00N_API_KEY: 'm00n_mcp_000000000000000000000000000000000000000000000000',
  });
  await new Promise((r) => server.close(r));

  assert.equal(exitCode, 1);
  assert.match(stderr, /redirected/);
  assert.ok(
    !stderr.includes(BANNER),
    'the setup banner was printed for an error that is not a configuration problem',
  );
});

test('the setup banner still appears when a variable is missing', async () => {
  const { stderr, exitCode } = await runCli({ M00N_API_URL: 'https://m00nreport.com' });
  assert.equal(exitCode, 1);
  assert.ok(stderr.includes(BANNER), 'a half-configured server printed no setup help');
});

test('the setup banner still appears when the key is the wrong kind', async () => {
  const { stderr, exitCode } = await runCli({
    M00N_API_URL: 'https://m00nreport.com',
    M00N_API_KEY: 'not_an_mcp_key',
  });
  assert.equal(exitCode, 1);
  assert.ok(stderr.includes(BANNER));
});

test('an unconfigured server starts in preview mode and shows no banner', async () => {
  const { stderr } = await runCli({}, { waitMs: 6000 });
  assert.match(stderr, /preview mode/);
  assert.ok(!stderr.includes(BANNER));
});
