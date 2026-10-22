# LubeLogger for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration for
[LubeLogger](https://lubelogger.com), the self-hosted vehicle maintenance log:
follow the odometer, consumption and spending of your vehicles, and above all
react to their maintenance reminders (oil change, tyres, inspection,
insurance) in scenes.

Tested against a real LubeLogger 1.7.4 server (official Docker image):
reminders by date and by odometer, made urgent then past due by odometer
readings added through the API.

## Features

- **One device per vehicle**: odometer (or engine hours), average consumption
  (L/100 km or mpg; kWh/100 km or mi/kWh for an electric vehicle), cost of the
  month, next reminder, reminders past due and urgent.
- **Dashboard widget** "Upcoming maintenance": the reminders, the most urgent
  first, for every vehicle or one.
- **Scene triggers**: "Maintenance reminder becomes urgent" (then very urgent)
  and "Maintenance reminder past due", filterable by vehicle, once per level
  and due date or odometer, remembered across restarts.
- **Scene actions**: "Add an odometer reading to LubeLogger" (a number or a
  scene variable, for instance the odometer of your car maker's integration)
  and "Read a vehicle in LubeLogger" (for a message or a condition).
- Texts in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.1 or later.
- LubeLogger 1.5.9 or later, reachable from Gladys (port 8080 by default, or
  behind a reverse proxy). With authentication on in LubeLogger: an API key
  (View, plus Edit for the odometer action) or a user name and password.

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-lubelogger` (or find **LubeLogger** in
   the catalog).
2. In **Configuration**, enter the address of LubeLogger (`192.168.1.50`, port
   8080 by default), an API key or a user if authentication is on, and the
   distance unit of your records. Save.
3. Add the vehicles from the **Discover** tab.

The user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)); Gladys
links it from the Configuration screen.

## How it works

LubeLogger pushes nothing: the container reads it every 15 minutes by default
(5 to 60), with seven requests — the vehicles with their reminder counts, the
reminders, the fuel records, and the service, repair, upgrade and tax records
of the month. The urgency of a reminder is LubeLogger's own. The devices are
published with `should_poll: false`; only changed states are sent to Gladys.

## Limitations

- The only write is the odometer reading of the scene action; nothing is ever
  deleted.
- Gladys has no "L/100 km" nor "mpg" unit: the full unit is in the feature
  name.
- The triggers fire at the first read after the change; the first read after
  the installation announces nothing already pending.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake LubeLogger answering
with bodies recorded on a real LubeLogger 1.7.4 (`test/fixtures/lubelogger/`).

## Credits

- [LubeLogger](https://github.com/hargata/lubelog) by Hargata Softworks (MIT):
  this integration only talks to its REST API and contains none of its code.
- The cover uses the LubeLogger logo from the LubeLogger repository
  (`wwwroot/defaults/lubelogger_launch.png`, MIT License).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by LubeLogger or
Hargata Softworks.

## License

Apache-2.0, see [`LICENSE`](LICENSE).
