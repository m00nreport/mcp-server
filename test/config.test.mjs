import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIntEnv } from '../dist/config.js';

/**
 * How a number arrives from the environment.
 *
 * Every one of these values reaches the function as a string, because that is all
 * an environment variable can be. Parsing is strict on purpose: a lenient parse
 * stops at the first character it does not understand and reports no problem, so
 * the outcome is not a rejected value but a silently wrong one, and a silently
 * wrong timeout is indistinguishable from a broken server.
 */

const DEFAULT = 30000;

test('a plain number is used', () => {
  assert.equal(parseIntEnv('5000', DEFAULT), 5000);
});

test('surrounding whitespace is tolerated', () => {
  // A YAML block scalar or a shell heredoc leaves it, and a stray space is not
  // a reason to fall back to the default.
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
    // The important half is "rather than to a wrong number": a lenient parse
    // turns most of these into a plausible value the user did not ask for.
    assert.equal(parseIntEnv(value, DEFAULT), DEFAULT, `${JSON.stringify(value)} should not parse`);
  });
}

test('an absent value uses the default', () => {
  assert.equal(parseIntEnv(undefined, DEFAULT), DEFAULT);
});

test('a rejected value is announced, not swallowed', () => {
  // An ignored setting has to say so, and on stderr: MCP owns stdout for the
  // protocol.
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
