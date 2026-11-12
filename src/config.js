// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined` or with a value typed by hand with stray spaces.
// -----------------------------------------------------------------------------

import { DEFAULT_ZONE, FUEL_KEYS, ZONES } from './zones.js';

/** The languages of the Gladys interface, every text exists in all four. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** EIA's shared demonstration key: enough to try, too little to live on. */
export const DEMO_KEY = 'DEMO_KEY';

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // The free EIA key. Empty: the demonstration key.
  api_key: '',
  // EIA areas followed: one device each.
  zones: [DEFAULT_ZONE],
  // Fuels followed: their features on every device, and in the widget.
  fuels: [...FUEL_KEYS],
  // Language of the feature names (frozen when a device is added) and of the
  // texts the container produces where Gladys does not say the user's
  // language (survey date, scene events, action messages).
  language: 'fr',
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const language = String(raw.language ?? DEFAULT_CONFIG.language);
  const key = String(raw.api_key ?? '').trim();
  const fuels = normalizeList(raw.fuels, (id) => FUEL_KEYS.includes(id));
  return {
    api_key: key,
    usesDemoKey: key === '' || key === DEMO_KEY,
    zones:
      raw.zones === undefined || raw.zones === null
        ? [...DEFAULT_CONFIG.zones]
        : normalizeList(raw.zones, (id) => Boolean(ZONES[id])),
    // No fuel at all would leave devices without a feature: all four then.
    fuels: fuels.length > 0 ? FUEL_KEYS.filter((id) => fuels.includes(id)) : [...FUEL_KEYS],
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
}

/** The key sent to EIA. */
export const apiKey = (config) => (config.usesDemoKey ? DEMO_KEY : config.api_key);

/**
 * A multi_select value: an array (a comma-separated string is accepted too),
 * unknown values dropped, without duplicates, in the manifest order.
 * @param {unknown} raw
 * @param {(id: string) => boolean} known
 * @returns {string[]}
 */
function normalizeList(raw, known) {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  return [...new Set(list.map((id) => String(id).trim()).filter(known))];
}
