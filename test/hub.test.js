// The integration end to end: the SDK's fake Gladys, the wiring of
// src/app.js and the fake LubeLogger built on real answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { MemoryStore } from '../src/store.js';
import { TRIGGERS, WIDGET_KEY, parseReading } from '../src/hub.js';
import {
  API_KEY,
  HOST,
  PASSWORD,
  USER,
  createLubeLogger,
  settle,
} from './helpers/fakeLubeLogger.js';
import {
  CLIO,
  TESLA,
  createAll,
  createWorld,
  vehicleDevice,
  vehicleFeature,
} from './helpers/world.js';

test('one device per vehicle, its states once added to Gladys', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const devices = world.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((d) => [d.external_id, d.name, d.should_poll]),
    [
      [vehicleDevice(CLIO), 'Renault Clio (AA-000-AA)', false],
      [vehicleDevice(TESLA), 'Tesla Model 3 (BB-111-BB)', false],
    ],
  );
  assert.equal(world.fake.states.length, 0, 'nothing before the devices are added');
  assert.equal(world.fake.connectionStatus.connected, true);

  await createAll(world.fake);
  const last = (id, key) => world.fake.lastState(vehicleFeature(id, key));
  assert.equal(last(CLIO, 'odometer'), 43450);
  assert.equal(last(CLIO, 'consumption'), 6.04);
  assert.equal(last(CLIO, 'month_cost'), 726);
  assert.equal(last(CLIO, 'next_reminder'), 'Insurance renewal · 26/10/2026');
  assert.equal(last(CLIO, 'past_due'), 0);
  assert.equal(last(CLIO, 'urgent'), 2);
  assert.equal(last(TESLA, 'consumption'), 15);
  assert.equal(last(TESLA, 'next_reminder'), 'Cabin filter · 01/10/2026');
  assert.equal(last(TESLA, 'past_due'), 1);
  assert.ok(world.fake.widgetRefreshes.includes(WIDGET_KEY));
});

test('the units: litres and kWh per 100 km, or mpg and mi/kWh; dollars from the locale', async (t) => {
  const world = await createWorld({ config: { url: HOST, distance_unit: 'mi', language: 'en' } });
  t.after(() => world.app.stop());
  const [clio, tesla] = world.fake.discoveredDevices;
  const feature = (device, key) => device.features.find((f) => f.external_id.endsWith(`:${key}`));
  assert.equal(feature(clio, 'odometer').unit, 'mile');
  assert.equal(feature(clio, 'consumption').name, 'Average consumption (mpg)');
  assert.equal(feature(clio, 'consumption').unit, undefined);
  assert.equal(feature(tesla, 'consumption').unit, 'mile-per-kilowatt-hour');
  assert.equal(feature(clio, 'month_cost').unit, 'dollar');
  await createAll(world.fake);
  // 6.04 gallons per 100 miles = 16.56 mpg; 15 kWh per 100 miles = 6.67 mi/kWh.
  assert.equal(world.fake.lastState(vehicleFeature(CLIO, 'consumption')), 16.56);
  assert.equal(world.fake.lastState(vehicleFeature(TESLA, 'consumption')), 6.67);
  assert.equal(
    world.fake.lastState(vehicleFeature(TESLA, 'next_reminder')),
    'Cabin filter · 01/10/2026',
  );

  const metric = await createWorld();
  t.after(() => metric.app.stop());
  const [car] = metric.fake.discoveredDevices;
  assert.equal(feature(car, 'consumption').name, 'Consommation moyenne (L/100 km)');
  assert.equal(feature(car, 'consumption').unit, 'liter');
});

test('a vehicle counted in hours: engine hours, no consumption', async (t) => {
  const server = createLubeLogger();
  server.patchVehicle(CLIO, { useHours: true });
  const world = await createWorld({ server });
  t.after(() => world.app.stop());
  const [clio] = world.fake.discoveredDevices;
  const odometer = clio.features.find((f) => f.external_id.endsWith(':odometer'));
  assert.deepEqual(
    [odometer.name, odometer.category, odometer.unit],
    ['Heures moteur', 'duration', 'hours'],
  );
  assert.ok(!clio.features.some((f) => f.external_id.endsWith(':consumption')));
});

test('triggers: a silent baseline, then urgent, then past due, once each', async (t) => {
  const store = new MemoryStore();
  const world = await createWorld({ store });
  t.after(() => world.app.stop());
  assert.deepEqual(world.fake.sceneEvents, [], 'what is pending at install is not announced');

  await world.hub.refresh();
  assert.deepEqual(world.fake.sceneEvents, [], 'nothing changed');

  world.server.setReminders('urgent');
  await world.hub.refresh();
  await world.hub.refresh();
  assert.deepEqual(world.fake.sceneEvents, [
    {
      key: TRIGGERS.urgent,
      data: {
        vehicle: vehicleDevice(CLIO),
        vehicle_name: 'Renault Clio (AA-000-AA)',
        reminder: 'Oil change',
        due: '45 000 km',
        urgency: 'Urgent',
      },
    },
  ]);

  world.server.setReminders('past_due');
  await world.hub.refresh();
  assert.equal(world.fake.sceneEvents.length, 2);
  assert.deepEqual(world.fake.sceneEvents[1], {
    key: TRIGGERS.pastDue,
    data: {
      vehicle: vehicleDevice(CLIO),
      vehicle_name: 'Renault Clio (AA-000-AA)',
      reminder: 'Oil change',
      due: '45 000 km',
    },
  });

  // A restart remembers what was announced.
  await world.app.stop();
  const again = await createWorld({ store, server: world.server });
  t.after(() => again.app.stop());
  await again.hub.refresh();
  assert.deepEqual(again.fake.sceneEvents, []);
});

test('triggers: a reminder rescheduled is a new occurrence; very urgent is announced too', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const reminders = world.server.state;
  // The oil change done: LubeLogger moves its due odometer 10 000 km later,
  // and the inspection gets very urgent.
  const original = world.server.fetch;
  world.server.fetch = async (url, init) => {
    const response = await original(url, init);
    if (!url.includes('/reminders/all')) {
      return response;
    }
    const list = await response.json();
    list[0] = { ...list[0], dueOdometer: 55000, dueDistance: 50, urgency: 'VeryUrgent' };
    list[1] = { ...list[1], urgency: 'VeryUrgent' };
    return new Response(JSON.stringify(list), { headers: { 'content-type': 'application/json' } });
  };
  assert.ok(reminders);
  world.hub.client.fetch = world.server.fetch;
  await world.hub.refresh();
  const events = world.fake.sceneEvents.map((e) => [e.data.reminder, e.data.urgency, e.data.due]);
  assert.deepEqual(events, [
    ['Contrôle technique', 'Très urgent', '15/11/2026'],
    ['Oil change', 'Très urgent', '55 000 km'],
  ]);
});

test('triggers: an event Gladys did not take is fired at the next read', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const publish = world.gladys.publishSceneEvent.bind(world.gladys);
  let fail = true;
  world.gladys.publishSceneEvent = (...args) => {
    if (fail) {
      return Promise.reject(new Error('disconnected'));
    }
    return publish(...args);
  };
  world.server.setReminders('urgent');
  await world.hub.refresh();
  assert.equal(world.fake.sceneEvents.length, 0);
  fail = false;
  await world.hub.refresh();
  assert.equal(world.fake.sceneEvents.length, 1);
});

test('add an odometer reading: added and read back, equal, lower, unknown vehicle', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world.fake);
  const add = (vehicle, odometer) => world.fake.sceneAction('add_odometer', { vehicle, odometer });

  const done = await add(vehicleDevice(CLIO), '44 920');
  assert.equal(done.success, true, done.error);
  assert.deepEqual(done.data.outputs, { added: true, odometer: 44920 });
  assert.deepEqual(world.server.state.added, [
    { vehicleId: CLIO, date: '2026-10-22', odometer: 44920 },
  ]);
  assert.equal(world.fake.lastState(vehicleFeature(CLIO, 'odometer')), 44920);

  const same = await add(vehicleDevice(CLIO), '44920');
  assert.deepEqual(same.data.outputs, { added: false, odometer: 44920 });
  assert.equal(world.server.state.added.length, 1);

  const lower = await add(vehicleDevice(CLIO), '1200');
  assert.equal(lower.success, false);
  assert.match(lower.error, /inférieur au dernier/);

  const unknown = await add('ext:test-integration:vehicle:99', '100');
  assert.equal(unknown.success, false);
  assert.match(unknown.error, /Choisissez un véhicule/);
  const invalid = await add(vehicleDevice(CLIO), 'beaucoup');
  assert.match(invalid.error, /nombre positif/);
  assert.equal(world.server.state.added.length, 1, 'nothing else written');
});

test('add an odometer reading with a view-only API key: a clear refusal', async (t) => {
  const server = createLubeLogger({ auth: 'key', readOnlyKey: true });
  const world = await createWorld({
    server,
    config: { url: HOST, api_key: API_KEY, language: 'en' },
  });
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction('add_odometer', {
    vehicle: vehicleDevice(CLIO),
    odometer: '45000',
  });
  assert.equal(ack.success, false);
  assert.match(ack.error, /needs the Edit permission/);
  assert.equal(world.fake.connectionStatus.connected, true, 'reading still works');
});

test('the readings a scene may pass', () => {
  assert.equal(parseReading('45 123'), 45123);
  assert.equal(parseReading('45.123'), 45123);
  assert.equal(parseReading('45,123'), 45123);
  assert.equal(parseReading('45123,5'), 45123.5);
  assert.equal(parseReading('45123.5 km'), 45123.5);
  assert.equal(parseReading(45123), 45123);
  assert.equal(parseReading('-5'), null);
  assert.equal(parseReading(''), null);
  assert.equal(parseReading(undefined), null);
});

test('read a vehicle: the outputs of a message', async (t) => {
  const world = await createWorld({ config: { url: HOST, language: 'en' } });
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction('vehicle_status', { vehicle: vehicleDevice(TESLA) });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs, {
    vehicle_name: 'Tesla Model 3 (BB-111-BB)',
    odometer: 21400,
    consumption: 15,
    month_cost: 73.4,
    next_reminder: 'Cabin filter · 01/10/2026',
    next_urgency: 'Past due',
    past_due: 1,
    urgent: 1,
  });
  world.server.goDown();
  const down = await world.fake.sceneAction('vehicle_status', { vehicle: vehicleDevice(TESLA) });
  assert.match(down.error, /LubeLogger does not answer/);
});

test('the widget: every vehicle, or one; valid content in every language', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  for (const language of ['en', 'fr', 'de', 'es']) {
    const ack = await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language });
    assert.equal(ack.success, true, ack.error);
    assert.deepEqual(validateWidgetContent(ack.data.content), [], language);
  }
  const all = (await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'fr' })).data
    .content;
  const [pastDue, urgent, list] = all.components;
  assert.deepEqual([pastDue.value, urgent.value], [1, 3]);
  assert.equal(list.items.length, 6);
  assert.deepEqual(list.items[0], {
    title: 'Cabin filter',
    subtitle: 'Tesla Model 3 (BB-111-BB) · 01/10/2026',
    badge: { text: 'En retard', color: 'danger' },
  });
  assert.equal(list.items.at(-2).subtitle, 'Renault Clio (AA-000-AA) · 01/04/2027 ou 50 000 km');

  const one = (
    await world.fake.widgetGet(WIDGET_KEY, {
      settings: { vehicle: vehicleDevice(CLIO) },
      language: 'en',
    })
  ).data.content;
  assert.deepEqual([one.components[0].value, one.components[1].value], [0, 2]);
  assert.equal(one.components[2].items[0].subtitle, '26/10/2026', 'no vehicle name repeated');
});

test('the widget waits for LubeLogger, then says when nothing is due', async (t) => {
  const server = createLubeLogger();
  server.goDown();
  const world = await createWorld({ server });
  t.after(() => world.app.stop());
  const waiting = (await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'en' })).data
    .content;
  assert.match(waiting.components[0].text, /Waiting for LubeLogger/);
  server.goUp();
  server.state.vehicles = server.state.vehicles.slice(0, 1);
  server.setReminders('initial');
  const original = server.fetch;
  world.hub.client.fetch = async (url, init) =>
    url.includes('/reminders/all')
      ? new Response('[]', { headers: { 'content-type': 'application/json' } })
      : original(url, init);
  await world.hub.refresh();
  const empty = (await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'en' })).data
    .content;
  assert.equal(empty.components.at(-1).text, 'No maintenance reminder in LubeLogger.');
  assert.deepEqual(validateWidgetContent(empty), []);
});

test('connection status: address missing, invalid, refused, then fine', async (t) => {
  const none = await createWorld({ config: {} });
  t.after(() => none.app.stop());
  assert.equal(none.fake.connectionStatus.connected, false);
  assert.match(none.fake.connectionStatus.message.en, /Enter the address/);

  const invalid = await createWorld({ config: { url: 'ftp://192.0.2.40' } });
  t.after(() => invalid.app.stop());
  assert.match(invalid.fake.connectionStatus.message.fr, /n'est pas valide/);

  const server = createLubeLogger({ auth: 'basic' });
  const refused = await createWorld({
    server,
    config: { url: HOST, username: USER, password: 'wrong' },
  });
  t.after(() => refused.app.stop());
  assert.equal(refused.fake.connectionStatus.connected, false);
  assert.match(refused.fake.connectionStatus.message.en, /Access refused/);
  await refused.fake.configUpdated({ url: HOST, username: USER, password: PASSWORD });
  await settle(20);
  assert.equal(refused.fake.connectionStatus.connected, true);

  const html = createLubeLogger();
  html.answerHtml();
  const proxy = await createWorld({ server: html });
  t.after(() => proxy.app.stop());
  assert.match(proxy.fake.connectionStatus.message.en, /does not answer like LubeLogger/);
});

test('"Test the connection" reads again and says what it found', async (t) => {
  const world = await createWorld({ config: { url: HOST, api_key: API_KEY } });
  t.after(() => world.app.stop());
  const ack = await world.fake.action('test_connection', {});
  assert.equal(ack.data.message.fr, 'LubeLogger 1.7.4 répond : 2 véhicule(s), 6 rappel(s).');
});

test('the container reads LubeLogger on its own timer (no Gladys poll needed)', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const world = await createWorld({ config: { url: HOST, refresh_minutes: '5' } });
  t.after(() => world.app.stop());
  const before = world.server.state.requests.length;
  t.mock.timers.tick(5 * 60_000);
  await settle(20);
  assert.ok(world.server.state.requests.length > before, 'a read every 5 minutes');
});

test('a configuration change: new names without a new read; a new address reads again', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const reads = world.server.state.requests.length;
  await world.fake.configUpdated({ url: HOST, language: 'de' });
  await settle();
  assert.equal(world.server.state.requests.length, reads);
  assert.equal(world.fake.discoveredDevices[0].features[0].name, 'Kilometerstand');
  await world.fake.configUpdated({ url: `${HOST}/`, api_key: API_KEY });
  await settle(20);
  assert.ok(world.server.state.requests.length > reads);
});

test('onPoll answers; onDeviceCreated publishes every state again', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world.fake);
  const count = world.fake.states.length;
  assert.equal((await world.fake.poll(world.fake.discoveredDevices[0])).success, true);
  assert.equal(world.fake.states.length, count, 'only the changes are published');
  await world.fake.deviceCreated(world.fake.discoveredDevices[0]);
  await settle();
  assert.ok(world.fake.states.length >= count + 6, 'all the states of the vehicle again');
});
