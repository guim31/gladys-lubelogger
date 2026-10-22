// -----------------------------------------------------------------------------
// The raw answers of LubeLogger -> one summary per vehicle: odometer, average
// consumption, cost of the month, reminders sorted by urgency.
//
// The urgency of a reminder is LubeLogger's own (its thresholds are set in its
// settings: 30 and 7 days, 100 and 50 distance units by default): the
// integration never recomputes it, so Gladys and LubeLogger always agree.
// -----------------------------------------------------------------------------

// LubeLogger names -> stable keys, most urgent first.
export const URGENCIES = {
  PastDue: 'past_due',
  VeryUrgent: 'very_urgent',
  Urgent: 'urgent',
  NotUrgent: 'not_urgent',
};
const RANK = { past_due: 0, very_urgent: 1, urgent: 2, not_urgent: 3 };

// The record lists whose costs make "the cost of the month", fuel apart.
export const COST_RECORDS = ['servicerecords', 'repairrecords', 'upgraderecords', 'taxrecords'];

const number = (value) => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
};
const words = (value) => (typeof value === 'string' ? value.trim() : '');
// A day `YYYY-MM-DD`, or null for LubeLogger's empty date `0001-01-01`.
const day = (value) => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(words(value));
  return match && match[1] !== '0001-01-01' ? match[1] : null;
};
const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

/** The local day of a timestamp, `YYYY-MM-DD` (Gladys gives the container its TZ). */
export function localDay(now) {
  const date = new Date(now);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Days from `today` to `target` (both `YYYY-MM-DD`), negative once past. */
export function daysBetween(today, target) {
  const utc = (text) => Date.UTC(...text.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)));
  return Math.round((utc(target) - utc(today)) / 86_400_000);
}

/** "Renault Clio (AA-000-AA)": what the user recognizes in LubeLogger. */
export function vehicleName(vehicle) {
  const base = [words(vehicle.make), words(vehicle.model)].filter(Boolean).join(' ');
  const plate = words(vehicle.licensePlate);
  const name = base || plate || `#${vehicle.id}`;
  return plate && base ? `${name} (${plate})` : name;
}

/** One reminder of `/vehicle/reminders/all`, or null when unusable. */
export function parseReminder(raw, today) {
  const vehicleId = number(raw?.vehicleId);
  const id = number(raw?.id);
  const urgency = URGENCIES[raw?.urgency];
  if (vehicleId === null || id === null || !urgency) {
    return null;
  }
  const metric = ['Date', 'Odometer', 'Both'].includes(raw.userMetric)
    ? raw.userMetric
    : ['Date', 'Odometer', 'Both'].includes(raw.metric)
      ? raw.metric
      : 'Both';
  const dueDate = metric === 'Odometer' ? null : day(raw.dueDate);
  const dueOdometer = metric === 'Date' ? null : number(raw.dueOdometer) || null;
  return {
    vehicleId,
    id,
    description: words(raw.description) || `#${id}`,
    urgency,
    dueDate,
    dueOdometer,
    // Days left computed on Gladys' local day (LubeLogger counts in UTC).
    daysLeft: dueDate ? daysBetween(today, dueDate) : null,
    distanceLeft: dueOdometer === null ? null : number(raw.dueDistance),
    // A recurring reminder moves its due date or odometer once done: a new
    // occurrence, announced again by the triggers.
    occurrence: `${vehicleId}|${id}|${dueDate ?? ''}|${dueOdometer ?? ''}`,
  };
}

/** Most urgent first; then the nearest date, then the nearest odometer. */
export function compareReminders(a, b) {
  const far = Number.MAX_SAFE_INTEGER;
  return (
    RANK[a.urgency] - RANK[b.urgency] ||
    (a.daysLeft ?? far) - (b.daysLeft ?? far) ||
    (a.distanceLeft ?? far) - (b.distanceLeft ?? far) ||
    a.description.localeCompare(b.description)
  );
}

/**
 * Average consumption from the fuel (or charging) records, the way LubeLogger
 * averages it: the distance driven over the fuel used, on the fill-ups it
 * could compute (`fuelEconomy` > 0: not the first one, not after a missed
 * fill-up). `fuelEconomy` comes per 100 distance units (the API default), so
 * the distance of a fill-up is `fuel * 100 / fuelEconomy`.
 * @returns {number | null} fuel (or kWh) per 100 distance units
 */
export function averageConsumption(records) {
  let fuel = 0;
  let distance = 0;
  for (const record of records) {
    const used = number(record.fuelConsumed);
    const economy = number(record.fuelEconomy);
    if (used > 0 && economy > 0) {
      fuel += used;
      distance += (used * 100) / economy;
    }
  }
  return distance > 0 ? round((fuel * 100) / distance, 2) : null;
}

const byVehicle = (list, vehicleId) =>
  (Array.isArray(list) ? list : []).filter((record) => number(record?.vehicleId) === vehicleId);

/**
 * @param {object} data `{ vehicles, reminders, gas, costs: { <kind>: [] } }` raw lists
 * @param {{ today: string }} options local day `YYYY-MM-DD`
 */
export function summarize(data, { today }) {
  const month = today.slice(0, 7);
  const reminders = (data.reminders ?? [])
    .map((raw) => parseReminder(raw, today))
    .filter(Boolean)
    .sort(compareReminders);
  const vehicles = [];
  for (const info of data.vehicles ?? []) {
    const vehicle = info?.vehicleData;
    const id = number(vehicle?.id);
    // A sold vehicle stays in LubeLogger for its history, not in Gladys.
    if (id === null || day(vehicle.soldDate)) {
      continue;
    }
    const own = reminders.filter((reminder) => reminder.vehicleId === id);
    const gas = byVehicle(data.gas, id).sort(
      (a, b) =>
        words(a.date).localeCompare(words(b.date)) ||
        (number(a.odometer) ?? 0) - (number(b.odometer) ?? 0),
    );
    const inMonth = (record) => words(record?.date).slice(0, 7) === month;
    const cost = [gas, ...COST_RECORDS.map((kind) => byVehicle(data.costs?.[kind], id))]
      .flat()
      .filter(inMonth)
      .reduce((sum, record) => sum + (number(record.cost) ?? 0), 0);
    const count = (urgency) => own.filter((reminder) => reminder.urgency === urgency).length;
    vehicles.push({
      id,
      name: vehicleName(vehicle),
      model: [number(vehicle.year), words(vehicle.make), words(vehicle.model)]
        .filter(Boolean)
        .join(' '),
      electric: vehicle.isElectric === true,
      hours: vehicle.useHours === true,
      odometer: number(info.lastReportedOdometer),
      consumption: averageConsumption(gas),
      monthCost: round(cost, 2),
      pastDue: count('past_due'),
      veryUrgent: count('very_urgent'),
      urgent: count('urgent'),
      reminders: own,
    });
  }
  return {
    vehicles,
    reminders: reminders.filter((r) => vehicles.some((v) => v.id === r.vehicleId)),
  };
}

/** First day of the local month, `YYYY-MM-01` (the `startDate` of the cost lists). */
export const monthStart = (today) => `${today.slice(0, 7)}-01`;

/** "$" -> dollar...: the Gladys currency units; null when Gladys has none. */
export function currencyUnit(symbol) {
  return (
    {
      '€': 'euro',
      EUR: 'euro',
      $: 'dollar',
      USD: 'dollar',
      '£': 'pound-sterling',
      GBP: 'pound-sterling',
    }[words(symbol)] ?? null
  );
}
