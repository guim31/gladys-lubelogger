// -----------------------------------------------------------------------------
// The REST API of LubeLogger (`<base>/api/...`), the few calls the integration
// needs: the vehicles with their reminder counts, the reminders, the records
// of the month (costs) and the fuel records (consumption); one write, the
// odometer reading of the scene action.
//
// Facts checked on a real server, LubeLogger 1.7.4 (ghcr.io/hargata/lubelogger),
// see test/fixtures/lubelogger/:
// - without the `culture-invariant` header, numbers and dates follow the
//   locale of the server ("45000" as a string, "11/15/2026"): always sent;
// - authentication is off by default (every call answers). Once on, an API
//   key goes in `x-api-key` (LubeLogger 1.5.8+), a user in Basic auth; a
//   refusal is a 401 in HTML (`WWW-Authenticate: Basic`), a key without the
//   Edit permission gets a JSON 403 `{ success: false, message: "Access Denied" }`
//   on a write;
// - the `.../all` lists exist since 1.5.5 and carry `vehicleId` since 1.5.9:
//   the oldest version the integration supports;
// - an unknown path answers the HTML "Not Found" page in 404, and
//   `odometerrecords/add` accepts any vehicle id, even one that does not exist.
// -----------------------------------------------------------------------------

export const DEFAULT_TIMEOUT = 15_000;

export class LubeLoggerError extends Error {
  /**
   * @param {'unreachable' | 'unauthorized' | 'forbidden' | 'not_found' | 'timeout' | 'http' | 'invalid' | 'refused'} kind
   * @param {string} message never carries a credential
   * @param {number} [status]
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'LubeLoggerError';
    this.kind = kind;
    this.status = status;
  }
}

export class LubeLoggerClient {
  /**
   * @param {object} options
   * @param {string} options.url normalized base URL (see normalizeUrl)
   * @param {string} [options.apiKey]
   * @param {string} [options.username]
   * @param {string} [options.password]
   * @param {typeof fetch} [options.fetch]
   * @param {number} [options.timeout]
   */
  constructor({ url, apiKey = '', username = '', password = '', fetch: fetchImpl, timeout }) {
    this.url = url;
    this.headers = { Accept: 'application/json', 'culture-invariant': 'true' };
    // An API key wins: it survives a password change and can be read only.
    if (apiKey) {
      this.headers['x-api-key'] = apiKey;
    } else if (username) {
      this.headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }
    this.fetch = fetchImpl ?? globalThis.fetch;
    this.timeout = timeout ?? DEFAULT_TIMEOUT;
  }

  async #send(method, path, body, { invariant = true } = {}) {
    const headers = { ...this.headers };
    if (!invariant) {
      delete headers['culture-invariant'];
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await this.fetch(`${this.url}/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
        redirect: 'follow',
      });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new LubeLoggerError('timeout', `No answer from LubeLogger within ${this.timeout} ms`);
      }
      const cause = err?.cause?.code ?? err?.cause?.message ?? err?.message ?? 'error';
      throw new LubeLoggerError('unreachable', `LubeLogger unreachable (${cause})`);
    }
    const raw = await response.text().catch(() => '');
    const route = path.split('?')[0];
    if (!response.ok) {
      const kind =
        { 401: 'unauthorized', 403: 'forbidden', 404: 'not_found' }[response.status] ?? 'http';
      let detail = `HTTP ${response.status}`;
      try {
        const message = JSON.parse(raw)?.message;
        if (typeof message === 'string' && message !== '') {
          detail = `${detail}, ${message}`;
        }
      } catch {
        // an HTML page: keep the status
      }
      throw new LubeLoggerError(kind, `${route}: ${detail.slice(0, 120)}`, response.status);
    }
    try {
      return JSON.parse(raw);
    } catch {
      // A proxy login page answering 200 in HTML, for instance.
      throw new LubeLoggerError(
        'invalid',
        `${route}: the answer is not JSON (is this LubeLogger?)`,
      );
    }
  }

  async #list(path) {
    const data = await this.#send('GET', path);
    if (!Array.isArray(data)) {
      throw new LubeLoggerError('invalid', `${path.split('?')[0]}: a list was expected`);
    }
    return data;
  }

  /** A GET answering null on a version of LubeLogger without the endpoint. */
  async #optional(path, options) {
    try {
      return await this.#send('GET', path, undefined, options);
    } catch (err) {
      if (err instanceof LubeLoggerError && err.kind === 'not_found') {
        return null;
      }
      throw err;
    }
  }

  /** "1.7.4", or null when the server does not say. */
  async version() {
    const data = await this.#optional('/version');
    return typeof data?.currentVersion === 'string' ? data.currentVersion : null;
  }

  /**
   * `{ locale, currencySymbol, ... }` of the server (1.6.5+), or null. Asked
   * without `culture-invariant`: the invariant culture answers the generic
   * currency sign "¤" instead of the one of the server.
   */
  async info() {
    const data = await this.#optional('/info', { invariant: false });
    return data && typeof data === 'object' ? data : null;
  }

  /** The vehicles with their reminder counts and last odometer (`/vehicle/info`). */
  vehicleInfo() {
    return this.#list('/vehicle/info');
  }

  /** Every reminder of every vehicle, with its urgency computed by LubeLogger. */
  reminders() {
    return this.#list('/vehicle/reminders/all');
  }

  /** Every fuel or charging record (the consumption needs the whole history). */
  gasRecords() {
    return this.#list('/vehicle/gasrecords/all');
  }

  /**
   * The records of one kind since a day (`YYYY-MM-DD`), for the costs.
   * @param {'servicerecords' | 'repairrecords' | 'upgraderecords' | 'taxrecords'} kind
   */
  records(kind, since) {
    return this.#list(`/vehicle/${kind}/all?startDate=${encodeURIComponent(since)}`);
  }

  /** Add an odometer reading; LubeLogger answers `{ success, message }`. */
  async addOdometer(vehicleId, { date, odometer }) {
    const data = await this.#send(
      'POST',
      `/vehicle/odometerrecords/add?vehicleId=${encodeURIComponent(vehicleId)}`,
      { date, odometer },
    );
    if (data?.success !== true) {
      const message = typeof data?.message === 'string' ? data.message : 'refused';
      throw new LubeLoggerError('refused', `odometerrecords/add: ${message.slice(0, 120)}`);
    }
    return data;
  }
}
