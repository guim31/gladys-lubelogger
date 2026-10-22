// -----------------------------------------------------------------------------
// A fake LubeLogger behind a `fetch` function, answering the bodies recorded
// on a real LubeLogger 1.7.4 (test/fixtures/lubelogger/1.7.4/): two vehicles
// (a petrol Renault Clio, an electric Tesla), six reminders, then the same
// reminders after odometer readings made the oil change urgent, then past due.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const HOST = 'http://192.0.2.40:8080';
export const USER = 'admin';
export const PASSWORD = 'Demo-passw0rd!';
export const API_KEY = '0123456789abcdef0123456789abcdef';
// 2026-10-22, noon local time: the day the fixtures were recorded.
export const NOW = new Date(2026, 9, 22, 12).getTime();

export const fixture = (name) =>
  readFileSync(new URL(`../fixtures/lubelogger/1.7.4/${name}`, import.meta.url), 'utf8');
export const json = (name) => JSON.parse(fixture(name));

export const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const REMINDERS = {
  initial: 'reminders.json',
  urgent: 'reminders-urgent.json',
  past_due: 'reminders-pastdue.json',
};

/**
 * @param {object} [options]
 * @param {'none' | 'basic' | 'key'} [options.auth] authentication on the server
 * @param {boolean} [options.readOnlyKey] the API key has the View permission only
 */
export function createLubeLogger({ auth = 'none', readOnlyKey = false } = {}) {
  const state = {
    vehicles: json('vehicle-info.json'),
    reminders: 'initial',
    gas: json('gasrecords.json'),
    added: [],
    down: false,
    html: false,
    old: false,
    requests: [],
  };
  const answer = (status, body, type = 'application/json; charset=utf-8') =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': type },
    });
  const html = (status, name) => answer(status, fixture(name), 'text/html; charset=utf-8');
  const basic = `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`;

  function allowed(headers) {
    if (auth === 'none') {
      return true;
    }
    return (
      headers['x-api-key'] === API_KEY || (auth === 'basic' && headers.Authorization === basic)
    );
  }

  async function fetch(url, init = {}) {
    const { pathname, searchParams } = new URL(url);
    const method = init.method ?? 'GET';
    const path = pathname.replace(/^\/api/, '');
    state.requests.push(`${method} ${path}${searchParams.size ? `?${searchParams}` : ''}`);
    if (state.down) {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    }
    if (state.html) {
      return answer(200, '<html>Login</html>', 'text/html');
    }
    const headers = init.headers ?? {};
    if (!allowed(headers)) {
      return html(401, 'unauthorized-401.html');
    }
    if (state.old && ['/version', '/info'].includes(path)) {
      return html(404, 'unauthorized-401.html');
    }
    if (method === 'POST' && path === '/vehicle/odometerrecords/add') {
      if (readOnlyKey && headers['x-api-key']) {
        return answer(403, fixture('access-denied-403.json'));
      }
      const body = JSON.parse(init.body);
      if (!body.date || !body.odometer) {
        return answer(400, fixture('odometer-add-400.json'));
      }
      const vehicleId = Number(searchParams.get('vehicleId'));
      state.added.push({ vehicleId, ...body });
      const vehicle = state.vehicles.find((v) => v.vehicleData.id === vehicleId);
      if (vehicle) {
        vehicle.lastReportedOdometer = Math.max(vehicle.lastReportedOdometer, body.odometer);
      }
      return answer(200, fixture('odometer-add.json'));
    }
    const since = searchParams.get('startDate') ?? '';
    const from = (name) => json(name).filter((record) => record.date >= since);
    const routes = {
      '/version': () => json('version.json'),
      // The invariant culture has no currency: "¤".
      '/info': () => json(headers['culture-invariant'] ? 'info-invariant.json' : 'info.json'),
      '/vehicle/info': () => state.vehicles,
      '/vehicle/reminders/all': () => json(REMINDERS[state.reminders]),
      '/vehicle/gasrecords/all': () => state.gas,
      '/vehicle/servicerecords/all': () => from('servicerecords.json'),
      '/vehicle/repairrecords/all': () => from('repairrecords.json'),
      '/vehicle/upgraderecords/all': () => from('upgraderecords.json'),
      '/vehicle/taxrecords/all': () => from('taxrecords.json'),
    };
    if (method === 'GET' && routes[path]) {
      return answer(200, routes[path]());
    }
    return answer(404, '<html>Not Found</html>', 'text/html; charset=utf-8');
  }

  return {
    fetch,
    state,
    /** @param {'initial' | 'urgent' | 'past_due'} name */
    setReminders(name) {
      state.reminders = name;
    },
    /** Patch the vehicleData of a vehicle (sold, hours, electric...). */
    patchVehicle(id, data) {
      const vehicle = state.vehicles.find((v) => v.vehicleData.id === id);
      Object.assign(vehicle.vehicleData, data);
    },
    goDown() {
      state.down = true;
    },
    goUp() {
      state.down = false;
    },
    answerHtml() {
      state.html = true;
    },
    /** A server without /api/version nor /api/info (before 1.6.5). */
    beOld() {
      state.old = true;
    },
  };
}
