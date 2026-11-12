// -----------------------------------------------------------------------------
// Every text the integration shows, in the four languages of the Gladys
// interface (en, fr, de, es). German says "du", Spanish says "usted", like the
// rest of guim31's integrations. Brands and place names stay as is.
//
//   - NAMES    : device and feature names, written once in the language of
//                the configuration (Gladys freezes them when a device is added);
//   - TEXT     : the fixed texts (widget, configuration screen, actions);
//   - MESSAGES : the texts built from a value, numbers in the local format.
//
// test/i18n.test.js checks that every entry carries exactly the four
// languages, with no empty text and no polite German.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

export { LANGUAGES };

/** The US fuel grades, short (feature names, widget tiles). */
export const FUEL_NAMES = {
  regular: { en: 'Regular', fr: 'Ordinaire', de: 'Normal', es: 'Regular' },
  midgrade: { en: 'Midgrade', fr: 'Intermédiaire', de: 'Mittel', es: 'Intermedia' },
  premium: { en: 'Premium', fr: 'Super', de: 'Super', es: 'Premium' },
  diesel: { en: 'Diesel', fr: 'Gazole', de: 'Diesel', es: 'Diésel' },
};

/** Device and feature names, by language then key. */
export const NAMES = {
  en: {
    device: (zone) => `Fuel prices – ${zone}`,
    price: (fuel) => `${fuel} ($/gal)`,
    week: (fuel) => `${fuel}, 1-week change`,
    year: (fuel) => `${fuel}, 1-year change`,
    survey_date: 'Survey date',
  },
  fr: {
    device: (zone) => `Prix des carburants – ${zone}`,
    price: (fuel) => `${fuel} ($/gal)`,
    week: (fuel) => `${fuel}, variation sur 1 semaine`,
    year: (fuel) => `${fuel}, variation sur 1 an`,
    survey_date: "Date de l'enquête",
  },
  de: {
    device: (zone) => `Kraftstoffpreise – ${zone}`,
    price: (fuel) => `${fuel} ($/gal)`,
    week: (fuel) => `${fuel}, Änderung in 1 Woche`,
    year: (fuel) => `${fuel}, Änderung in 1 Jahr`,
    survey_date: 'Erhebungsdatum',
  },
  es: {
    device: (zone) => `Precios de carburantes – ${zone}`,
    price: (fuel) => `${fuel} ($/gal)`,
    week: (fuel) => `${fuel}, variación en 1 semana`,
    year: (fuel) => `${fuel}, variación en 1 año`,
    survey_date: 'Fecha de la encuesta',
  },
};

/** Fixed texts. */
export const TEXT = {
  waiting: {
    en: 'Waiting for the first EIA survey…',
    fr: 'En attente de la première enquête de l’EIA…',
    de: 'Warte auf die erste EIA-Erhebung …',
    es: 'Esperando la primera encuesta de la EIA…',
  },
  unreachable: {
    en: 'EIA cannot be reached right now.',
    fr: 'L’EIA est injoignable pour le moment.',
    de: 'Die EIA ist gerade nicht erreichbar.',
    es: 'No se puede contactar con la EIA en este momento.',
  },
  badKey: {
    en: 'EIA refuses the API key: check it in the configuration.',
    fr: 'L’EIA refuse la clé d’API : vérifiez-la dans la configuration.',
    de: 'Die EIA lehnt den API-Schlüssel ab: prüfe ihn in der Konfiguration.',
    es: 'La EIA rechaza la clave de API: revísela en la configuración.',
  },
  demoLimit: {
    en: 'The limit of the EIA demo key is reached: enter your own free key.',
    fr: 'La limite de la clé de démonstration de l’EIA est atteinte : saisissez votre clé gratuite.',
    de: 'Das Limit des EIA-Demoschlüssels ist erreicht: gib deinen eigenen kostenlosen Schlüssel ein.',
    es: 'Se alcanzó el límite de la clave de demostración de la EIA: introduzca su propia clave gratuita.',
  },
  rateLimit: {
    en: 'EIA limits the requests of this key for now: next try later.',
    fr: 'L’EIA limite les requêtes de cette clé pour le moment : nouvel essai plus tard.',
    de: 'Die EIA begrenzt gerade die Anfragen dieses Schlüssels: neuer Versuch später.',
    es: 'La EIA limita por ahora las solicitudes de esta clave: nuevo intento más tarde.',
  },
  noData: {
    en: 'EIA has no price for this area and these fuels.',
    fr: 'L’EIA n’a aucun prix pour cette zone et ces carburants.',
    de: 'Die EIA hat keinen Preis für dieses Gebiet und diese Kraftstoffe.',
    es: 'La EIA no tiene precios para esta zona y estos carburantes.',
  },
  initFailed: {
    en: 'The integration could not start: see its logs.',
    fr: 'L’intégration n’a pas pu démarrer : voir ses journaux.',
    de: 'Die Integration konnte nicht starten: siehe ihre Protokolle.',
    es: 'La integración no pudo iniciarse: consulte sus registros.',
  },
  week: { en: '1 week', fr: '1 semaine', de: '1 Woche', es: '1 semana' },
  year: { en: '1 year', fr: '1 an', de: '1 Jahr', es: '1 año' },
};

/** Pick a language in a multi-language object, English as a fallback. */
export const pick = (texts, language) => texts[language] ?? texts.en;

/** A number in the local format, `digits` decimals. */
export const formatNumber = (value, language, digits = 2) =>
  new Intl.NumberFormat(language, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

/** "$3.99" / "3,99 $" */
export const formatPrice = (value, language) =>
  new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);

/** A change in cents, signed: "−15.8 ¢", "+0 ¢". */
export function formatCents(dollars, language) {
  const cents = Math.round(dollars * 1000) / 10;
  const text = new Intl.NumberFormat(language, {
    signDisplay: 'exceptZero',
    maximumFractionDigits: 1,
  }).format(cents);
  // A true minus sign in every language (some locales print a hyphen).
  return `${text.replace('-', '−')} ¢`;
}

/** The survey Monday, as a date in the language: "Nov 9, 2026", "9 nov. 2026". */
export const formatDay = (day, language) =>
  new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  );

const each = (build) =>
  Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));

/** Texts built from values, in the four languages. */
export const MESSAGES = {
  /** Widget caption. */
  survey: (day) =>
    each((l) =>
      pick(
        {
          en: `EIA survey of ${formatDay(day, l)}`,
          fr: `Enquête de l’EIA du ${formatDay(day, l)}`,
          de: `EIA-Erhebung vom ${formatDay(day, l)}`,
          es: `Encuesta de la EIA del ${formatDay(day, l)}`,
        },
        l,
      ),
    ),

  /**
   * One line per fuel, for the scene event: "Regular $3.995 (−15.8 ¢)".
   * @param {Record<string, { price: number, week?: number }>} fuels
   */
  summary: (fuels) =>
    each((l) =>
      Object.entries(fuels)
        .map(([fuel, data]) => {
          const change = data.week === undefined ? '' : ` (${formatCents(data.week, l)})`;
          return `${pick(FUEL_NAMES[fuel], l)} ${formatPrice(data.price, l)}${change}`;
        })
        .join(', '),
    ),

  /** The answer of the "Test the connection" action. */
  testOk: ({ zone, day, fuel, price, demo }) =>
    each((l) => {
      const base = pick(
        {
          en: `EIA answers. ${zone}, survey of ${formatDay(day, l)}: ${pick(FUEL_NAMES[fuel], l)} ${formatPrice(price, l)}/gal.`,
          fr: `L’EIA répond. ${zone}, enquête du ${formatDay(day, l)} : ${pick(FUEL_NAMES[fuel], l)} ${formatPrice(price, l)}/gal.`,
          de: `Die EIA antwortet. ${zone}, Erhebung vom ${formatDay(day, l)}: ${pick(FUEL_NAMES[fuel], l)} ${formatPrice(price, l)}/gal.`,
          es: `La EIA responde. ${zone}, encuesta del ${formatDay(day, l)}: ${pick(FUEL_NAMES[fuel], l)} ${formatPrice(price, l)}/gal.`,
        },
        l,
      );
      if (!demo) {
        return base;
      }
      return `${base} ${pick(
        {
          en: 'Demo key: enter your free key.',
          fr: 'Clé de démonstration : saisissez votre clé gratuite.',
          de: 'Demoschlüssel: gib deinen kostenlosen Schlüssel ein.',
          es: 'Clave de demostración: introduzca su clave gratuita.',
        },
        l,
      )}`;
    }),
};
