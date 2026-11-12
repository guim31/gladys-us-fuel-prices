# US Fuel Prices (EIA)

The weekly average prices of gasoline and diesel in the United States in
Gladys, from the U.S. Energy Information Administration (EIA): the U.S.
average, the PADD regions, and the states and cities EIA publishes.

These are **averages of the Monday survey, not station prices**: EIA asks a
sample of stations every Monday morning and publishes the averages the same
afternoon (Eastern time). GasBuddy and AAA are not used: they do not offer an
open API.

Not affiliated with the EIA. Developed from Europe, with the public EIA data:
feedback welcome.

## What you get

- One device per **area** you follow, with for each fuel (Regular, Midgrade,
  Premium gasoline and Diesel): the price in $/gal, its change over one week
  and over one year (52 weeks, as EIA computes it), and the date of the
  survey.
- A scene trigger **New weekly fuel prices (EIA)**, with a ready-made
  summary for a message.
- A dashboard widget with the prices of any area and their changes.

## Requirements

- Gladys 5.3.0 or later.
- Internet access from Gladys (`api.eia.gov`).
- A free **EIA API key**: register at
  https://www.eia.gov/opendata/register.php (a name and an email address),
  the key arrives by email at once. Without a key, the integration uses
  `DEMO_KEY`, EIA's shared demonstration key: it is limited to a few requests
  per hour and per day, often already spent.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter the address
of the repository: `https://github.com/guim31/gladys-us-fuel-prices`.

## Configuration

| Field                 | What it does                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EIA API key           | Your free key. Empty: `DEMO_KEY`. Stored by Gladys, never written to the logs.                                                                                              |
| Areas to follow       | One device per area: the U.S. average (default), the 5 PADD regions and 4 sub-regions, 9 states, 10 cities. Diesel exists only for the country, the regions and California. |
| Fuels                 | The fuels shown on every device and in the widget. Empty: all four.                                                                                                         |
| Language of the names | Language of the device and feature names (frozen when a device is added), of the survey date and of the trigger summary. French by default.                                 |

Then open the **Discovery** tab of the integration and add the devices.

## Devices

### Fuel prices – area

| Feature                  | Type                       | Example (U.S., 2026-11-09) |
| ------------------------ | -------------------------- | -------------------------- |
| Regular ($/gal)          | Currency, dollars          | 3.995                      |
| Regular, 1-week change   | Currency, dollars (signed) | −0.158                     |
| Regular, 1-year change   | Currency, dollars (signed) | 0.939                      |
| … the same for each fuel |                            |                            |
| Survey date              | Text                       | Nov 9, 2026                |

Gladys has no $/gal unit: the price feature shows a dollar sign, and its name
says per gallon. A change of −0.158 is a drop of 15.8 cents.

## Scenes

### Price under a threshold

No special trigger is needed: in a scene, choose **Device value** on the
price feature, for example "Regular ($/gal) lower than 3.50".

### A drop of N cents

Same thing on the weekly change: "Regular, 1-week change lower than −0.10"
starts the scene when the price fell by more than 10 cents over the week.

### New weekly fuel prices (EIA)

Fires once a week per followed area, when EIA publishes a new survey (never
for the survey already known when the integration starts). Filter: the
areas. Variables: `zone` (EIA id, e.g. `NUS`), `zone_name`, `survey_date`
(`YYYY-MM-DD`) and `summary`, e.g. "Regular $3.995 (−15.8 ¢), Diesel $6.127
(−16.5 ¢)", ready for a message.

## Dashboard

### US fuel prices widget

Settings: the area (any area, followed or not; the U.S. average by default)
and whether to show the changes. One tile per fuel, green when the price
fell over the week, orange when it rose; then the weekly and yearly changes
in cents, and the date of the survey.

## Actions

**Test the connection to EIA** (Configuration tab) reads the latest survey at
once, with the key of the configuration, and answers with a price.

## Data and limits

- Weekly data: the integration reads EIA every 6 hours, and every hour from
  Monday 21:00 UTC until the new survey is out (on Tuesday after a federal
  holiday). That is a few dozen requests a week, far under the limits of a
  free key.
- A survey older than 15 days is not shown: better no value than an old one.
- Diesel is published for the country, the regions and California only.
- Some weeks EIA withholds a value: the feature then keeps its last value, and so does a change that cannot be computed without it.
- The prices include all taxes.

## Troubleshooting

- **"EIA refuses the API key"**: check the key (copy it again from the
  email), then run **Test the connection to EIA**.
- **"The limit of the EIA demo key is reached"**: enter your own free key.
- **No value**: add the devices in the Discovery tab first; the values
  arrive within a minute.
- More details in the logs of the integration (`LOG_LEVEL=debug`).

## Credits

Data: U.S. Energy Information Administration, Open Data API v2
(`petroleum/pri/gnd`), public domain (U.S. government work). Integration
under the Apache 2.0 licence.
