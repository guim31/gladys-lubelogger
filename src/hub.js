// -----------------------------------------------------------------------------
// The hub: the link to one LubeLogger and everything Gladys sees of it —
// devices, states, connection status, scene events, the scene actions.
//
// LubeLogger pushes nothing: it is read every `refresh_minutes` (15 by
// default) by a timer of the container (should_poll: false, the interval
// being beyond the core's 60 s list). A read is seven requests: the vehicles
// with their reminder counts, the reminders, the fuel records, and the
// service, repair, upgrade and tax records of the month (for the costs).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  buildVehicleDevice,
  buildVehicleStates,
  nextReminderText,
  odometerUnit,
  parseVehicleId,
  vehicleIds,
} from './devices.js';
import { LubeLoggerClient, LubeLoggerError } from './lubelogger/client.js';
import { COST_RECORDS, localDay, monthStart, summarize } from './lubelogger/model.js';
import { MemoryStore } from './store.js';
import { STATUS_TEXT, TEST_TEXT, URGENCY_TEXT, commandMessage, dueText } from './texts.js';

const logger = createLogger({ name: 'lubelogger-hub' });

export const WIDGET_KEY = 'upcoming';
export const TRIGGERS = { urgent: 'reminder_urgent', pastDue: 'reminder_past_due' };

export const DEFAULT_TIMINGS = {
  // requestWidgetRefresh is dropped by the core beyond one call per 10 s.
  widgetGap: 10_500,
  // An unchanged value is sent again before Gladys calls it stale (48 h).
  heartbeat: 6 * 3_600_000,
  requestTimeout: 15_000,
};

// An import of a whole garage can bring dozens of reminders at once: past
// that many events in one read, the rest is recorded as announced silently.
export const MAX_EVENTS_PER_READ = 10;

// The urgency levels a trigger announces, each once per reminder occurrence.
// Reaching a level implies the levels before it (a reminder found past due
// right away is not announced as urgent afterwards).
const LEVELS = ['urgent', 'very_urgent', 'past_due'];

/** An Error carrying a coded, multi-language message. */
export class CommandError extends Error {
  constructor(code, language) {
    const messages = commandMessage(code);
    super(messages[language] ?? messages.en);
    this.code = code;
    this.messages = messages;
  }
}

const linkOf = (config) =>
  JSON.stringify([config.url, config.apiKey, config.username, config.password]);

/** "45 123,5" or "45.123" or "45123" -> 45123.5 / 45123 / 45123; null otherwise. */
export function parseReading(raw) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? raw : null;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  let text = raw.replace(/[\s\u00a0\u202f]/g, '').replace(/(km|mi|h)$/i, '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(text)) {
    // Thousands separators only ("45.123", "45,123"): an odometer is never
    // read to the thousandth.
    text = text.replace(/[.,]/g, '');
  }
  text = text.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  return Number(text);
}

export class Hub {
  constructor({ gladys, fetch, timings, now = Date.now, store }) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.now = now;
    this.store = store ?? new MemoryStore();
    this.config = {
      url: null,
      urlInvalid: false,
      distanceUnit: 'km',
      refreshMinutes: 15,
      language: 'fr',
    };
    this.client = null;
    this.version = null;
    this.currency = null;
    /** the last raw read: { vehicles, reminders, gas, costs } */
    this.data = null;
    this.summary = null;
    /** null (fine), or the kind of the last failure */
    this.failure = null;
    this.announced = false;
    this.lastStatus = '';
    /** what the triggers already announced: { server, marks: [] } */
    this.notified = null;
    this.configuring = Promise.resolve();
    this.refreshTimer = null;
    this.refreshing = null;
    this.refreshAgain = false;
    this.widgetRefreshAt = 0;
    this.widgetTimer = null;
    this.publishFailing = false;
    this.stopped = false;
  }

  get language() {
    return this.config.language;
  }

  get loaded() {
    return this.summary !== null;
  }

  async start(config) {
    const saved = await this.store.load();
    // A damaged file is a new baseline, not a crash on every read.
    this.notified = typeof saved.server === 'string' && Array.isArray(saved.marks) ? saved : null;
    await this.reconfigure(config);
  }

  /** One configuration change at a time: a second one waits for the first. */
  reconfigure(config) {
    const run = this.configuring.then(() => this.#reconfigure(config));
    this.configuring = run.catch(() => {});
    return run;
  }

  async #reconfigure(config) {
    const previous = this.config;
    this.config = config;
    const linkChanged = linkOf(previous) !== linkOf(config) || !this.client;
    if (linkChanged || previous.refreshMinutes !== config.refreshMinutes) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (linkChanged) {
      this.client = null;
      this.version = null;
      this.currency = null;
      this.data = null;
      this.summary = null;
      this.failure = null;
      this.announced = false;
      if (config.url) {
        this.client = new LubeLoggerClient({
          url: config.url,
          apiKey: config.apiKey,
          username: config.username,
          password: config.password,
          fetch: this.fetch,
          timeout: this.timings.requestTimeout,
        });
      }
    }
    if (this.client && !this.refreshTimer) {
      this.refreshTimer = setInterval(
        () => this.refresh().catch((err) => logger.error('Read failed', err)),
        config.refreshMinutes * 60_000,
      );
      this.refreshTimer.unref?.();
    }
    if (linkChanged) {
      await this.refresh();
    } else {
      // Language or unit only: same data, new texts and values.
      this.gladys.forgetPublishedStates?.();
      await this.#update();
    }
    await this.updateConnectionStatus();
  }

  /** Gladys reconnected (it may have restarted): send everything again. */
  async resync(config) {
    this.gladys.forgetPublishedStates?.();
    this.lastStatus = '';
    await this.reconfigure(config);
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.refreshTimer);
    clearTimeout(this.widgetTimer);
    this.refreshTimer = null;
    await this.store.flush();
  }

  // --- Reading LubeLogger ---------------------------------------------------

  /** Read LubeLogger (one read at a time; a request during it runs once after). */
  refresh() {
    if (this.refreshing) {
      this.refreshAgain = true;
      return this.refreshing;
    }
    this.refreshing = (async () => {
      do {
        this.refreshAgain = false;
        try {
          await this.#refreshOnce();
        } catch (err) {
          // Never ends the loop: a read queued meanwhile (new address) still runs.
          logger.error('Read failed', err);
        }
      } while (this.refreshAgain && !this.stopped);
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  async #refreshOnce() {
    const client = this.client;
    if (this.stopped) {
      return;
    }
    if (!client) {
      await this.publishDevices();
      return;
    }
    let data;
    try {
      if (!this.version) {
        this.version = (await client.version()) ?? '?';
        // The locale of the server (1.6.5+), for the currency of the costs.
        const symbol = (await client.info())?.currencySymbol;
        this.currency = typeof symbol === 'string' && !['', '¤'].includes(symbol) ? symbol : null;
      }
      const since = monthStart(localDay(this.now()));
      const [vehicles, reminders, gas, ...costs] = await Promise.all([
        client.vehicleInfo(),
        client.reminders(),
        client.gasRecords(),
        ...COST_RECORDS.map((kind) => client.records(kind, since)),
      ]);
      data = {
        vehicles,
        reminders,
        gas,
        costs: Object.fromEntries(COST_RECORDS.map((kind, i) => [kind, costs[i]])),
      };
    } catch (err) {
      if (client !== this.client) {
        return;
      }
      this.#fail(err);
      await this.updateConnectionStatus();
      return;
    }
    if (client !== this.client || this.stopped) {
      return;
    }
    this.data = data;
    await this.#update();
    this.#recover();
    if (client !== this.client || !this.summary) {
      // Reconfigured meanwhile: the read of the new link takes over.
      return;
    }
    await this.#announce(this.summary);
    await this.updateConnectionStatus();
  }

  /** Summary, devices, states and widget from the last read. */
  async #update() {
    if (this.data) {
      this.summary = summarize(this.data, { today: localDay(this.now()) });
    }
    await this.publishDevices();
    await this.publishStates();
    this.refreshWidget();
  }

  #fail(err) {
    const kind = err instanceof LubeLoggerError ? err.kind : 'unreachable';
    if (this.failure === null) {
      logger.warn(`LubeLogger: ${err.message}`);
    } else {
      logger.debug(`LubeLogger still failing: ${err.message}`);
    }
    this.failure = kind;
    // Read the version again once it answers: it may have been upgraded.
    this.version = null;
  }

  #recover() {
    const count = this.summary.vehicles.length;
    if (this.failure !== null) {
      logger.info(`LubeLogger answers again (${count} vehicles)`);
    } else if (!this.announced) {
      logger.info(`Connected to LubeLogger ${this.version} (${count} vehicles)`);
    }
    this.announced = true;
    this.failure = null;
  }

  // --- Scene events ---------------------------------------------------------

  /**
   * Fire the reminders that became urgent, very urgent or past due since the
   * last read. The first read of a LubeLogger is a silent baseline:
   * installing the integration announces nothing already pending.
   */
  async #announce(summary) {
    const server = this.config.url;
    const known = this.notified?.server === server ? new Set(this.notified.marks) : null;
    const marks = new Map();
    const events = [];
    for (const reminder of summary.reminders) {
      const reached = LEVELS.slice(0, LEVELS.indexOf(reminder.urgency) + 1);
      const keys = reached.map((level) => `${reminder.occurrence}|${level}`);
      for (const key of keys) {
        marks.set(key, reminder);
      }
      const fresh = keys.filter((key) => !known?.has(key));
      if (known && fresh.length > 0) {
        events.push([...this.#reminderEvent(reminder), fresh]);
      }
    }
    if (events.length > MAX_EVENTS_PER_READ) {
      logger.info(`${events.length} reminders changed at once: ${MAX_EVENTS_PER_READ} announced`);
    }
    // An event Gladys did not take (disconnected, restarting) is not
    // recorded: the next read fires it again.
    const failed = new Set();
    for (const [trigger, data, fresh] of events.slice(0, MAX_EVENTS_PER_READ)) {
      try {
        await this.gladys.publishSceneEvent(trigger, data);
      } catch (err) {
        fresh.forEach((key) => failed.add(key));
        logger.warn(`Cannot fire ${trigger}: ${err.message}`);
      }
    }
    const next = {
      server,
      marks: [...marks.keys()].filter((key) => !failed.has(key)).sort(),
    };
    if (JSON.stringify(next) !== JSON.stringify(this.notified)) {
      this.notified = next;
      await this.store.save(next);
    }
  }

  #reminderEvent(reminder) {
    const vehicle = this.summary.vehicles.find((v) => v.id === reminder.vehicleId);
    const unit = odometerUnit(vehicle, this.config.distanceUnit);
    const common = {
      vehicle: vehicleIds(this.gladys, vehicle.id).device,
      vehicle_name: vehicle.name,
      reminder: reminder.description,
      due: dueText(reminder, unit, this.language),
    };
    logger.debug(`Reminder ${reminder.occurrence} is ${reminder.urgency}`);
    if (reminder.urgency === 'past_due') {
      return [TRIGGERS.pastDue, common];
    }
    const urgency = (URGENCY_TEXT[this.language] ?? URGENCY_TEXT.en)[reminder.urgency];
    return [TRIGGERS.urgent, { ...common, urgency }];
  }

  // --- Devices and states -------------------------------------------------

  #isCreated(externalId) {
    return (this.gladys.devices ?? []).some((device) => device.external_id === externalId);
  }

  #context() {
    return {
      language: this.language,
      distanceUnit: this.config.distanceUnit,
      currency: this.currency,
      url: this.config.url ?? '',
    };
  }

  buildDevices() {
    if (!this.summary) {
      return [];
    }
    return this.summary.vehicles.map((vehicle) =>
      buildVehicleDevice(this.gladys, vehicle, this.#context()),
    );
  }

  async publishDevices() {
    if (this.stopped) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(this.buildDevices());
    } catch (err) {
      logger.error('Cannot publish the devices', err);
    }
  }

  /**
   * The states of the devices the user added (Gladys drops the others).
   * @param {string} [only] one device external id
   */
  async publishStates(only) {
    if (!this.summary || this.stopped) {
      return;
    }
    const states = [];
    for (const vehicle of this.summary.vehicles) {
      const id = vehicleIds(this.gladys, vehicle.id).device;
      if (only ? id === only : this.#isCreated(id)) {
        states.push(...buildVehicleStates(this.gladys, vehicle, this.#context()));
      }
    }
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeat });
    } catch (err) {
      if (this.publishFailing) {
        logger.debug(`Cannot publish the states: ${err.message}`);
      } else {
        logger.warn(`Cannot publish the states: ${err.message}`);
      }
      this.publishFailing = true;
      return;
    }
    if (this.publishFailing) {
      logger.info('States published again');
    }
    this.publishFailing = false;
  }

  /** The user added a device: states sent before were dropped by Gladys. */
  async onDeviceCreated(device) {
    if (parseVehicleId(this.gladys, device?.external_id) === null) {
      return;
    }
    this.gladys.forgetPublishedStates?.(device.external_id);
    await this.publishStates(device.external_id);
    this.refreshWidget();
  }

  /** onPoll (the devices are not polled: the container reads on its timer). */
  async poll(device) {
    if (parseVehicleId(this.gladys, device?.external_id) !== null) {
      await this.publishStates(device.external_id);
    }
  }

  // --- Widget ---------------------------------------------------------------

  /** Nudge the open dashboards, with a trailing call inside the core's 10 s gap. */
  refreshWidget() {
    if (this.stopped) {
      return;
    }
    const wait = this.widgetRefreshAt + this.timings.widgetGap - this.now();
    if (wait <= 0) {
      this.widgetRefreshAt = this.now();
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
      return;
    }
    if (!this.widgetTimer) {
      this.widgetTimer = setTimeout(() => {
        this.widgetTimer = null;
        this.refreshWidget();
      }, wait);
      this.widgetTimer.unref?.();
    }
  }

  // --- Connection status ----------------------------------------------------

  statusKey() {
    if (this.config.urlInvalid) {
      return 'invalid';
    }
    if (!this.config.url) {
      return 'none';
    }
    if (this.failure) {
      return (
        {
          unauthorized: 'unauthorized',
          forbidden: 'unauthorized',
          invalid: 'invalid_answer',
          not_found: 'invalid_answer',
        }[this.failure] ?? 'unreachable'
      );
    }
    return null;
  }

  statusMessage() {
    const key = this.statusKey();
    if (!key) {
      return null;
    }
    return Object.fromEntries(
      Object.entries(STATUS_TEXT).map(([language, table]) => [language, table[key]]),
    );
  }

  async updateConnectionStatus() {
    if (this.stopped) {
      return;
    }
    // Nothing to say before the first answer or failure.
    if (this.client && !this.loaded && this.failure === null) {
      return;
    }
    const message = this.statusMessage();
    const connected = Boolean(this.client) && this.loaded && this.failure === null;
    const fingerprint = JSON.stringify({ connected, message });
    if (fingerprint === this.lastStatus) {
      return;
    }
    this.lastStatus = fingerprint;
    try {
      await this.gladys.setConnectionStatus(connected, message ?? undefined);
    } catch (err) {
      logger.warn(`Cannot set the connection status: ${err.message}`);
    }
  }

  // --- Actions ----------------------------------------------------------------

  /** "Test the connection": a fresh read, then its outcome. */
  async testReport() {
    if (!this.client) {
      return this.statusMessage();
    }
    await this.refresh();
    const message = this.statusMessage();
    if (message) {
      return message;
    }
    const { vehicles, reminders } = this.summary;
    return Object.fromEntries(
      Object.entries(TEST_TEXT).map(([language, render]) => [
        language,
        render(this.version, vehicles.length, reminders.length),
      ]),
    );
  }

  /** A fresh read, then the vehicle of a scene field (its external id). */
  async #freshVehicle(externalId) {
    const id = parseVehicleId(this.gladys, externalId);
    if (id === null) {
      throw new CommandError('vehicle', this.language);
    }
    if (this.client) {
      await this.refresh();
    }
    if (!this.client || this.failure !== null || !this.summary) {
      throw new CommandError('unreachable', this.language);
    }
    const vehicle = this.summary.vehicles.find((v) => v.id === id);
    if (!vehicle) {
      // LubeLogger adds a reading to any id, even a deleted vehicle's.
      throw new CommandError('vehicle', this.language);
    }
    return vehicle;
  }

  /**
   * Scene action: add an odometer reading (from the car's own integration, for
   * instance). A reading equal to the last one adds nothing; a lower one is
   * refused (a typo, or the trip meter of the car instead of its odometer).
   */
  async addOdometer({ vehicle: externalId, odometer: raw } = {}) {
    const reading = parseReading(raw);
    if (reading === null) {
      throw new CommandError('odometer', this.language);
    }
    const vehicle = await this.#freshVehicle(externalId);
    // LubeLogger stores whole numbers.
    const odometer = Math.round(reading);
    const last = vehicle.odometer ?? 0;
    if (odometer < last) {
      throw new CommandError('lower', this.language);
    }
    if (odometer === last) {
      logger.debug(`Odometer of vehicle ${vehicle.id} unchanged`);
      return { added: false, odometer };
    }
    try {
      await this.client.addOdometer(vehicle.id, { date: localDay(this.now()), odometer });
    } catch (err) {
      logger.warn(`Cannot add the odometer reading: ${err.message}`);
      const kind = err instanceof LubeLoggerError ? err.kind : 'unreachable';
      throw new CommandError(
        { forbidden: 'forbidden', unauthorized: 'forbidden', refused: 'refused' }[kind] ??
          'unreachable',
        this.language,
      );
    }
    logger.info(`Odometer reading added to vehicle ${vehicle.id}`);
    // The reminders by odometer move with it: read again, fire what changed.
    await this.refresh();
    return { added: true, odometer };
  }

  /** Scene action: the state of a vehicle, for a message or a condition. */
  async vehicleStatus({ vehicle: externalId } = {}) {
    const vehicle = await this.#freshVehicle(externalId);
    const unit = this.config.distanceUnit;
    const next = vehicle.reminders[0];
    const [consumption] = vehicle.hours
      ? []
      : buildVehicleStates(this.gladys, vehicle, this.#context())
          .filter((s) => s.device_feature_external_id.endsWith(':consumption'))
          .map((s) => s.state);
    return {
      vehicle_name: vehicle.name,
      odometer: vehicle.odometer ?? 0,
      consumption: consumption ?? 0,
      month_cost: vehicle.monthCost,
      next_reminder: nextReminderText(vehicle, unit, this.language),
      next_urgency: next ? (URGENCY_TEXT[this.language] ?? URGENCY_TEXT.en)[next.urgency] : '',
      past_due: vehicle.pastDue,
      urgent: vehicle.urgent + vehicle.veryUrgent,
    };
  }
}
