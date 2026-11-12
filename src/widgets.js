// -----------------------------------------------------------------------------
// The "US fuel prices" dashboard widget: the prices of an EIA area (setting,
// U.S. average by default; the area needs no device), one tile per fuel
// followed, colored by the weekly trend (green down, orange up), the weekly
// and yearly changes as rows (a setting hides them), and the survey date.
//
// Budget (core): 8 components, 2 texts — at most 4 tiles, 1 status and 1
// caption here.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { FUEL_NAMES, MESSAGES, TEXT, formatCents, pick } from './i18n.js';
import { DEFAULT_ZONE, ZONES, fuelsOf, zoneName } from './zones.js';

export const WIDGET_KEY = 'fuel_prices';

/** The content is cached by the core: the survey is weekly, an hour is plenty. */
export const WIDGET_TTL_SECONDS = 3600;

/** Green when the price fell over the week, orange when it rose. */
export function trendColor(week) {
  if (week === undefined || week === 0) {
    return undefined;
  }
  return week < 0 ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.WARNING;
}

/** The widget settings, normalized: unknown area → U.S. average, changes shown. */
export function normalizeSettings(settings = {}) {
  const zone = String(settings.zone ?? '');
  return {
    zone: ZONES[zone] ? zone : DEFAULT_ZONE,
    showChanges: settings.show_changes !== false,
  };
}

/**
 * Build the widget content.
 * @param {object} options
 * @param {{ period: string, fuels: object } | null} options.data the area's fresh survey
 * @param {ReturnType<typeof normalizeSettings>} options.settings
 * @param {string[]} options.fuels the fuels followed
 * @param {'ok' | 'failing' | 'badKey' | 'demoLimit'} options.status
 * @param {string} options.language
 */
export function buildWidgetContent({ data, settings, fuels, status, language }) {
  const components = [];
  const shown = fuelsOf(settings.zone, fuels).filter((fuel) => data?.fuels[fuel]);
  for (const fuel of shown) {
    const prices = data.fuels[fuel];
    const color = trendColor(prices.week);
    components.push({
      type: 'value',
      label: pick(FUEL_NAMES[fuel], language),
      // Three decimals, as EIA publishes them.
      value: Number(prices.price.toFixed(3)),
      unit: '$/gal',
      icon: 'droplet',
      ...(color ? { color } : {}),
    });
  }
  if (settings.showChanges && shown.length > 0) {
    const items = shown
      .map((fuel) => {
        const { week, year } = data.fuels[fuel];
        const parts = [
          week === undefined
            ? null
            : `${formatCents(week, language)} / ${pick(TEXT.week, language)}`,
          year === undefined
            ? null
            : `${formatCents(year, language)} / ${pick(TEXT.year, language)}`,
        ].filter(Boolean);
        return parts.length === 0
          ? null
          : {
              label: pick(FUEL_NAMES[fuel], language),
              value: parts.join(' · '),
              ...(trendColor(week) ? { color: trendColor(week) } : {}),
            };
      })
      .filter(Boolean);
    if (items.length > 0) {
      components.push({ type: 'status', items });
    }
  }
  if (shown.length > 0) {
    components.push({
      type: 'text',
      variant: 'caption',
      text: `${zoneName(settings.zone, language)} · ${pick(MESSAGES.survey(data.period), language)}`,
    });
  } else {
    const message = {
      ok: data ? TEXT.noData : TEXT.waiting,
      failing: TEXT.unreachable,
      badKey: TEXT.badKey,
      demoLimit: TEXT.demoLimit,
    }[status];
    components.push({ type: 'text', variant: 'body', text: pick(message, language) });
  }
  return { ttl_seconds: WIDGET_TTL_SECONDS, components };
}
