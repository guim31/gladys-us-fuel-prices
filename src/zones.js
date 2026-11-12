// -----------------------------------------------------------------------------
// The areas of the EIA weekly retail gasoline and diesel survey: the facet
// `duoarea` of /v2/petroleum/pri/gnd (29 values, listed by the API on
// 2026-11-12). The ids are EIA's: they become the device external ids and the
// manifest option values, they must never change.
//
// Diesel is only published for the country, the PADD regions and California
// (checked on the EIA tables of 2026-11-09): the other areas get no diesel
// feature, rather than a feature that never receives a value.
// -----------------------------------------------------------------------------

/** Same text in the four languages (place names are not translated). */
const same = (name) => ({ en: name, fr: name, de: name, es: name });

/** Area id → `{ name: { en, fr, de, es }, kind, diesel }`, in the manifest order. */
export const ZONES = {
  NUS: {
    kind: 'country',
    diesel: true,
    name: {
      en: 'U.S. average',
      fr: 'Moyenne des États-Unis',
      de: 'USA-Durchschnitt',
      es: 'Promedio de EE. UU.',
    },
  },
  R10: {
    kind: 'region',
    diesel: true,
    name: {
      en: 'East Coast (PADD 1)',
      fr: 'Côte Est (PADD 1)',
      de: 'Ostküste (PADD 1)',
      es: 'Costa Este (PADD 1)',
    },
  },
  R1X: {
    kind: 'region',
    diesel: true,
    name: {
      en: 'New England (PADD 1A)',
      fr: 'Nouvelle-Angleterre (PADD 1A)',
      de: 'Neuengland (PADD 1A)',
      es: 'Nueva Inglaterra (PADD 1A)',
    },
  },
  R1Y: {
    kind: 'region',
    diesel: true,
    name: {
      en: 'Central Atlantic (PADD 1B)',
      fr: 'Atlantique centre (PADD 1B)',
      de: 'Mittelatlantik (PADD 1B)',
      es: 'Atlántico Central (PADD 1B)',
    },
  },
  R1Z: {
    kind: 'region',
    diesel: true,
    name: {
      en: 'Lower Atlantic (PADD 1C)',
      fr: 'Atlantique sud (PADD 1C)',
      de: 'Südatlantik (PADD 1C)',
      es: 'Atlántico Sur (PADD 1C)',
    },
  },
  R20: {
    kind: 'region',
    diesel: true,
    name: {
      en: 'Midwest (PADD 2)',
      fr: 'Midwest (PADD 2)',
      de: 'Mittlerer Westen (PADD 2)',
      es: 'Medio Oeste (PADD 2)',
    },
  },
  R30: {
    kind: 'region',
    diesel: true,
    name: {
      en: 'Gulf Coast (PADD 3)',
      fr: 'Côte du Golfe (PADD 3)',
      de: 'Golfküste (PADD 3)',
      es: 'Costa del Golfo (PADD 3)',
    },
  },
  R40: {
    kind: 'region',
    diesel: true,
    name: {
      en: 'Rocky Mountain (PADD 4)',
      fr: 'Rocheuses (PADD 4)',
      de: 'Rocky Mountains (PADD 4)',
      es: 'Montañas Rocosas (PADD 4)',
    },
  },
  R50: {
    kind: 'region',
    diesel: true,
    name: {
      en: 'West Coast (PADD 5)',
      fr: 'Côte Ouest (PADD 5)',
      de: 'Westküste (PADD 5)',
      es: 'Costa Oeste (PADD 5)',
    },
  },
  R5XCA: {
    kind: 'region',
    diesel: true,
    name: {
      en: 'West Coast less California',
      fr: 'Côte Ouest hors Californie',
      de: 'Westküste ohne Kalifornien',
      es: 'Costa Oeste sin California',
    },
  },
  SCA: { kind: 'state', diesel: true, name: same('California') },
  SCO: { kind: 'state', diesel: false, name: same('Colorado') },
  SFL: { kind: 'state', diesel: false, name: same('Florida') },
  SMA: { kind: 'state', diesel: false, name: same('Massachusetts') },
  SMN: { kind: 'state', diesel: false, name: same('Minnesota') },
  SNY: { kind: 'state', diesel: false, name: same('New York State') },
  SOH: { kind: 'state', diesel: false, name: same('Ohio') },
  STX: { kind: 'state', diesel: false, name: same('Texas') },
  SWA: { kind: 'state', diesel: false, name: same('Washington') },
  YBOS: { kind: 'city', diesel: false, name: same('Boston') },
  YORD: { kind: 'city', diesel: false, name: same('Chicago') },
  YCLE: { kind: 'city', diesel: false, name: same('Cleveland') },
  YDEN: { kind: 'city', diesel: false, name: same('Denver') },
  Y44HO: { kind: 'city', diesel: false, name: same('Houston') },
  Y05LA: { kind: 'city', diesel: false, name: same('Los Angeles') },
  YMIA: { kind: 'city', diesel: false, name: same('Miami') },
  Y35NY: { kind: 'city', diesel: false, name: same('New York City') },
  Y05SF: { kind: 'city', diesel: false, name: same('San Francisco') },
  Y48SE: { kind: 'city', diesel: false, name: same('Seattle') },
};

export const ZONE_IDS = Object.keys(ZONES);
export const DEFAULT_ZONE = 'NUS';

/** The fuels: config value → EIA product code. Keys are forever. */
export const FUELS = {
  regular: 'EPMR',
  midgrade: 'EPMM',
  premium: 'EPMP',
  diesel: 'EPD2D',
};
export const FUEL_KEYS = Object.keys(FUELS);

/** The fuels a zone publishes, among the ones asked. */
export const fuelsOf = (zone, fuels) =>
  fuels.filter((fuel) => fuel !== 'diesel' || ZONES[zone].diesel);

/** The area name in a language. */
export const zoneName = (zone, language) => ZONES[zone].name[language] ?? ZONES[zone].name.en;
