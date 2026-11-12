# US Fuel Prices (EIA) for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) external integration that brings the
**weekly average gasoline and diesel prices of the United States** into Gladys, from the
[U.S. Energy Information Administration](https://www.eia.gov/petroleum/gasdiesel/) (EIA)
Open Data API v2.

These are the averages of EIA's Monday survey, **not station prices**. GasBuddy and AAA are not
used: they offer no open API and block robots.

## Features

- One device per **area**: the U.S. average, the PADD regions (East Coast, New England, Central
  Atlantic, Lower Atlantic, Midwest, Gulf Coast, Rocky Mountain, West Coast, West Coast less
  California), 9 states (California, Colorado, Florida, Massachusetts, Minnesota, New York, Ohio,
  Texas, Washington) and 10 cities (Boston, Chicago, Cleveland, Denver, Houston, Los Angeles,
  Miami, New York City, San Francisco, Seattle).
- For each fuel chosen (Regular, Midgrade, Premium, Diesel): the price in $/gal, the change over
  one week and over one year, and the survey date. Diesel exists for the country, the regions and
  California only.
- "Price under a threshold" and "a drop of N cents" are plain Gladys scenes on these features.
- A scene trigger **New weekly fuel prices (EIA)**, once a week per area, with a ready-made
  summary.
- A dashboard widget: the prices of any area, colored by the weekly trend, with their changes.
- Documentation in English, French, German and Spanish ([`docs/`](docs)).

## Requirements

- Gladys 5.3.0 or later, with Internet access (`api.eia.gov`).
- A free EIA API key: https://www.eia.gov/opendata/register.php. Without one, the integration
  falls back to `DEMO_KEY`, EIA's shared demonstration key, limited to a few requests per hour and
  often spent.

## Installation

In Gladys: **Integrations → Install from GitHub**, then enter
`https://github.com/guim31/gladys-us-fuel-prices`. Enter the key, choose the areas and fuels,
then add the devices from the **Discovery** tab.

## How it works

The container reads `/v2/petroleum/pri/gnd/data/` (weekly, the areas and products followed, the
last four weeks), then once per new survey the same week a year before, for the yearly change
(52 weeks, as on EIA's own tables). It reads every 6 hours, hourly from Monday 21:00 UTC until
the new survey is out, an hour after a failure, or when EIA's `Retry-After` says so. The devices
are not polled by the core: the container publishes the changed states itself, and every value
again every 12 hours. That is a few dozen requests a week, far under EIA's limits for a free
key. The key never appears in the logs.

## Limitations

- Weekly averages only, with the sample and the delays of the EIA survey.
- A survey older than 15 days is not published.
- Developed from Europe, without a US car or a GasBuddy account: feedback welcome. The day the
  integration was written, the shared `DEMO_KEY` was over its limit: the client was tested live
  on EIA's error answers, and against fixtures carrying EIA's published values of the
  2026-11-09 survey in the API v2 row format.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake EIA (`test/fixtures/`), never the network.
See [`CLAUDE.md`](CLAUDE.md) for the project rules. Versions, images and releases belong to the
Release workflow (Actions → Release).

## Credits

- [U.S. Energy Information Administration](https://www.eia.gov): the weekly retail gasoline and
  diesel prices, public domain.
- The architecture, the conformity and language tests follow
  [gladys-us-grid](https://github.com/guim31/gladys-us-grid),
  [gladys-rte](https://github.com/guim31/gladys-rte) and
  [gladys-wled](https://github.com/guim31/gladys-wled).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by the U.S. Energy Information
Administration. The cover shows a generic fuel pump, not the EIA logo.

## License

Apache-2.0
