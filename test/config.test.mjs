import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIntEnv } from '../dist/config.js';

/**
 * How a number arrives from the environment.
 *
 * Every one of these values reaches this function as a string, because that is
 * all an environment variable can be. The parsing therefore has to be strict:
 * the alternative is not a rejected value but a silently wrong one, and a
 * silently wrong timeout is indistinguishable from a broken server.
 *
 * This was parseInt, which stops at the first character it does not understand
 * and reports no problem. M00N_TIMEOUT_MS=60s became a sixty MILLISECOND timeout,
 * every call failed, and the error message advised the user to raise the timeout -
 * so the one piece of guidance they had led them further from the cause. A unit
 * suffix is the natural thing to write for a setting whose name ends in MS.
 */

const DEFAULT = 30000;

test('a plain number is used', () => {
  assert.equal(parseIntEnv('5000', DEFAULT), 5000);
});

test('surrounding whitespace is tolerated', () => {
  // A YAML block scalar or a shell heredoc leaves it, and rejecting the value
  // over a space would be its own small betrayal.
  assert.equal(parseIntEnv('  5000  ', DEFAULT), 5000);
});

const REJECTED = [
  ['a unit suffix', '60s'],
  ['a unit suffix with a space', '60 s'],
  ['milliseconds spelled out', '60ms'],
  ['a decimal', '1.5'],
  ['scientific notation', '1e4'],
  ['a thousands separator', '30,000'],
  ['an underscore separator', '30_000'],
  ['hexadecimal', '0x1f'],
  ['a leading plus with a suffix', '+60s'],
  ['words', 'thirty seconds'],
  ['zero', '0'],
  ['a negative number', '-1'],
  ['an empty string', ''],
  ['whitespace only', '   '],
];

for (const [label, value] of REJECTED) {
  test(`${label} falls back to the default rather than to a wrong number`, () => {
    // The important half is "rather than to a wrong number". parseInt turned
    // most of these into a plausible-looking value that was not what the user
    // meant, and nothing anywhere said so.
    assert.equal(parseIntEnv(value, DEFAULT), DEFAULT, `${JSON.stringify(value)} should not parse`);
  });
}

test('an absent value uses the default', () => {
  assert.equal(parseIntEnv(undefined, DEFAULT), DEFAULT);
});

test('a rejected value is announced, not swallowed', () => {
  // A setting that silently does nothing is how someone spends an afternoon on
  // the wrong problem. MCP uses stdout for the protocol, so this has to be
  // stderr.
  const messages = [];
  const realError = console.error;
  console.error = (...args) => messages.push(args.join(' '));
  try {
    parseIntEnv('60s', DEFAULT);
  } finally {
    console.error = realError;
  }

  assert.ok(messages.length > 0, 'the user must be told the value was ignored');
  assert.ok(messages.join(' ').includes('60s'), 'and told which value');
});
