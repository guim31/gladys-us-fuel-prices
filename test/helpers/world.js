// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake EIA API behind one fake
// `fetch`, a temporary /data and a manual clock, with the integration wired on
// top through registerHandlers. No timer runs unless `timers: true` (with
// node:test mock timers): the tests call `app.tick()`. No test touches the
// network.
//
// The fixtures are API v2 answers (row format, string values) carrying the
// prices EIA published for the survey of Monday 2026-11-09: the shared
// DEMO_KEY was over its limit the day they were made, so the rows were
// rebuilt from EIA's public tables of that survey. The two error bodies are
// real EIA answers.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';
import { BASE_URL } from '../../src/eia.js';
import { zoneIds } from '../../src/devices.js';

// The integration logs its lifecycle; keep the test output readable.
process.env.LOG_LEVEL ??= 'silent';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

export const RECENT = fixture('eia-recent.json');
export const YEAR_AGO = fixture('eia-year-ago.json');
export const INVALID_KEY = fixture('eia-error-invalid-key.json');
export const RATE_LIMIT = fixture('eia-error-rate-limit.json');

/** Tuesday 2026-11-10, 15:00 UTC: the survey of Monday 2026-11-09 is out. */
export const START = Date.UTC(2026, 10, 10, 15, 0, 0);
export const SURVEY = '2026-11-09';
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

export const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/** The rows of the next survey: every price of 2026-11-09 moved by `delta`. */
export function nextWeekRows(delta = -0.05, period = '2026-11-16') {
  return RECENT.response.data
    .filter((row) => row.period === SURVEY)
    .map((row) => ({ ...row, period, value: (Number(row.value) + delta).toFixed(3) }));
}

/**
 * A fake EIA: answers from its `rows` (recent) and `yearAgoRows`, filtered
 * like the API (areas, products, start, end), paged by offset and length.
 * `fail` replaces the answer when set. Every call is recorded.
 */
export function createFakeEia() {
  const eia = {
    calls: [],
    rows: [...RECENT.response.data],
    yearAgoRows: [...YEAR_AGO.response.data],
    /** @type {null | (() => Response)} */
    fail: null,
    /** @type {typeof fetch} */
    fetch: async (url, init = {}) => {
      const request = { url: String(url), headers: init.headers ?? {} };
      eia.calls.push(request);
      if (!request.url.startsWith(BASE_URL)) {
        throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
      }
      if (eia.fail) {
        return eia.fail();
      }
      const params = new URL(request.url).searchParams;
      const zones = params.getAll('facets[duoarea][]');
      const products = params.getAll('facets[product][]');
      const start = params.get('start');
      const end = params.get('end');
      const offset = Number(params.get('offset') ?? 0);
      const length = Number(params.get('length') ?? 5000);
      const data = [...eia.rows, ...eia.yearAgoRows]
        .filter(
          (row) =>
            zones.includes(row.duoarea) &&
            products.includes(row.product) &&
            row.period >= start &&
            (!end || row.period <= end),
        )
        .sort((a, b) => b.period.localeCompare(a.period));
      return json(200, {
        response: {
          total: String(data.length),
          dateFormat: 'YYYY-MM-DD',
          frequency: 'weekly',
          data: data.slice(offset, offset + length),
        },
        apiVersion: '2.1.11',
      });
    },
    count: () => eia.calls.length,
  };
  return eia;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers]
 */
export async function createWorld({
  clock = createClock(),
  eia = createFakeEia(),
  config = { language: 'fr', api_key: 'test-key', zones: ['NUS', 'SCO'] },
  devices = [],
  connect = true,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-us-fuel-prices-')),
  timers = false,
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    fetch: eia.fetch,
    store: new Store(dataDir),
    now: clock.now,
    timers,
  });
  if (connect) {
    await gladys.connect();
  }
  return { gladys, fake: gladys.fake, eia, app, clock, dataDir };
}

export const zoneId = (gladys, zone) => zoneIds(gladys, zone);

/** Add every discovered device in Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.fake.discoveredDevices) {
    await world.fake.deviceCreated(device);
  }
}

/** The discovered devices of a configuration. */
export async function discoveredDevices(config) {
  const world = await createWorld({ config, connect: true });
  const devices = world.fake.discoveredDevices;
  await world.app.stop();
  return devices;
}
