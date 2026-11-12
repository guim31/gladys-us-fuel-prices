// -----------------------------------------------------------------------------
// The devices and their states: one "Fuel prices – <area>" per EIA area
// followed, with, for each fuel followed (diesel only where EIA publishes it):
//
//   currency/decimal + dollar   <fuel>_price         the average retail price, $/gal
//   currency/decimal + dollar   <fuel>_week_change   change over one week, $/gal
//   currency/decimal + dollar   <fuel>_year_change   change over 52 weeks, $/gal
//   text/text                   survey_date          the Monday of the survey
//
// Gladys has no $/gal unit: the price feature says it in its name. The changes
// are signed, their bounds symmetric. "Price under a threshold" and "a drop of
// N cents" are plain Gladys scenes on these features.
//
// The survey is weekly: no core polling (should_poll false, the container
// refreshes on its own timer, src/app.js). Ids are built from EIA's area ids:
// they must never change.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { FUEL_NAMES, NAMES, formatDay, pick } from './i18n.js';
import { fuelsOf, zoneName } from './zones.js';

export const ZONE = 'zone';

/** The highest US average ever is about $6.4 (California, 2022): display bounds. */
export const PRICE_MAX = 15;
export const WEEK_BOUND = 2;
export const YEAR_BOUND = 5;

/** A survey older than this is not published: EIA stopped, better no value. */
export const MAX_SURVEY_AGE_MS = 15 * 24 * 60 * 60 * 1000;

export const zoneIds = (gladys, zone) => gladys.externalIds(ZONE, zone);

const base = { read_only: true, has_feedback: false, keep_history: true };

function feature(ids, key, name, definition) {
  return { ...base, ...definition, name, external_id: ids.feature(key) };
}

const money = (min, max) => ({
  category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
  type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
  unit: DEVICE_FEATURE_UNITS.DOLLAR,
  min,
  max,
});

/**
 * The discovery payload: a device per area followed.
 * @param {object} gladys
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 */
export function buildDevices(gladys, config) {
  return config.zones.map((zone) => buildZoneDevice(gladys, config, zone));
}

export function buildZoneDevice(gladys, config, zone) {
  const ids = zoneIds(gladys, zone);
  const names = NAMES[config.language] ?? NAMES.fr;
  const fuels = fuelsOf(zone, config.fuels);
  return {
    name: names.device(zoneName(zone, config.language)),
    external_id: ids.device,
    should_poll: false,
    features: [
      ...fuels.flatMap((fuel) => {
        const label = pick(FUEL_NAMES[fuel], config.language);
        return [
          feature(ids, `${fuel}_price`, names.price(label), money(0, PRICE_MAX)),
          feature(ids, `${fuel}_week_change`, names.week(label), money(-WEEK_BOUND, WEEK_BOUND)),
          feature(ids, `${fuel}_year_change`, names.year(label), money(-YEAR_BOUND, YEAR_BOUND)),
        ];
      }),
      // A date: no history.
      feature(ids, 'survey_date', names.survey_date, {
        category: DEVICE_FEATURE_CATEGORIES.TEXT,
        type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
        keep_history: false,
        min: 0,
        max: 0,
      }),
    ],
  };
}

/** The zone's data if its survey is recent enough, else null. */
export function freshZone(survey, zone, now) {
  const data = survey?.zones?.[zone];
  if (!data || now - Date.parse(`${data.period}T00:00:00Z`) > MAX_SURVEY_AGE_MS) {
    return null;
  }
  return data;
}

/**
 * The states of an area device; nothing from a stale survey.
 * @param {object} gladys
 * @param {string} zone
 * @param {object | null} survey as summarized by src/eia.js
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 * @param {number} now
 */
export function zoneStates(gladys, zone, survey, config, now) {
  const data = freshZone(survey, zone, now);
  if (!data) {
    return [];
  }
  const ids = zoneIds(gladys, zone);
  const state = (key, value) => ({ device_feature_external_id: ids.feature(key), state: value });
  const states = [];
  for (const fuel of fuelsOf(zone, config.fuels)) {
    const prices = data.fuels[fuel];
    if (!prices) {
      continue;
    }
    states.push(state(`${fuel}_price`, prices.price));
    if (prices.week !== undefined) {
      states.push(state(`${fuel}_week_change`, prices.week));
    }
    if (prices.year !== undefined) {
      states.push(state(`${fuel}_year_change`, prices.year));
    }
  }
  if (states.length > 0) {
    states.push({
      device_feature_external_id: ids.feature('survey_date'),
      text: formatDay(data.period, config.language),
    });
  }
  return states;
}
