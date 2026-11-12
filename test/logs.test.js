// -----------------------------------------------------------------------------
// Quiet logs: a normal cycle writes nothing at the info level, and a failure
// that lasts writes one line when it starts and one when it ends.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUR, createAll, createWorld, json } from './helpers/world.js';

/** Capture what the loggers write, at a given LOG_LEVEL. */
function captureLogs(t, level) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  for (const stream of ['log', 'error']) {
    t.mock.method(console, stream, (...args) => lines.push(args.map(String).join(' ')));
  }
  return lines;
}

test('a normal cycle writes nothing at the info level', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 8; i += 1) {
    world.clock.advance(6 * HOUR);
    await world.app.tick();
    await world.fake.widgetGet('fuel_prices', { settings: {}, language: 'fr', units: 'us' });
  }
  assert.ok(world.eia.count() >= 8);
  assert.deepEqual(lines, []);
});

test('a lasting failure: one line when it starts, one when it ends, never the key', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const lines = captureLogs(t, 'info');
  world.eia.fail = () => json(503, { error: 'down' });
  world.clock.advance(5 * HOUR);
  for (let i = 0; i < 5; i += 1) {
    world.clock.advance(HOUR);
    await world.app.tick();
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[WARN\].*EIA cannot be read: EIA answered HTTP 503/);
  world.eia.fail = null;
  world.clock.advance(HOUR);
  await world.app.tick();
  assert.equal(lines.length, 2);
  assert.match(lines[1], /\[INFO\].*EIA answers again/);
  assert.ok(lines.every((line) => !line.includes('test-key')));
});
