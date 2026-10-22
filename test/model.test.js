// The LubeLogger answers -> vehicle summaries, on the real 1.7.4 fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  averageConsumption,
  currencyUnit,
  daysBetween,
  localDay,
  monthStart,
  parseReminder,
  summarize,
  vehicleName,
} from '../src/lubelogger/model.js';
import { normalizeConfig, normalizeUrl } from '../src/config.js';
import { NOW, json } from './helpers/fakeLubeLogger.js';

const TODAY = '2026-10-22';
const data = (reminders = 'reminders.json') => ({
  vehicles: json('vehicle-info.json'),
  reminders: json(reminders),
  gas: json('gasrecords.json'),
  costs: {
    servicerecords: json('servicerecords.json'),
    repairrecords: json('repairrecords.json'),
    upgraderecords: json('upgraderecords.json'),
    taxrecords: json('taxrecords.json'),
  },
});

test('one summary per vehicle: odometer, consumption, cost of the month, reminders', () => {
  const { vehicles, reminders } = summarize(data(), { today: TODAY });
  assert.equal(reminders.length, 6);
  const [clio, tesla] = vehicles;
  assert.equal(clio.name, 'Renault Clio (AA-000-AA)');
  assert.equal(clio.model, '2018 Renault Clio');
  assert.equal(clio.odometer, 43450);
  // 69.5 L over 1150 km on the two computable fill-ups.
  assert.equal(clio.consumption, 6.04);
  // October: fuel 66.1 + 59.4, brake pads 180, insurance 420.5 (the
  // windscreen repair of September is out).
  assert.equal(clio.monthCost, 726);
  assert.deepEqual([clio.pastDue, clio.veryUrgent, clio.urgent], [0, 1, 1]);
  assert.deepEqual(
    clio.reminders.map((r) => r.description),
    // Same urgency: a date before a distance alone (they cannot be compared).
    ['Insurance renewal', 'Contrôle technique', 'Tyres', 'Oil change'],
  );
  assert.equal(tesla.electric, true);
  assert.equal(tesla.consumption, 15, 'kWh per 100 km');
  assert.equal(tesla.monthCost, 73.4);
  assert.deepEqual([tesla.pastDue, tesla.veryUrgent, tesla.urgent], [1, 1, 0]);
});

test('a reminder: its metric decides what is due, the empty date is no date', () => {
  const [oil, inspection, , tyres] = json('reminders.json').map((r) => parseReminder(r, TODAY));
  assert.deepEqual(
    [oil.dueDate, oil.dueOdometer, oil.distanceLeft, oil.urgency],
    [null, 45000, 1550, 'not_urgent'],
  );
  assert.deepEqual(
    [inspection.dueDate, inspection.dueOdometer, inspection.daysLeft, inspection.urgency],
    ['2026-11-15', null, 24, 'urgent'],
  );
  assert.deepEqual([tyres.dueDate, tyres.dueOdometer], ['2027-04-01', 50000]);
  assert.equal(oil.occurrence, '1|1||45000');
  assert.equal(parseReminder({ id: 1, vehicleId: 1, urgency: 'Whatever' }, TODAY), null);
});

test('the progression recorded on LubeLogger: urgent at 80 km left, past due at -10', () => {
  const oil = (file) => summarize(data(file), { today: TODAY }).reminders.find((r) => r.id === 1);
  assert.equal(oil('reminders.json').urgency, 'not_urgent');
  assert.equal(oil('reminders-urgent.json').urgency, 'urgent');
  assert.equal(oil('reminders-urgent.json').distanceLeft, 80);
  assert.equal(oil('reminders-pastdue.json').urgency, 'past_due');
  assert.equal(oil('reminders-pastdue.json').distanceLeft, -10);
});

test('a sold vehicle stays out of Gladys, with its reminders', () => {
  const raw = data();
  raw.vehicles[1].vehicleData.soldDate = '2026-06-01';
  const { vehicles, reminders } = summarize(raw, { today: TODAY });
  assert.deepEqual(
    vehicles.map((v) => v.id),
    [1],
  );
  assert.ok(reminders.every((r) => r.vehicleId === 1));
});

test('average consumption: only the fill-ups LubeLogger could compute', () => {
  assert.equal(averageConsumption([]), null);
  assert.equal(averageConsumption([{ fuelConsumed: 40, fuelEconomy: 0 }]), null);
  assert.equal(
    averageConsumption([
      { fuelConsumed: 30, fuelEconomy: 6 },
      { fuelConsumed: 40, fuelEconomy: 8 },
    ]),
    7,
  );
});

test('days, months, names and currencies', () => {
  assert.equal(localDay(NOW), TODAY);
  assert.equal(monthStart(TODAY), '2026-10-01');
  assert.equal(daysBetween(TODAY, '2026-10-26'), 4);
  assert.equal(daysBetween(TODAY, '2026-10-01'), -21);
  assert.equal(vehicleName({ id: 3, make: '', model: '', licensePlate: '' }), '#3');
  assert.equal(vehicleName({ id: 3, make: 'Vespa', model: 'GTS' }), 'Vespa GTS');
  assert.equal(currencyUnit('€'), 'euro');
  assert.equal(currencyUnit('$'), 'dollar');
  assert.equal(currencyUnit('£'), 'pound-sterling');
  assert.equal(currencyUnit('CHF'), null);
});

test('the address: default port, reverse proxy, a pasted /api, credentials refused', () => {
  assert.equal(normalizeUrl('192.0.2.10'), 'http://192.0.2.10:8080');
  assert.equal(
    normalizeUrl('https://example.org/lubelogger/api/'),
    'https://example.org/lubelogger',
  );
  assert.equal(normalizeUrl('http://user:pass@192.0.2.10'), null);
  assert.equal(normalizeUrl('ftp://192.0.2.10'), null);
  const config = normalizeConfig({ url: 'not a url', distance_unit: 'parsec', refresh_minutes: 7 });
  assert.deepEqual(
    [config.urlInvalid, config.distanceUnit, config.refreshMinutes, config.language],
    [true, 'km', 15, 'fr'],
  );
});
