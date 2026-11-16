// Small helper shared by the API test scripts: signs in, calls the API
// over HTTP like the browser does, and prints a PASS/FAIL table.
// The app must be running (npm run dev) before the tests start.
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export const ACCOUNTS = {
  Owner: ['owner_demo', 'Owner@123'],
  Vet: ['vet_demo', 'Vet@123'],
  Farmhand: ['farmhand_demo', 'Farm@123'],
};

export async function call(method, path, { cookie, body } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    headers: {
      ...(body !== undefined && { 'content-type': 'application/json' }),
      ...(cookie && { cookie }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, setCookie: response.headers.get('set-cookie') };
}

// Signs in and returns the cookie to send with later requests
export async function login(role) {
  const [username, password] = ACCOUNTS[role];
  const res = await call('POST', '/api/auth/login', { body: { username, password } });
  if (res.status !== 200 || !res.setCookie) {
    throw new Error(`Could not sign in as ${role}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.setCookie.split(';')[0];
}

export async function checkServer() {
  try {
    await fetch(BASE_URL + '/api/auth/me');
  } catch {
    console.error(`The app is not reachable at ${BASE_URL}. Start it with "npm run dev" in another window.`);
    process.exit(1);
  }
}

export function createReport() {
  const results = [];
  return {
    check(test, passed, detail = '') {
      results.push({ test, result: passed ? 'PASS' : 'FAIL', detail: String(detail).slice(0, 70) });
    },
    print() {
      console.table(results);
      const passed = results.filter((r) => r.result === 'PASS').length;
      console.log(`passed ${passed} / ${results.length}`);
      if (passed !== results.length) process.exitCode = 1;
    },
  };
}
