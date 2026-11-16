// HerdSense | API tests: sign-in, roles, health records, vet-note
// vectors and vaccinations. Calls the running app over HTTP.
//
// Run (on the seeded database, with the app running in another window):
//   npm run dev
//   node docs/tests/api_tests_auth_health.js
//
// Records created by the tests are removed at the end.
import 'dotenv/config';
import { call, login, checkServer, createReport } from './api_client.js';
import { pool } from '../../src/lib/db.js';

const report = createReport();
const { check } = report;
const created = { healthIds: [], vaccinationDate: null };

await checkServer();

try {
  // ---------------------------------------------------------------
  // Sign-in and sessions
  // ---------------------------------------------------------------
  let res = await call('GET', '/api/auth/me');
  check('A1 /me without signing in is refused', res.status === 401, res.status);

  res = await call('POST', '/api/auth/login', { body: { username: 'vet_demo', password: 'wrong' } });
  check('A2 wrong password is refused', res.status === 401, res.data.error);

  res = await call('POST', '/api/auth/login', { body: { username: 'nobody', password: 'wrong' } });
  check('A3 unknown user gets the same message as a wrong password',
    res.status === 401 && res.data.error === 'Wrong username or password', res.data.error);

  res = await call('POST', '/api/auth/login', { body: { username: 'vet_demo', password: 'Vet@123' } });
  check('A4 correct login sets an HttpOnly session cookie',
    res.status === 200 && /HttpOnly/i.test(res.setCookie ?? ''), res.data.user?.role);

  const vet = await login('Vet');
  const owner = await login('Owner');
  const farmhand = await login('Farmhand');

  res = await call('GET', '/api/auth/me', { cookie: vet });
  check('A5 /me returns the signed-in user and role', res.data.user?.role === 'Vet', res.data.user?.name);

  const [name, token] = vet.split('=');
  const tampered = `${name}=${token.slice(0, -4)}AAAA`;
  res = await call('GET', '/api/auth/me', { cookie: tampered });
  check('A6 a tampered token is refused', res.status === 401, res.status);

  res = await call('POST', '/api/auth/logout', { cookie: vet });
  check('A7 logout clears the cookie', /Max-Age=0/i.test(res.setCookie ?? ''), res.setCookie?.split(';')[0]);

  // ---------------------------------------------------------------
  // Health records (Owner, Vet)
  // ---------------------------------------------------------------
  res = await call('GET', '/api/health-records', { cookie: farmhand });
  check('H1 a Farmhand cannot read health records', res.status === 403, res.data.error);

  res = await call('GET', '/api/health-records?cattleId=10', { cookie: vet });
  check('H2 a Vet can list one animal\'s health records',
    res.status === 200 && res.data.records.length > 0 && res.data.records.every((r) => r.cattle_id === 10),
    `${res.data.records?.length} records`);

  res = await call('POST', '/api/health-records', { cookie: vet, body: {
    cattleId: 12, severity: 'Moderate', suspectedCondition: 'Mastitis',
    vetNotes: 'Front left quarter hard and warm, stringy clots when stripping, cow restless.',
  } });
  const newId = res.data.record?.health_id;
  if (newId) created.healthIds.push(newId);
  check('H3 adding a record also stores its 384-dim embedding',
    res.status === 201 && res.data.embedding?.dimensions === 384 && res.data.record.vet_id === 2,
    `health_id ${newId}`);

  res = await call('POST', '/api/health-records', { cookie: vet, body: { cattleId: 12, vetNotes: 'Check' } });
  check('H4 a missing required field is refused by the API', res.status === 400, res.data.error);

  res = await call('POST', '/api/health-records', { cookie: vet, body: { cattleId: 12, vetNotes: 'Check', severity: 'Critical' } });
  check('H5 an invalid severity is refused by the database (CHECK)', res.status === 400 && res.data.code === '23514', res.data.detail);

  res = await call('POST', '/api/health-records', { cookie: owner, body: { cattleId: 12, vetNotes: 'Check', severity: 'Mild', vetId: 3 } });
  check('H6 a Farmhand cannot be recorded as the vet (trigger)', res.status === 400 && res.data.code === '23514', res.data.detail);

  res = await call('PATCH', `/api/health-records/${newId}`, { cookie: vet, body: {
    vetNotes: 'Coughing with nasal discharge and fast breathing.', suspectedCondition: 'Respiratory Infection',
  } });
  check('H7 editing a record re-embeds its note and updates the metadata',
    res.status === 200 && res.data.embedding?.suspected_condition === 'Respiratory Infection', res.data.embedding?.suspected_condition);

  // ---------------------------------------------------------------
  // Vet-note vector search and embedding read / update / delete
  // ---------------------------------------------------------------
  res = await call('POST', '/api/notes/search', { cookie: vet, body: { text: 'inflamed udder and lumpy discoloured milk', mode: 'both' } });
  check('N1 keyword search finds nothing for reworded symptoms', res.status === 200 && res.data.keyword.length === 0, `${res.data.keyword?.length} rows`);
  check('N2 semantic search ranks a mastitis case first',
    res.data.semantic?.[0]?.suspected_condition === 'Mastitis', `${res.data.semantic?.[0]?.suspected_condition} ${res.data.semantic?.[0]?.similarity}`);
  check('N3 the suggested condition is Mastitis', res.data.suggestedConditions?.[0]?.condition === 'Mastitis',
    JSON.stringify(res.data.suggestedConditions?.[0]));

  res = await call('POST', '/api/notes/search', { cookie: vet, body: { text: 'coughing and runny nose', k: 3 } });
  check('N4 the edited note is now found by a matching search',
    res.data.semantic?.some((r) => r.health_id === newId), res.data.semantic?.map((r) => r.health_id).join(', '));

  res = await call('POST', '/api/notes/search', { cookie: vet, body: { text: 'ab' } });
  check('N5 a too-short search is refused', res.status === 400, res.data.error);

  res = await call('POST', '/api/notes/search', { cookie: farmhand, body: { text: 'fever' } });
  check('N6 a Farmhand cannot search vet notes', res.status === 403, res.data.error);

  res = await call('GET', `/api/notes/${newId}/embedding`, { cookie: vet });
  check('N7 read one note\'s embedding', res.status === 200 && Number(res.data.embedding?.norm) === 1, `norm ${res.data.embedding?.norm}`);

  res = await call('DELETE', `/api/notes/${newId}/embedding`, { cookie: vet });
  const afterDelete = await call('GET', `/api/notes/${newId}/embedding`, { cookie: vet });
  check('N8 delete one note\'s embedding', res.status === 200 && afterDelete.status === 404, `${res.status} then ${afterDelete.status}`);

  res = await call('POST', `/api/notes/${newId}/embedding`, { cookie: vet });
  check('N9 re-create the embedding', res.status === 201 && res.data.embedding?.dimensions === 384, res.status);

  res = await call('DELETE', `/api/health-records/${newId}`, { cookie: vet });
  const goneRecord = await call('GET', `/api/health-records/${newId}`, { cookie: vet });
  const goneVector = await call('GET', `/api/notes/${newId}/embedding`, { cookie: vet });
  check('H8 deleting a record removes it and its embedding',
    res.status === 200 && goneRecord.status === 404 && goneVector.status === 404, `${goneRecord.status}, ${goneVector.status}`);
  if (res.status === 200) created.healthIds.pop();

  // ---------------------------------------------------------------
  // Vaccinations
  // ---------------------------------------------------------------
  res = await call('GET', '/api/vaccinations?dueWithin=0', { cookie: vet });
  check('V1 due-today and overdue doses (fn_vaccinations_due)',
    res.status === 200 && res.data.vaccinations.some((v) => v.cattle_id === 14 && v.vaccine_name === 'HS'),
    `${res.data.vaccinations?.length} doses due`);

  res = await call('POST', '/api/vaccinations', { cookie: owner, body: { vaccineName: 'LSD', intervalDays: 365, cattleIds: [21] } });
  check('V2 only a Vet can record vaccinations', res.status === 403, res.data.error);

  const testDate = '2026-01-15';
  created.vaccinationDate = testDate;
  res = await call('POST', '/api/vaccinations', { cookie: vet, body: { vaccineName: 'LSD', intervalDays: 365, cattleIds: [21, 2], administeredDate: testDate } });
  const { rows: [{ n: partial }] } = await pool.query(
    `SELECT count(*)::int AS n FROM Vaccinations WHERE administered_date = $1 AND vaccine_name = 'LSD'`, [testDate]);
  check('V3 a sold animal in the list rejects the whole call (procedure)',
    res.status === 400 && partial === 0, `${res.status}, ${partial} saved`);

  res = await call('POST', '/api/vaccinations', { cookie: vet, body: { vaccineName: 'LSD', intervalDays: 365, cattleIds: [21, 22], administeredDate: testDate } });
  const history = await call('GET', '/api/vaccinations?cattleId=21', { cookie: vet });
  const dose = history.data.vaccinations?.find((v) => v.administered_date === testDate);
  check('V4 a valid call records each dose with its due date (trigger)',
    res.status === 201 && dose?.next_due_date === '2027-01-15', `next due ${dose?.next_due_date}`);
} catch (err) {
  check('Unexpected error', false, err.message);
} finally {
  // Remove anything the tests added
  if (created.healthIds.length > 0) {
    await pool.query('DELETE FROM Health_Records WHERE health_id = ANY($1)', [created.healthIds]);
  }
  if (created.vaccinationDate) {
    await pool.query(`DELETE FROM Vaccinations WHERE administered_date = $1 AND vaccine_name = 'LSD'`, [created.vaccinationDate]);
  }
  await pool.end();
}

report.print();
