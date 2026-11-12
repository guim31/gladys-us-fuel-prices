// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTION_KEY, NEW_PRICES, TRIGGER_KEYS } from '../src/app.js';
import { DEFAULT_CONFIG, LANGUAGES } from '../src/config.js';
import { WIDGET_KEY } from '../src/widgets.js';
import { DEFAULT_ZONE, FUEL_KEYS, ZONES, ZONE_IDS } from '../src/zones.js';
import { createWorld, nextWeekRows } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const field = (key) => manifest.config_schema.find((f) => f.key === key);

test('identity: name, image, cover, cloud transport, categories, US', () => {
  assert.equal(manifest.name, 'US Fuel Prices (EIA)');
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-us-fuel-prices:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-us-fuel-prices/main/cover.png',
  );
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['transport', 'energy']);
  assert.deepEqual(manifest.countries, ['US']);
  // `countries` needs Gladys 5.3.0 (and covers the 5.1.0 of the trigger and widget).
  assert.equal(manifest.gladys_version, '>=5.3.0');
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('a trigger, a widget, an action, no scene action', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers), TRIGGER_KEYS);
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(keysOf(manifest.actions), [ACTION_KEY]);
  // An action applies no `default` and cannot fill a secret (Gladys#3154, #3155).
  assert.equal(manifest.actions[0].fields, undefined);
  assert.equal(manifest.scene_actions, undefined);
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  const valued = manifest.config_schema.filter((f) => f.type !== 'section');
  assert.deepEqual(keysOf(valued).sort(), Object.keys(DEFAULT_CONFIG).sort());
  for (const f of valued) {
    if (f.default !== undefined) {
      assert.deepEqual(DEFAULT_CONFIG[f.key], f.default, f.key);
    }
  }
  assert.deepEqual(
    field('language').options.map((o) => o.value),
    LANGUAGES,
  );
  assert.equal(field('api_key').type, 'secret');
  assert.equal(field('api_key').required, false);
  assert.deepEqual(
    field('fuels').options.map((o) => o.value),
    FUEL_KEYS,
  );
});

test('every area option of the manifest is an area of the code, with its name', () => {
  const lists = [
    field('zones').options,
    manifest.scene_triggers[0].fields.find((f) => f.key === 'zone').options,
    manifest.widgets[0].settings.find((s) => s.key === 'zone').options,
  ];
  for (const options of lists) {
    assert.deepEqual(
      options.map((o) => o.value),
      ZONE_IDS,
    );
    for (const option of options) {
      assert.deepEqual(option.label, ZONES[option.value].name);
    }
  }
  assert.equal(manifest.widgets[0].settings.find((s) => s.key === 'zone').default, DEFAULT_ZONE);
});

test('the widget settings hide each optional block', () => {
  const settings = manifest.widgets[0].settings;
  assert.deepEqual(keysOf(settings), ['zone', 'show_changes']);
  assert.equal(settings.find((s) => s.key === 'show_changes').default, true);
});

test('the configuration says averages, the free key, and not affiliated with the EIA', () => {
  const intro = field('intro');
  assert.match(intro.description.en, /not station prices/);
  assert.match(intro.description.en, /Not affiliated with the EIA/);
  assert.match(intro.description.fr, /Sans lien avec l’EIA/);
  assert.ok(intro.links.some((l) => l.url === 'https://www.eia.gov/opendata/register.php'));
  for (const link of intro.links) {
    assert.match(link.url, /^https:\/\//);
  }
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('the trigger sends exactly its declared variables, with their types', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.eia.rows.push(...nextWeekRows());
  world.clock.time = Date.UTC(2026, 10, 16, 22, 0, 0);
  await world.app.tick({ force: true });
  const events = world.fake.sceneEvents.filter((e) => e.key === NEW_PRICES);
  assert.ok(events.length > 0);
  const [trigger] = manifest.scene_triggers;
  for (const { data } of events) {
    assert.deepEqual(Object.keys(data).sort(), keysOf(trigger.variables).sort());
    for (const variable of trigger.variables) {
      assert.equal(typeof data[variable.key], variable.type, variable.key);
    }
    // The filters compare with the event value of the same key.
    for (const filter of trigger.fields) {
      assert.ok(filter.options.some((o) => o.value === data[filter.key]));
    }
  }
});
