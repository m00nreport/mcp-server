#!/usr/bin/env node
// Runs the test suite, and fails when there is no suite to run.
//
// `node --test` with no arguments discovers files itself and exits 0 when it
// finds none, so a rename or a bad checkout turns the only gate green while
// running nothing. Passing a directory is not the fix: Node treats
// `node --test test/` as a module path and fails, and its own glob support
// needs Node 21, while this package supports 20. A shell glob does not survive
// Windows either, where npm runs scripts through cmd and never expands it.
//
// So enumerate the files here, refuse an empty list, and hand Node an explicit
// set.

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testDir = new URL('../test/', import.meta.url);

/** Every *.test.mjs under test/, including subdirectories. */
function collect(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(...collect(new URL(`${entry.name}/`, dir)));
    } else if (entry.name.endsWith('.test.mjs')) {
      found.push(fileURLToPath(new URL(entry.name, dir)));
    }
  }
  return found;
}

let files;
try {
  // Recursive on purpose: enumerating only the top level would reintroduce the
  // silent skip this script exists to prevent, one directory down.
  files = collect(testDir).sort();
} catch (error) {
  console.error(`Cannot read ${fileURLToPath(testDir)}: ${error.message}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`No *.test.mjs files in ${fileURLToPath(testDir)}. Refusing to report success.`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });

// Without this, a failure to spawn exits 1 with nothing said, which looks
// identical to a failing test.
if (result.error) {
  console.error(`Could not run the tests: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
