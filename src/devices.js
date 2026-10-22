// -----------------------------------------------------------------------------
// LubeLogger vehicles -> Gladys devices, and their states.
//
// One device per vehicle (`vehicle:<LubeLogger vehicle id>`, the id of the
// vehicle in that LubeLogger instance): odometer, average consumption, cost of
// the month, next reminder (text), reminders past due and urgent (counts).
//
// - the odometer is in the distance unit of the configuration (LubeLogger
//   stores plain numbers); a vehicle counted in hours (`useHours`: boats,
//   tractors) gets engine hours instead, and no consumption;
// - Gladys has no "litres per 100 km" nor "mpg" unit: the fuel consumption is
//   a volume-sensor (litres per 100 km, the unit in the name) or a bare
//   number (mpg, the unit in the name); an electric vehicle uses the EV
//   consumption couple, kWh/100 km or mi/kWh;
// - the cost carries the Gladys currency unit of the LubeLogger locale when
//   there is one, the symbol in the name otherwise.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CAT,
  DEVICE_FEATURE_TYPES as TYPE,
  DEVICE_FEATURE_UNITS as UNIT,
} from '@gladysassistant/integration-sdk';
import { currencyUnit } from './lubelogger/model.js';
import { NAMES, NONE, dueText } from './texts.js';

export const VEHICLE_TYPE = 'vehicle';

const MAX_ODOMETER = 10_000_000;
const MAX_COUNT = 1_000;
const MAX_COST = 1_000_000;

export const vehicleIds = (gladys, id) => gladys.externalIds(VEHICLE_TYPE, String(id));

const readOnly = (ids, key, name, fields) => ({
  name,
  external_id: ids.feature(key),
  read_only: true,
  has_feedback: false,
  keep_history: true,
  ...fields,
});

const count = { category: CAT.COUNTER_SENSOR, type: TYPE.SENSOR.INTEGER, min: 0, max: MAX_COUNT };
const text = { category: CAT.TEXT, type: TYPE.TEXT.TEXT, min: 0, max: 0, keep_history: false };

/** The unit of the odometer of a vehicle: `km`, `mi` or `hours`. */
export const odometerUnit = (vehicle, distanceUnit) => (vehicle.hours ? 'hours' : distanceUnit);

function odometerFeature(ids, vehicle, names, distanceUnit) {
  if (vehicle.hours) {
    return readOnly(ids, 'odometer', names.hours, {
      category: CAT.DURATION,
      type: TYPE.DURATION.DECIMAL,
      unit: UNIT.HOURS,
      min: 0,
      max: MAX_ODOMETER,
    });
  }
  return readOnly(ids, 'odometer', names.odometer, {
    category: CAT.DISTANCE_SENSOR,
    type: TYPE.SENSOR.DECIMAL,
    unit: distanceUnit === 'mi' ? UNIT.MILE : UNIT.KM,
    min: 0,
    max: MAX_ODOMETER,
  });
}

function consumptionFeature(ids, vehicle, names, distanceUnit) {
  const base = { min: 0, max: 1_000 };
  if (vehicle.electric) {
    return readOnly(ids, 'consumption', names.consumption, {
      ...base,
      category: CAT.ELECTRICAL_VEHICLE_CONSUMPTION,
      ...(distanceUnit === 'mi'
        ? {
            type: TYPE.ELECTRICAL_VEHICLE_CONSUMPTION.ENERGY_EFFICIENCY,
            unit: UNIT.MILE_PER_KILOWATT_HOUR,
          }
        : {
            type: TYPE.ELECTRICAL_VEHICLE_CONSUMPTION.ENERGY_CONSUMPTION,
            unit: UNIT.KILOWATT_HOUR_PER_100_KM,
          }),
    });
  }
  return distanceUnit === 'mi'
    ? readOnly(ids, 'consumption', `${names.consumption} (mpg)`, {
        ...base,
        category: CAT.VOLUME_SENSOR,
        type: TYPE.SENSOR.DECIMAL,
      })
    : readOnly(ids, 'consumption', `${names.consumption} (L/100 km)`, {
        ...base,
        category: CAT.VOLUME_SENSOR,
        type: TYPE.SENSOR.DECIMAL,
        unit: UNIT.LITER,
      });
}

/**
 * @param {object} gladys
 * @param {object} vehicle a vehicle of summarize()
 * @param {{ language: string, distanceUnit: string, currency: string | null, url: string }} context
 */
export function buildVehicleDevice(gladys, vehicle, { language, distanceUnit, currency, url }) {
  const names = NAMES[language] ?? NAMES.en;
  const ids = vehicleIds(gladys, vehicle.id);
  const unit = currencyUnit(currency);
  return {
    name: vehicle.name.slice(0, 60),
    external_id: ids.device,
    model: (vehicle.model || 'LubeLogger').slice(0, 60),
    should_poll: false,
    features: [
      odometerFeature(ids, vehicle, names, distanceUnit),
      ...(vehicle.hours ? [] : [consumptionFeature(ids, vehicle, names, distanceUnit)]),
      readOnly(
        ids,
        'month_cost',
        unit || !currency ? names.month_cost : `${names.month_cost} (${currency})`,
        {
          category: CAT.CURRENCY,
          type: TYPE.CURRENCY.DECIMAL,
          ...(unit ? { unit } : {}),
          min: 0,
          max: MAX_COST,
        },
      ),
      readOnly(ids, 'next_reminder', names.next_reminder, text),
      readOnly(ids, 'past_due', names.past_due, count),
      readOnly(ids, 'urgent', names.urgent, count),
    ],
    params: [
      { name: 'LUBELOGGER_URL', value: url },
      { name: 'LUBELOGGER_VEHICLE_ID', value: String(vehicle.id) },
    ],
  };
}

/** "Contrôle technique · 15/11/2026", or "None". */
export function nextReminderText(vehicle, distanceUnit, language) {
  const next = vehicle.reminders[0];
  if (!next) {
    return NONE[language] ?? NONE.en;
  }
  const due = dueText(next, odometerUnit(vehicle, distanceUnit), language);
  return `${next.description} · ${due}`.slice(0, 200);
}

/** The states of a vehicle; a value LubeLogger cannot give yet is left out. */
export function buildVehicleStates(gladys, vehicle, { language, distanceUnit }) {
  const ids = vehicleIds(gladys, vehicle.id);
  const state = (key, value) => ({ device_feature_external_id: ids.feature(key), state: value });
  const states = [];
  if (vehicle.odometer !== null && vehicle.odometer > 0) {
    states.push(state('odometer', vehicle.odometer));
  }
  if (!vehicle.hours && vehicle.consumption !== null) {
    // LubeLogger gives fuel per 100 distance units; mpg and mi/kWh are the inverse.
    const value =
      distanceUnit === 'mi' ? Math.round(10_000 / vehicle.consumption) / 100 : vehicle.consumption;
    states.push(state('consumption', value));
  }
  states.push(
    state('month_cost', vehicle.monthCost),
    {
      device_feature_external_id: ids.feature('next_reminder'),
      text: nextReminderText(vehicle, distanceUnit, language),
    },
    state('past_due', vehicle.pastDue),
    state('urgent', vehicle.urgent + vehicle.veryUrgent),
  );
  return states;
}

/** `ext:...:vehicle:12` -> 12, or null when not ours. */
export function parseVehicleId(gladys, externalId) {
  if (typeof externalId !== 'string') {
    return null;
  }
  const prefix = gladys.externalId(`${VEHICLE_TYPE}:`);
  if (!externalId.startsWith(prefix)) {
    return null;
  }
  const id = Number(externalId.slice(prefix.length).split(':')[0]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
