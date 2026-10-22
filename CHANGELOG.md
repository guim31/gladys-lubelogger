# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-10-22

### Added

- One device per LubeLogger vehicle: odometer (or engine hours), average
  consumption (L/100 km, mpg, kWh/100 km or mi/kWh), cost of the month, next
  reminder, reminders past due and urgent.
- The "Upcoming maintenance" dashboard widget: reminders, the most urgent
  first, for every vehicle or one.
- Scene triggers "Maintenance reminder becomes urgent" and "Maintenance
  reminder past due", filterable by vehicle, announced once per level and due
  date or odometer, remembered across restarts.
- Scene actions "Add an odometer reading to LubeLogger" (a number or a scene
  variable) and "Read a vehicle in LubeLogger".
- No authentication, API key or user and password; LubeLogger 1.5.9 or later.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-lubelogger/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-lubelogger/releases/tag/v1.0.0
