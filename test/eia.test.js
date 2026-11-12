// -----------------------------------------------------------------------------
// The EIA client: the query, the rows, the changes, the paging, the errors.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_URL,
  EiaError,
  PAGE_LENGTH,
  USER_AGENT,
  dataUrl,
  fetchRows,
  fetchSurvey,
  parseRow,
  summarize,
} from '../src/eia.js';
import { INVALID_KEY, RATE_LIMIT, START, createFakeEia, json } from './helpers/world.js';

const query = { key: 'secret-key', zones: ['NUS', 'SCO', 'YBOS', 'R1X', 'SCA'] };
const ALL = ['regular', 'midgrade', 'premium', 'diesel'];

test('the query asks the weekly values of the areas and products, newest first', () => {
  const url = new URL(
    dataUrl({ key: 'k', zones: ['NUS', 'SCA'], fuels: ['regular', 'diesel'], start: '2026-10-13' }),
  );
  assert.equal(`${url.origin}${url.pathname}`, BASE_URL);
  const params = url.searchParams;
  assert.equal(params.get('api_key'), 'k');
  assert.equal(params.get('frequency'), 'weekly');
  assert.equal(params.get('data[0]'), 'value');
  assert.deepEqual(params.getAll('facets[duoarea][]'), ['NUS', 'SCA']);
  assert.deepEqual(params.getAll('facets[product][]'), ['EPMR', 'EPD2D']);
  assert.equal(params.get('start'), '2026-10-13');
  assert.equal(params.get('end'), null);
  assert.equal(params.get('sort[0][column]'), 'period');
  assert.equal(params.get('sort[0][direction]'), 'desc');
  assert.equal(params.get('length'), String(PAGE_LENGTH));
});

test('a row: string or number values, nothing from "NA", withheld or unknown products', () => {
  const row = { period: '2026-11-09', duoarea: 'NUS', product: 'EPMR', value: '3.995' };
  assert.deepEqual(parseRow(row), {
    period: '2026-11-09',
    zone: 'NUS',
    fuel: 'regular',
    value: 3.995,
  });
  assert.equal(parseRow({ ...row, value: 3.995 }).value, 3.995);
  assert.equal(parseRow({ ...row, product: 'EPD2D' }).fuel, 'diesel');
  for (const value of ['NA', 'W', '', null, '0']) {
    assert.equal(parseRow({ ...row, value }), null, String(value));
  }
  assert.equal(parseRow({ ...row, product: 'EPM0R' }), null);
  assert.equal(parseRow({ ...row, period: '2026-11' }), null);
});

test('the survey of 2026-11-09: prices, weekly and yearly changes as EIA tables show them', async () => {
  const eia = createFakeEia();
  const { summary, yearCache } = await fetchSurvey(eia.fetch, { ...query, fuels: ALL, now: START });
  assert.equal(summary.period, '2026-11-09');
  // EIA, 2026-11-09: U.S. regular 3.995, −0.158 over a week, +0.939 over a year.
  assert.deepEqual(summary.zones.NUS.fuels.regular, { price: 3.995, week: -0.158, year: 0.939 });
  assert.deepEqual(summary.zones.NUS.fuels.diesel, { price: 6.127, week: -0.165, year: 2.29 });
  assert.deepEqual(summary.zones.NUS.fuels.midgrade, { price: 4.608, week: -0.149, year: 0.965 });
  // Colorado: no diesel published; Boston midgrade: no year-ago value here.
  assert.equal(summary.zones.SCO.fuels.diesel, undefined);
  assert.deepEqual(summary.zones.YBOS.fuels.midgrade, { price: 4.626, week: -0.129 });
  assert.deepEqual(summary.zones.SCA.fuels.diesel, { price: 7.897, week: -0.179, year: 2.909 });
  // Two requests: the last weeks, then the same week a year before.
  assert.equal(eia.count(), 2);
  const second = new URL(eia.calls[1].url).searchParams;
  assert.equal(second.get('start'), '2025-11-03');
  assert.equal(second.get('end'), '2025-11-17');
  assert.equal(eia.calls[0].headers['user-agent'], USER_AGENT);

  // The same survey again: the year-ago rows are reused.
  await fetchSurvey(eia.fetch, { ...query, fuels: ALL, now: START, yearCache });
  assert.equal(eia.count(), 3);
  // Another area: read again.
  await fetchSurvey(eia.fetch, { ...query, zones: ['NUS'], fuels: ALL, now: START, yearCache });
  assert.equal(eia.count(), 5);
});

test('a fuel missing from the latest week is not shown as this week', () => {
  const rows = [
    { period: '2026-11-09', zone: 'NUS', fuel: 'regular', value: 3.995 },
    { period: '2026-11-02', zone: 'NUS', fuel: 'regular', value: 4.153 },
    { period: '2026-11-02', zone: 'NUS', fuel: 'premium', value: 5.158 },
  ];
  const summary = summarize(rows);
  assert.deepEqual(Object.keys(summary.zones.NUS.fuels), ['regular']);
  assert.equal(summary.zones.NUS.period, '2026-11-09');
});

test('rows are read page after page', async () => {
  const pages = [];
  const row = { period: '2026-11-09', duoarea: 'NUS', product: 'EPMR', value: '3.995' };
  const fetchImpl = async (url) => {
    const offset = Number(new URL(url).searchParams.get('offset'));
    pages.push(offset);
    const count = offset === 0 ? PAGE_LENGTH : 3;
    return json(200, {
      response: { total: String(PAGE_LENGTH + 3), data: Array(count).fill(row) },
    });
  };
  const rows = await fetchRows(fetchImpl, { ...query, fuels: ['regular'], start: '2026-10-13' });
  assert.equal(rows.length, PAGE_LENGTH + 3);
  assert.deepEqual(pages, [0, PAGE_LENGTH]);
});

test('errors: refused key, rate limit with Retry-After, unreachable — never the key', async () => {
  const read = (fetchImpl) =>
    fetchSurvey(fetchImpl, { ...query, fuels: ALL, now: START }).then(
      () => assert.fail('should throw'),
      (err) => err,
    );

  const invalid = await read(async () => json(403, INVALID_KEY));
  assert.ok(invalid instanceof EiaError);
  assert.equal(invalid.message, 'EIA answered HTTP 403 API_KEY_INVALID');
  assert.equal(invalid.badKey, true);
  assert.equal(invalid.rateLimited, false);

  const limited = await read(async () => json(429, RATE_LIMIT, { 'retry-after': '38061' }));
  assert.equal(limited.message, 'EIA answered HTTP 429 OVER_RATE_LIMIT');
  assert.equal(limited.rateLimited, true);
  assert.equal(limited.badKey, false);
  assert.equal(limited.retryAfterMs, 38061000);

  const html = await read(async () => new Response('<html>Bad gateway</html>', { status: 502 }));
  assert.equal(html.message, 'EIA answered HTTP 502');

  const empty = await read(async () => json(200, { response: {} }));
  assert.equal(empty.message, 'EIA answered without data');

  const down = await read(async () => {
    throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
  });
  assert.equal(down.message, 'EIA unreachable (ECONNREFUSED)');

  for (const err of [invalid, limited, html, empty, down]) {
    assert.doesNotMatch(err.message, /secret-key|api_key/);
  }
});
