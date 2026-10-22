// The LubeLogger client against the fake built on real 1.7.4 answers:
// headers, authentication, and how each refusal is classified.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LubeLoggerClient, LubeLoggerError } from '../src/lubelogger/client.js';
import { API_KEY, HOST, PASSWORD, USER, createLubeLogger } from './helpers/fakeLubeLogger.js';

const clientOf = (server, options = {}) =>
  new LubeLoggerClient({ url: HOST, fetch: server.fetch, timeout: 200, ...options });

/** Records the headers of every request, then answers through the fake. */
function spy(server) {
  const seen = [];
  return {
    seen,
    fetch: (url, init) => {
      seen.push({ url, headers: init.headers });
      return server.fetch(url, init);
    },
  };
}

test('every request asks for invariant numbers and dates, the API key wins over a user', async () => {
  const server = createLubeLogger({ auth: 'key' });
  const recorder = spy(server);
  const client = clientOf(server, {
    fetch: recorder.fetch,
    apiKey: API_KEY,
    username: USER,
    password: PASSWORD,
  });
  assert.equal((await client.vehicleInfo()).length, 2);
  const [{ url, headers }] = recorder.seen;
  assert.equal(url, `${HOST}/api/vehicle/info`);
  assert.equal(headers['culture-invariant'], 'true');
  assert.equal(headers['x-api-key'], API_KEY);
  assert.equal(headers.Authorization, undefined);
});

test('a user and password go in Basic auth', async () => {
  const server = createLubeLogger({ auth: 'basic' });
  const client = clientOf(server, { username: USER, password: PASSWORD });
  assert.equal((await client.reminders()).length, 6);
  const wrong = clientOf(server, { username: USER, password: 'nope' });
  await assert.rejects(wrong.reminders(), (err) => {
    assert.equal(err.kind, 'unauthorized');
    assert.equal(err.message, '/vehicle/reminders/all: HTTP 401');
    return true;
  });
});

test('the server locale is read without the invariant header (its currency)', async () => {
  const server = createLubeLogger();
  const client = clientOf(server);
  assert.equal((await client.info()).currencySymbol, '$');
  assert.equal(await client.version(), '1.7.4');
  server.beOld();
  assert.equal(await client.info(), null, 'before 1.6.5');
  assert.equal(await client.version(), null);
});

test('the month records are asked from a start date', async () => {
  const server = createLubeLogger();
  const client = clientOf(server);
  const service = await client.records('servicerecords', '2026-10-01');
  assert.deepEqual(
    service.map((r) => r.description),
    ['Brake pads'],
  );
  assert.ok(server.state.requests.includes('GET /vehicle/servicerecords/all?startDate=2026-10-01'));
  assert.deepEqual(await client.records('repairrecords', '2026-10-01'), []);
});

test('an odometer reading: added, refused by a view-only key, or invalid', async () => {
  const server = createLubeLogger({ auth: 'key', readOnlyKey: true });
  const client = clientOf(server, { apiKey: API_KEY });
  await assert.rejects(client.addOdometer(1, { date: '2026-10-22', odometer: 45000 }), (err) => {
    assert.equal(err.kind, 'forbidden');
    assert.match(err.message, /HTTP 403, Access Denied/);
    return true;
  });
  const open = clientOf(createLubeLogger());
  const done = await open.addOdometer(1, { date: '2026-10-22', odometer: 45000 });
  assert.equal(done.message, 'Odometer Record Added');
  await assert.rejects(open.addOdometer(1, { date: '', odometer: 45000 }), (err) => {
    assert.equal(err.kind, 'http');
    assert.match(err.message, /Date, and Odometer cannot be empty/);
    return true;
  });
});

test('unreachable, not LubeLogger, unknown path', async () => {
  const server = createLubeLogger();
  const client = clientOf(server);
  server.goDown();
  await assert.rejects(client.vehicleInfo(), { kind: 'unreachable' });
  server.goUp();
  server.answerHtml();
  await assert.rejects(client.vehicleInfo(), (err) => {
    assert.ok(err instanceof LubeLoggerError);
    assert.equal(err.kind, 'invalid');
    return true;
  });
  const fresh = createLubeLogger();
  const lost = new LubeLoggerClient({ url: `${HOST}/nope`, fetch: fresh.fetch });
  await assert.rejects(lost.vehicleInfo(), { kind: 'not_found' });
});

test('a server that never answers times out', async () => {
  const hang = (url, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    });
  const client = new LubeLoggerClient({ url: HOST, fetch: hang, timeout: 30 });
  await assert.rejects(client.vehicleInfo(), { kind: 'timeout' });
});
