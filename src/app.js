// -----------------------------------------------------------------------------
// The integration, wired on a Gladys client (the real one in index.js, the
// SDK's fake Gladys in the tests).
//
// Refresh: the EIA survey is weekly (Monday prices, published Monday
// afternoon, Eastern time), so the devices are not polled by the core
// (should_poll false) and the container ticks every 15 minutes on its own
// timer. A tick reads EIA only when it is due:
//   - every 6 hours in the normal case (a few times a day);
//   - every hour from Monday 21:00 UTC until the new survey is out (three
//     days at most: a holiday moves it to Tuesday);
//   - an hour after a failure, or later when EIA says so (Retry-After);
//   - at once when the areas or fuels followed change.
// Every tick publishes the states that changed, each value sent again at
// least every 12 hours (heartbeat). A new survey fires the "New weekly
// prices" trigger, once per area.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { apiKey, normalizeConfig } from './config.js';
import { buildDevices, freshZone, zoneIds, zoneStates } from './devices.js';
import { EiaError, fetchSurvey } from './eia.js';
import { MESSAGES, TEXT, pick } from './i18n.js';
import { createIssueLog } from './issues.js';
import { Store } from './store.js';
import { WIDGET_KEY, buildWidgetContent, normalizeSettings } from './widgets.js';
import { DEFAULT_ZONE, ZONE_IDS, fuelsOf, zoneName } from './zones.js';

const logger = createLogger({ name: 'us-fuel-prices' });

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const TICK_MS = 15 * 60 * 1000;
export const REFRESH_MS = 6 * HOUR_MS;
export const RELEASE_RETRY_MS = HOUR_MS;
export const FAILURE_RETRY_MS = HOUR_MS;
export const HEARTBEAT_MS = 12 * HOUR_MS;
/** The new survey is expected from Monday 21:00 UTC (16:00 or 17:00 in Washington). */
const RELEASE_OFFSET_MS = 7 * DAY_MS + 21 * HOUR_MS;
const RELEASE_WINDOW_MS = 3 * DAY_MS;
/** An area shown by a widget in the last week stays read without a device. */
const WIDGET_INTEREST_MS = 7 * DAY_MS;

export const ACTION_KEY = 'test_connection';
export const NEW_PRICES = 'new_prices';
export const TRIGGER_KEYS = [NEW_PRICES];

/**
 * @param {object} gladys GladysIntegration, or the SDK's fake Gladys
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {Store} [options.store]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the timer
 */
export function registerHandlers(
  gladys,
  {
    fetch: fetchImpl = globalThis.fetch,
    store = new Store(),
    now = () => Date.now(),
    timers = true,
  } = {},
) {
  let config = normalizeConfig(gladys.config ?? {});
  /** What /data keeps: `{ announced: { <zone>: <survey Monday> } }`. */
  let persisted = { announced: {} };
  let survey = null;
  let yearCache = null;
  /** The areas and fuels of the last successful read. */
  let readKey = null;
  let attemptAt = -Infinity;
  /** The last failure: `{ kind: 'failing' | 'badKey' | 'demoLimit', retryAt }`. */
  let failure = null;
  const widgetZones = new Map();
  let lastStatus = null;
  let firstRead = true;
  let timer = null;
  let stopped = false;
  let ticking = null;

  const readIssues = createIssueLog(logger);
  const gladysIssues = createIssueLog(logger);

  const ready = store.load().then((data) => {
    persisted = {
      announced: data.announced && typeof data.announced === 'object' ? data.announced : {},
    };
  });

  const isCreated = (zone) =>
    (gladys.devices ?? []).some((device) => device.external_id === zoneIds(gladys, zone).device);

  /** The areas to read: the ones followed, then the ones a widget showed lately. */
  function wantedZones(extra = []) {
    const shown = [...widgetZones]
      .filter(([, at]) => now() - at < WIDGET_INTEREST_MS)
      .map(([zone]) => zone);
    const wanted = new Set([...config.zones, ...shown, ...extra]);
    return ZONE_IDS.filter((zone) => wanted.has(zone));
  }
  const keyOf = (zones) => `${zones.join(',')}|${config.fuels.join(',')}`;

  /** When the next read is due. */
  function nextReadAt() {
    const zones = wantedZones();
    if (zones.length === 0) {
      return Infinity;
    }
    if (failure) {
      return failure.retryAt;
    }
    if (readKey !== keyOf(zones)) {
      return attemptAt === -Infinity ? now() : attemptAt + 60 * 1000;
    }
    const expected = survey?.period
      ? Date.parse(`${survey.period}T00:00:00Z`) + RELEASE_OFFSET_MS
      : 0;
    const t = now();
    if (t >= expected && t < expected + RELEASE_WINDOW_MS) {
      return attemptAt + RELEASE_RETRY_MS;
    }
    return attemptAt + REFRESH_MS;
  }

  // --- Reading EIA ------------------------------------------------------------

  /** @returns {Promise<boolean>} the read succeeded */
  async function refresh(extra = []) {
    const zones = wantedZones(extra);
    if (zones.length === 0) {
      return true;
    }
    attemptAt = now();
    try {
      const result = await fetchSurvey(fetchImpl, {
        key: apiKey(config),
        zones,
        fuels: config.fuels,
        now: now(),
        yearCache,
      });
      const changed = result.summary.period !== survey?.period;
      survey = result.summary;
      yearCache = result.yearCache;
      readKey = keyOf(zones);
      failure = null;
      readIssues.ok('read', 'EIA answers again');
      if (firstRead) {
        firstRead = false;
        logger.info(`EIA reachable: survey of ${survey.period ?? 'none'}`);
      }
      if (changed) {
        logger.debug(`EIA survey ${survey.period}: ${JSON.stringify(survey.zones)}`);
      }
      await announce();
      return true;
    } catch (err) {
      const eia = err instanceof EiaError ? err : new EiaError(err.message);
      let kind = 'failing';
      let wait = FAILURE_RETRY_MS;
      if (eia.badKey) {
        kind = 'badKey';
        wait = REFRESH_MS;
      } else if (eia.rateLimited) {
        kind = config.usesDemoKey ? 'demoLimit' : 'failing';
        wait = Math.max(FAILURE_RETRY_MS, Math.min(eia.retryAfterMs ?? 0, DAY_MS));
      }
      failure = { kind, retryAt: attemptAt + wait, error: eia };
      readIssues.fail('read', `EIA cannot be read: ${eia.message}`);
      return false;
    }
  }

  // --- The trigger ------------------------------------------------------------

  /**
   * A new survey: one event per area followed. An area seen for the first time
   * (a fresh install, a new area) is only remembered: the survey it shows is not
   * news.
   */
  async function announce() {
    const announced = { ...persisted.announced };
    const events = [];
    for (const zone of config.zones) {
      const data = freshZone(survey, zone, now());
      if (!data) {
        continue;
      }
      const fuels = Object.fromEntries(
        fuelsOf(zone, config.fuels)
          .filter((fuel) => data.fuels[fuel])
          .map((fuel) => [fuel, data.fuels[fuel]]),
      );
      if (Object.keys(fuels).length === 0) {
        continue;
      }
      if (announced[zone] !== undefined && data.period > announced[zone]) {
        events.push({
          zone,
          zone_name: zoneName(zone, config.language),
          survey_date: data.period,
          summary: pick(MESSAGES.summary(fuels), config.language),
        });
      }
      if (announced[zone] === undefined || data.period > announced[zone]) {
        announced[zone] = data.period;
      }
    }
    // Areas no longer followed are forgotten.
    for (const zone of Object.keys(announced)) {
      if (!config.zones.includes(zone)) {
        delete announced[zone];
      }
    }
    if (JSON.stringify(announced) !== JSON.stringify(persisted.announced)) {
      persisted.announced = announced;
      store.save(persisted);
    }
    // Remembered even when Gladys refuses the event: never fired in a loop.
    for (const event of events) {
      try {
        await gladys.publishSceneEvent(NEW_PRICES, event);
        logger.debug(`Trigger ${NEW_PRICES}: ${JSON.stringify(event)}`);
      } catch (err) {
        gladysIssues.fail(
          'scene-event',
          `Trigger ${NEW_PRICES} not sent to Gladys: ${err.message}`,
        );
      }
    }
  }

  // --- States -----------------------------------------------------------------

  async function publishStates() {
    const states = config.zones
      .filter(isCreated)
      .flatMap((zone) => zoneStates(gladys, zone, survey, config, now()));
    if (states.length === 0) {
      return;
    }
    try {
      const { count } = await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      if (count > 0) {
        logger.debug(`${count} state(s) published`);
      }
      gladysIssues.ok('states', 'States accepted by Gladys again');
    } catch (err) {
      gladysIssues.fail('states', `States not accepted by Gladys: ${err.message}`);
    }
  }

  const failureText = () =>
    ({ badKey: TEXT.badKey, demoLimit: TEXT.demoLimit })[failure?.kind] ??
    (failure?.error?.rateLimited ? TEXT.rateLimit : TEXT.unreachable);

  /** The application status of the Configuration screen, sent on change only. */
  async function reportStatus() {
    const status = failure ? { connected: false, message: failureText() } : { connected: true };
    const key = JSON.stringify(status);
    if (key === lastStatus) {
      return;
    }
    try {
      // The four languages: the core 5.2+ refuses a plain string.
      await gladys.setConnectionStatus(status.connected, status.message);
      lastStatus = key;
    } catch (err) {
      logger.debug(`Connection status not sent: ${err.message}`);
    }
  }

  // --- The tick ---------------------------------------------------------------

  /**
   * Read EIA when due, publish what changed. One tick at a time: a second
   * caller waits for the one in progress.
   * @param {object} [options]
   * @param {boolean} [options.force] read now
   * @param {string[]} [options.extra] areas to read too (the action's)
   */
  async function tick({ force = false, extra = [] } = {}) {
    // A forced tick (new configuration) must not reuse a tick started with
    // the previous one: it waits for it, then runs.
    while (force && ticking) {
      await ticking.catch(() => {});
    }
    if (ticking) {
      return ticking;
    }
    ticking = (async () => {
      if (gladys.connected === false) {
        logger.debug('Gladys unreachable: tick skipped');
        return;
      }
      let read = false;
      if (force || now() >= nextReadAt()) {
        const before = survey?.period;
        await refresh(extra);
        read = survey?.period !== before;
      }
      await publishStates();
      await reportStatus();
      if (read) {
        gladys.requestWidgetRefresh(WIDGET_KEY);
      }
    })().finally(() => {
      ticking = null;
    });
    return ticking;
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await tick();
      } catch (err) {
        logger.error(`Refresh failed (${err.message})`);
      } finally {
        schedule();
      }
    }, TICK_MS);
  }

  /** (Re)start: publish the devices, read EIA, then tick on the timer. */
  async function start() {
    await ready;
    stopped = false;
    lastStatus = null;
    failure = null;
    try {
      await gladys.publishDiscoveredDevices(buildDevices(gladys, config));
    } catch (err) {
      logger.error(`Publishing the devices failed: ${err.message}`);
    }
    schedule();
    await tick({ force: true });
  }

  // --- Handlers ---------------------------------------------------------------

  gladys.onScanRequest(async () => {
    await gladys.publishDiscoveredDevices(buildDevices(gladys, config));
  });

  // A device just added: its states again now (the core dropped the ones it
  // received before the feature existed), and the widget may show its area.
  const onDeviceAdded = async () => {
    await tick({ force: !survey && !failure });
    gladys.requestWidgetRefresh(WIDGET_KEY);
  };
  gladys.onDeviceCreated(onDeviceAdded);
  gladys.onDeviceUpdated(onDeviceAdded);
  gladys.onDeviceDeleted(() => gladys.requestWidgetRefresh(WIDGET_KEY));

  gladys.onAction(ACTION_KEY, async () => {
    logger.info('Action: test the connection to EIA');
    const zone = config.zones[0] ?? DEFAULT_ZONE;
    failure = null;
    await tick({ force: true, extra: [zone] });
    if (failure) {
      throw new Error(pick(failureText(), config.language));
    }
    const data = freshZone(survey, zone, now());
    const fuel = fuelsOf(zone, config.fuels).find((id) => data?.fuels[id]);
    if (!fuel) {
      throw new Error(pick(TEXT.noData, config.language));
    }
    return pick(
      MESSAGES.testOk({
        zone: zoneName(zone, config.language),
        day: data.period,
        fuel,
        price: data.fuels[fuel].price,
        demo: config.usesDemoKey,
      }),
      config.language,
    );
  });

  gladys.onWidgetGet(WIDGET_KEY, async ({ settings, language }) => {
    const normalized = normalizeSettings(settings);
    const known = widgetZones.has(normalized.zone) || config.zones.includes(normalized.zone);
    widgetZones.set(normalized.zone, now());
    // An area no read covers yet: read it now, unless EIA failed lately.
    if (!known && !freshZone(survey, normalized.zone, now()) && now() >= (failure?.retryAt ?? 0)) {
      await tick({ force: true });
    }
    return buildWidgetContent({
      data: freshZone(survey, normalized.zone, now()),
      settings: normalized,
      fuels: config.fuels,
      status: failure?.kind ?? 'ok',
      language,
    });
  });

  gladys.onConfigUpdated(async (raw) => {
    config = normalizeConfig(raw);
    logger.info('New configuration received');
    await start();
  });

  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      await start();
    } catch (err) {
      logger.error(`Post-connection initialization failed: ${err.message}`);
      await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
    }
  });

  return {
    ready,
    tick,
    /** For the tests: what the integration holds. */
    get survey() {
      return survey;
    },
    get announced() {
      return persisted.announced;
    },
    nextReadAt,
    /** Stop the timer and wait for the last write under /data. */
    async stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
      await ticking?.catch(() => {});
      await store.flush();
    },
  };
}
