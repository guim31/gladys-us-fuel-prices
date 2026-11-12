// -----------------------------------------------------------------------------
// The EIA Open Data API v2, weekly retail gasoline and diesel prices:
//   GET https://api.eia.gov/v2/petroleum/pri/gnd/data/
//       ?api_key=…&frequency=weekly&data[0]=value
//       &facets[duoarea][]=NUS&facets[product][]=EPMR…&start=YYYY-MM-DD
//
// One row per area, product and Monday (`period`), the price in $/gal as a
// string ("3.995"; a number is accepted too). The survey is of the Monday
// morning, published Monday afternoon (Eastern time), Tuesday after a holiday.
//
// A refresh reads the last weeks (the price and the weekly change), then,
// once per new survey, the same week a year before (the yearly change, the
// 52-week span EIA uses on its own tables). Errors carry the HTTP status and
// EIA's error code (API_KEY_INVALID, OVER_RATE_LIMIT…), never the URL: it
// holds the key.
// -----------------------------------------------------------------------------

import { FUELS } from './zones.js';

export const BASE_URL = 'https://api.eia.gov/v2/petroleum/pri/gnd/data/';
export const REQUEST_TIMEOUT_MS = 20_000;
export const USER_AGENT =
  'gladys-us-fuel-prices (+https://github.com/guim31/gladys-us-fuel-prices)';
/** EIA serves at most 5,000 rows per request. */
export const PAGE_LENGTH = 5000;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Four weeks back: the latest survey and the one before, even after a missed week. */
const RECENT_DAYS = 28;
/** EIA's "year ago": the survey 52 weeks before. */
export const YEAR_DAYS = 364;

const PRODUCT_TO_FUEL = Object.fromEntries(
  Object.entries(FUELS).map(([fuel, code]) => [code, fuel]),
);

/** An EIA error, or an unreachable server. */
export class EiaError extends Error {
  /**
   * @param {string} message
   * @param {object} [details]
   * @param {number} [details.status] HTTP status
   * @param {string} [details.code] EIA error code
   * @param {number} [details.retryAfterMs] from the Retry-After header
   */
  constructor(message, { status, code, retryAfterMs } = {}) {
    super(message);
    this.name = 'EiaError';
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }

  /** The key is refused (invalid, missing, disabled). */
  get badKey() {
    return this.status === 401 || this.status === 403 || /^API_KEY/.test(this.code ?? '');
  }

  get rateLimited() {
    return this.status === 429 || this.code === 'OVER_RATE_LIMIT';
  }
}

/** `YYYY-MM-DD` of a timestamp, in UTC. */
export const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (day) => Date.parse(`${day}T00:00:00Z`);

/**
 * The query URL.
 * @param {object} query
 * @param {string} query.key
 * @param {string[]} query.zones EIA duoarea ids
 * @param {string[]} query.fuels config fuel keys
 * @param {string} query.start YYYY-MM-DD
 * @param {string} [query.end] YYYY-MM-DD
 * @param {number} [query.offset]
 */
export function dataUrl({ key, zones, fuels, start, end, offset = 0 }) {
  const params = new URLSearchParams();
  params.set('api_key', key);
  params.set('frequency', 'weekly');
  params.append('data[0]', 'value');
  for (const zone of zones) {
    params.append('facets[duoarea][]', zone);
  }
  for (const fuel of fuels) {
    params.append('facets[product][]', FUELS[fuel]);
  }
  params.set('start', start);
  if (end) {
    params.set('end', end);
  }
  params.append('sort[0][column]', 'period');
  params.append('sort[0][direction]', 'desc');
  params.set('offset', String(offset));
  params.set('length', String(PAGE_LENGTH));
  return `${BASE_URL}?${params}`;
}

/**
 * One GET, the JSON body.
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 */
async function requestJson(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // A DNS failure, a refused connection, the timeout: the cause names it.
    const cause = err?.cause?.code ?? err?.cause?.message ?? err?.name ?? 'network error';
    throw new EiaError(`EIA unreachable (${cause})`);
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    // An HTML error page: the status says enough.
  }
  const code = typeof body?.error?.code === 'string' ? body.error.code : undefined;
  if (!response.ok || body?.error) {
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new EiaError(`EIA answered HTTP ${response.status}${code ? ` ${code}` : ''}`, {
      status: response.status,
      code,
      retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
    });
  }
  if (!Array.isArray(body?.response?.data)) {
    throw new EiaError('EIA answered without data');
  }
  return body.response;
}

/**
 * Every row of a query, page after page.
 * @returns {Promise<Array<{ period: string, zone: string, fuel: string, value: number }>>}
 */
export async function fetchRows(fetchImpl, query) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_LENGTH) {
    const page = await requestJson(fetchImpl, dataUrl({ ...query, offset }));
    rows.push(...page.data.map(parseRow).filter(Boolean));
    const total = Number(page.total);
    if (page.data.length < PAGE_LENGTH || !(offset + PAGE_LENGTH < total)) {
      return rows;
    }
  }
}

/** A row kept only when it is a known area and fuel with a price. */
export function parseRow(row) {
  const fuel = PRODUCT_TO_FUEL[row?.product];
  const value = typeof row?.value === 'number' ? row.value : Number.parseFloat(row?.value);
  if (!fuel || typeof row.duoarea !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.period ?? '')) {
    return null;
  }
  // "NA", "W" (withheld) or empty: no price this week.
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return { period: row.period, zone: row.duoarea, fuel, value };
}

/**
 * The prices of the latest survey, with the weekly and yearly changes.
 *
 * @param {Array} recent rows of the last weeks
 * @param {Array} yearAgo rows around the same week a year before
 * @returns {{ period: string | null, zones: Record<string, { period: string, fuels: Record<string, { price: number, week?: number, year?: number }> }> }}
 */
export function summarize(recent, yearAgo = []) {
  const series = new Map();
  for (const row of [...recent, ...yearAgo]) {
    const key = `${row.zone}|${row.fuel}`;
    if (!series.has(key)) {
      series.set(key, new Map());
    }
    series.get(key).set(row.period, row.value);
  }
  const zones = {};
  let period = null;
  for (const row of recent) {
    if (!period || row.period > period) {
      period = row.period;
    }
  }
  const recentPeriods = new Set(recent.map((row) => row.period));
  for (const [key, values] of series) {
    const [zone, fuel] = key.split('|');
    const latest = [...values.keys()]
      .filter((p) => recentPeriods.has(p))
      .sort()
      .pop();
    if (!latest) {
      continue;
    }
    const price = values.get(latest);
    const at = dayMs(latest);
    const before = values.get(isoDay(at - 7 * DAY_MS));
    const yearBefore = values.get(isoDay(at - YEAR_DAYS * DAY_MS));
    zones[zone] ??= { period: latest, fuels: {} };
    if (latest > zones[zone].period) {
      zones[zone].period = latest;
    }
    zones[zone].fuels[fuel] = {
      price,
      period: latest,
      ...(before !== undefined ? { week: round3(price - before) } : {}),
      ...(yearBefore !== undefined ? { year: round3(price - yearBefore) } : {}),
    };
  }
  // A fuel left behind by a missed week is not shown as this week's price.
  for (const zone of Object.values(zones)) {
    for (const [fuel, data] of Object.entries(zone.fuels)) {
      if (data.period !== zone.period) {
        delete zone.fuels[fuel];
      } else {
        delete data.period;
      }
    }
  }
  return { period, zones };
}

const round3 = (value) => Math.round(value * 1000) / 1000;

/**
 * Read the latest survey for these zones and fuels.
 * @param {typeof fetch} fetchImpl
 * @param {object} options
 * @param {string} options.key
 * @param {string[]} options.zones
 * @param {string[]} options.fuels
 * @param {number} options.now
 * @param {{ key: string, rows: Array } | null} [options.yearCache] the
 *   year-ago rows already read for a survey, reused while it is the latest
 * @returns {Promise<{ summary: ReturnType<typeof summarize>, yearCache: { key: string, rows: Array } | null }>}
 */
export async function fetchSurvey(fetchImpl, { key, zones, fuels, now, yearCache = null }) {
  const query = { key, zones, fuels };
  const recent = await fetchRows(fetchImpl, {
    ...query,
    start: isoDay(now - RECENT_DAYS * DAY_MS),
  });
  const { period } = summarize(recent);
  if (!period) {
    return { summary: summarize([]), yearCache: null };
  }
  // Reused only for the same survey, areas and fuels.
  const cacheKey = [period, zones.join(','), fuels.join(',')].join('|');
  let cache = yearCache;
  if (!cache || cache.key !== cacheKey) {
    const yearAt = dayMs(period) - YEAR_DAYS * DAY_MS;
    const rows = await fetchRows(fetchImpl, {
      ...query,
      start: isoDay(yearAt - 7 * DAY_MS),
      end: isoDay(yearAt + 7 * DAY_MS),
    });
    cache = { key: cacheKey, rows };
  }
  return { summary: summarize(recent, cache.rows), yearCache: cache };
}
