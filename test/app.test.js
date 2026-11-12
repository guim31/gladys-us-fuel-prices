// -----------------------------------------------------------------------------
// The integration against the SDK's fake Gladys and a fake EIA: devices,
// states, the refresh schedule, the trigger, the widget, the action, the
// status of the configuration screen.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { ACTION_KEY, HEARTBEAT_MS, NEW_PRICES, REFRESH_MS, TICK_MS } from '../src/app.js';
import { TEXT } from '../src/i18n.js';
import { WIDGET_KEY } from '../src/widgets.js';
import {
  DAY,
  HOUR,
  INVALID_KEY,
  RATE_LIMIT,
  START,
  createAll,
  createClock,
  createWorld,
  json,
  nextWeekRows,
  zoneId,
} from './helpers/world.js';

const widget = (world, settings = {}, language = 'en') =>
  world.fake.widgetGet(WIDGET_KEY, { settings, language, units: 'us' });

test('one device per area followed, diesel only where EIA publishes it', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const [nus, sco] = world.fake.discoveredDevices;
  assert.equal(nus.name, 'Prix des carburants – Moyenne des États-Unis');
  assert.equal(nus.external_id, zoneId(world.gladys, 'NUS').device);
  assert.equal(nus.should_poll, false);
  assert.equal(nus.features.length, 13);
  assert.equal(sco.name, 'Prix des carburants – Colorado');
  assert.equal(sco.features.length, 10);
  assert.ok(!sco.features.some((f) => f.external_id.includes('diesel')));
  const price = nus.features.find((f) => f.external_id.endsWith(':regular_price'));
  assert.equal(price.name, 'Ordinaire ($/gal)');
  assert.equal(price.unit, 'dollar');
});

test('states once the devices are added, then only changes', async (t) => {
  // The SDK dates the heartbeat with Date.now: one clock for both.
  t.mock.timers.enable({ apis: ['Date'], now: START });
  const clock = {
    now: () => Date.now(),
    advance: (ms) => t.mock.timers.tick(ms),
  };
  const world = await createWorld({ clock });
  t.after(() => world.app.stop());
  // Nothing published before the devices exist.
  assert.equal(world.fake.states.length, 0);
  await createAll(world);
  const ids = zoneId(world.gladys, 'NUS');
  assert.equal(world.fake.lastState(ids.feature('regular_price')), 3.995);
  assert.equal(world.fake.lastState(ids.feature('regular_week_change')), -0.158);
  assert.equal(world.fake.lastState(ids.feature('regular_year_change')), 0.939);
  assert.equal(world.fake.lastState(ids.feature('diesel_price')), 6.127);
  assert.equal(world.fake.lastState(ids.feature('survey_date')), '9 nov. 2026');
  const sco = zoneId(world.gladys, 'SCO');
  assert.equal(world.fake.lastState(sco.feature('premium_price')), 4.465);

  const count = world.fake.states.length;
  world.clock.advance(TICK_MS);
  await world.app.tick();
  assert.equal(world.fake.states.length, count, 'nothing changed, nothing sent');
  // The heartbeat sends the values again.
  world.clock.advance(HEARTBEAT_MS);
  await world.app.tick();
  assert.ok(world.fake.states.length > count);
});

test('a few reads a day, hourly from Monday 21:00 UTC until the new survey', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.equal(world.eia.count(), 2);
  // Tuesday 15:00: next read in six hours.
  assert.equal(world.app.nextReadAt(), START + REFRESH_MS);
  for (let i = 0; i < 4 * 6 - 1; i += 1) {
    world.clock.advance(TICK_MS);
    await world.app.tick();
  }
  assert.equal(world.eia.count(), 2);
  world.clock.advance(TICK_MS);
  await world.app.tick();
  // The same survey: the year-ago rows are not read again.
  assert.equal(world.eia.count(), 3);

  // Monday 2026-11-16, 21:00 UTC: hourly.
  world.clock.time = Date.UTC(2026, 10, 16, 21, 0, 0);
  await world.app.tick();
  const reads = world.eia.count();
  world.clock.advance(HOUR);
  await world.app.tick();
  assert.equal(world.eia.count(), reads + 1);
  // The new survey is out: back to six hours.
  world.eia.rows.push(...nextWeekRows());
  world.clock.advance(HOUR);
  await world.app.tick();
  assert.equal(world.app.survey.period, '2026-11-16');
  assert.equal(world.app.nextReadAt(), world.clock.now() + REFRESH_MS);
});

test('the container refreshes on its own timer, without the core polling', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: START });
  const clock = { now: () => Date.now() };
  const world = await createWorld({ clock, timers: true });
  t.after(() => world.app.stop());
  await createAll(world);
  world.eia.rows.push(...nextWeekRows(-0.1, '2026-11-16'));
  const ids = zoneId(world.gladys, 'NUS');
  for (let i = 0; i < (REFRESH_MS / TICK_MS) * 2; i += 1) {
    t.mock.timers.tick(TICK_MS);
    await new Promise((resolve) => setImmediate(resolve));
    await world.app.tick();
  }
  assert.equal(world.fake.lastState(ids.feature('regular_price')), 3.895);
  assert.equal(world.fake.lastState(ids.feature('regular_week_change')), -0.1);
});

test('a new survey fires the trigger once per area, never on the first read nor after a restart', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.deepEqual(world.fake.sceneEvents, []);
  assert.deepEqual(world.app.announced, { NUS: '2026-11-09', SCO: '2026-11-09' });

  world.eia.rows.push(...nextWeekRows(-0.05));
  world.clock.time = Date.UTC(2026, 10, 16, 22, 0, 0);
  await world.app.tick({ force: true });
  const events = world.fake.sceneEvents.filter((e) => e.key === NEW_PRICES);
  assert.equal(events.length, 2);
  // Intl puts no-break spaces around the currency: compared as plain spaces.
  const data = {
    ...events[0].data,
    summary: events[0].data.summary.replace(/[\u00a0\u202f]/g, ' '),
  };
  assert.deepEqual(data, {
    zone: 'NUS',
    zone_name: 'Moyenne des États-Unis',
    survey_date: '2026-11-16',
    summary:
      'Ordinaire 3,945 $ (−5 ¢), Intermédiaire 4,558 $ (−5 ¢), Super 4,963 $ (−5 ¢), Gazole 6,077 $ (−5 ¢)',
  });
  assert.equal(events[1].data.zone, 'SCO');

  // Read again: nothing new.
  await world.app.tick({ force: true });
  assert.equal(world.fake.sceneEvents.length, 2);
  await world.app.stop();

  // A restart on the same /data: nothing fired again.
  const again = await createWorld({
    clock: createClock(world.clock.now()),
    eia: world.eia,
    dataDir: world.dataDir,
  });
  t.after(() => again.app.stop());
  assert.deepEqual(again.fake.sceneEvents, []);
});

test('a failure is retried an hour later; the status says it in four languages', async (t) => {
  const world = await createWorld({ connect: false });
  t.after(() => world.app.stop());
  world.eia.fail = () => json(503, { error: 'down' });
  await world.gladys.connect();
  assert.deepEqual(world.fake.connectionStatus, { connected: false, message: TEXT.unreachable });
  assert.equal(world.app.nextReadAt(), START + HOUR);
  world.eia.fail = null;
  world.clock.advance(HOUR);
  await world.app.tick();
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
});

test('a refused key and the demo key limit are named, and EIA is asked less often', async (t) => {
  const world = await createWorld({ connect: false });
  t.after(() => world.app.stop());
  world.eia.fail = () => json(403, INVALID_KEY);
  await world.gladys.connect();
  assert.deepEqual(world.fake.connectionStatus.message, TEXT.badKey);
  assert.equal(world.app.nextReadAt(), START + REFRESH_MS);
  const content = await widget(world);
  assert.equal(content.data.content.components[0].text, TEXT.badKey.en);

  // The demo key (empty field), over its limit: wait what EIA says, a day at most.
  world.eia.fail = () => json(429, RATE_LIMIT, { 'retry-after': '38061' });
  await world.fake.configUpdated({ language: 'en', zones: ['NUS'] });
  assert.deepEqual(world.fake.connectionStatus.message, TEXT.demoLimit);
  assert.equal(world.app.nextReadAt(), world.clock.now() + 38061 * 1000);
  assert.equal(new URL(world.eia.calls.at(-1).url).searchParams.get('api_key'), 'DEMO_KEY');
  // Your own key, limited: another message.
  await world.fake.configUpdated({ language: 'en', zones: ['NUS'], api_key: 'mine' });
  assert.deepEqual(world.fake.connectionStatus.message, TEXT.rateLimit);
});

test('the widget: tiles per fuel, changes, survey date, within the core budget', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await widget(world, { zone: 'NUS' }, 'fr');
  assert.equal(ack.success, true, ack.error);
  const { components } = ack.data.content;
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
  const tiles = components.filter((c) => c.type === 'value');
  assert.deepEqual(
    tiles.map((c) => [c.label, c.value, c.color]),
    [
      ['Ordinaire', 3.995, 'success'],
      ['Intermédiaire', 4.608, 'success'],
      ['Super', 5.013, 'success'],
      ['Gazole', 6.127, 'success'],
    ],
  );
  const status = components.find((c) => c.type === 'status');
  assert.equal(status.items[0].value, '−15,8 ¢ / 1 semaine · +93,9 ¢ / 1 an');
  for (const item of status.items) {
    assert.ok(item.value.length <= 40, item.value);
  }
  assert.equal(components.at(-1).text, 'Moyenne des États-Unis · Enquête de l’EIA du 9 nov. 2026');

  // Hidden changes.
  const hidden = await widget(world, { zone: 'NUS', show_changes: false });
  assert.ok(!hidden.data.content.components.some((c) => c.type === 'status'));
});

test('the widget reads an area nobody follows, once', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const before = world.eia.count();
  const ack = await widget(world, { zone: 'YBOS' });
  assert.equal(ack.data.content.components.filter((c) => c.type === 'value').length, 3);
  assert.equal(world.eia.count(), before + 2);
  await widget(world, { zone: 'YBOS' });
  assert.equal(world.eia.count(), before + 2);
  // Boston stays in the reads for a week, without a device.
  assert.equal(world.fake.discoveredDevices.length, 2);
  world.clock.advance(8 * DAY);
  world.eia.calls.length = 0;
  await world.app.tick({ force: true });
  assert.ok(!world.eia.calls[0].url.includes('YBOS'));
});

test('the action tests the connection and answers in the configured language', async (t) => {
  const world = await createWorld({ config: { language: 'en', zones: ['SCA'] } });
  t.after(() => world.app.stop());
  const ack = await world.fake.action(ACTION_KEY, {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(
    ack.data.message,
    'EIA answers. California, survey of Nov 9, 2026: Regular $5.562/gal. Demo key: enter your free key.',
  );
  world.eia.fail = () => json(403, INVALID_KEY);
  const refused = await world.fake.action(ACTION_KEY, {});
  assert.equal(refused.success, false);
  assert.equal(refused.error, TEXT.badKey.en);
});

test('a survey older than two weeks is not published', async (t) => {
  const world = await createWorld({ clock: createClock(START + 20 * DAY) });
  t.after(() => world.app.stop());
  await createAll(world);
  assert.equal(world.fake.states.length, 0);
  const ack = await widget(world);
  assert.equal(ack.data.content.components[0].variant, 'body');
});

test('a device added later gets its states at once, and the widget is refreshed', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const refreshes = world.fake.widgetRefreshes.length;
  await world.fake.deviceCreated(world.fake.discoveredDevices[1]);
  const sco = zoneId(world.gladys, 'SCO');
  assert.equal(world.fake.lastState(sco.feature('regular_price')), 3.746);
  assert.ok(world.fake.widgetRefreshes.length > refreshes);
});

test('the trigger is sent after the new states, so a scene reads the new prices', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world);
  const order = [];
  const publish = world.gladys.publishChangedStates.bind(world.gladys);
  t.mock.method(world.gladys, 'publishChangedStates', async (...args) => {
    order.push('states');
    return publish(...args);
  });
  const send = world.gladys.publishSceneEvent.bind(world.gladys);
  t.mock.method(world.gladys, 'publishSceneEvent', async (...args) => {
    order.push('event');
    return send(...args);
  });
  world.eia.rows.push(...nextWeekRows());
  world.clock.time = Date.UTC(2026, 10, 16, 22, 0, 0);
  await world.app.tick({ force: true });
  assert.deepEqual(order, ['states', 'event', 'event']);
});

test('an area first seen without a fresh survey announces the next one', async (t) => {
  const world = await createWorld({ clock: createClock(START + 20 * DAY) });
  t.after(() => world.app.stop());
  assert.deepEqual(world.app.announced, { NUS: '2026-11-09', SCO: '2026-11-09' });
  world.eia.rows.push(...nextWeekRows(-0.05, '2026-11-30'));
  await world.app.tick({ force: true });
  assert.equal(world.fake.sceneEvents.length, 2);
});

test('your own key, rate limited: the widget says so', async (t) => {
  const world = await createWorld({ connect: false });
  t.after(() => world.app.stop());
  world.eia.fail = () => json(429, RATE_LIMIT, { 'retry-after': '60' });
  await world.gladys.connect();
  const ack = await widget(world);
  assert.equal(ack.data.content.components[0].text, TEXT.rateLimit.en);
});
