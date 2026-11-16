// HerdSense | API tests: cattle, pedigree, breeding, calving and milk.
// Calls the running app over HTTP.
//
// Run (on the seeded database, with the app running in another window):
//   npm run dev
//   node docs/tests/api_tests_cattle_breeding_milk.js
//
// Records created by the tests are removed at the end.
import 'dotenv/config';
import { call, login, checkServer, createReport } from './api_client.js';
import { pool } from '../../src/lib/db.js';

const report = createReport();
const { check } = report;
const TEST_TAG = 'KA-TEST';            // prefix of every animal the tests add
const TEST_MILK_DATE = '2026-01-10';   // date used for test milk readings
let testBreedingId = null;

await checkServer();

try {
  const owner = await login('Owner');
  const vet = await login('Vet');
  const farmhand = await login('Farmhand');

  // ---------------------------------------------------------------
  // Cattle
  // ---------------------------------------------------------------
  let res = await call('GET', '/api/cattle?status=Active&sex=F', { cookie: farmhand });
  check('C1 every role can list cattle, with filters',
    res.status === 200 && res.data.cattle.length > 0 && res.data.cattle.every((c) => c.status === 'Active' && c.sex === 'F'),
    `${res.data.cattle?.length} active cows`);

  res = await call('GET', '/api/cattle?q=tulsi', { cookie: farmhand });
  check('C2 search by name', res.data.cattle?.length === 1 && res.data.cattle[0].tag_number === 'KA-4001', res.data.cattle?.[0]?.name);

  const asVet = await call('GET', '/api/cattle/17', { cookie: vet });
  const asFarmhand = await call('GET', '/api/cattle/17', { cookie: farmhand });
  check('C3 Vets see parents; Farmhands see only the animal',
    asVet.data.parents?.dam_name === 'Radha' && asVet.data.parents?.sire_name === 'Arjuna' && asFarmhand.data.parents === undefined,
    `dam ${asVet.data.parents?.dam_name}, sire ${asVet.data.parents?.sire_name}`);

  res = await call('POST', '/api/cattle', { cookie: vet, body: { tagNumber: `${TEST_TAG}-1`, breed: 'Gir', sex: 'F', dateOfBirth: '2024-01-01' } });
  check('C4 a Vet cannot add animals', res.status === 403, res.data.error);

  res = await call('POST', '/api/cattle', { cookie: owner, body: { tagNumber: `${TEST_TAG}-1`, name: 'Test Cow', breed: 'Gir', sex: 'F', dateOfBirth: '2024-01-01' } });
  const testCowId = res.data.animal?.cattle_id;
  check('C5 the Owner can add an animal', res.status === 201 && res.data.animal?.status === 'Active', `cattle_id ${testCowId}`);

  res = await call('POST', '/api/cattle', { cookie: owner, body: { tagNumber: `${TEST_TAG}-1`, breed: 'Gir', sex: 'F', dateOfBirth: '2024-01-01' } });
  check('C6 a duplicate tag number is refused (UNIQUE)', res.status === 409 && res.data.code === '23505', res.data.detail);

  res = await call('POST', '/api/cattle', { cookie: owner, body: { tagNumber: `${TEST_TAG}-2`, breed: 'Gir', sex: 'X', dateOfBirth: '2024-01-01' } });
  check('C7 an invalid sex is refused (CHECK)', res.status === 400 && res.data.code === '23514', res.data.detail);

  res = await call('PATCH', `/api/cattle/${testCowId}`, { cookie: owner, body: { name: 'Renamed Cow' } });
  check('C8 the Owner can edit an animal', res.status === 200 && res.data.animal?.name === 'Renamed Cow', res.data.animal?.name);

  res = await call('DELETE', '/api/cattle/8', { cookie: owner });
  check('C9 deleting a parent is refused (ON DELETE RESTRICT)', res.status === 409 && res.data.code === '23503', res.data.detail);

  // ---------------------------------------------------------------
  // Pedigree (fn_pedigree)
  // ---------------------------------------------------------------
  res = await call('GET', '/api/cattle/17/pedigree', { cookie: vet });
  const greatGrandparents = res.data.pedigree?.filter((p) => p.generation === 3).map((p) => p.name).sort().join(', ');
  check('P1 pedigree of Tulsi goes back three generations',
    res.status === 200 && res.data.pedigree.length === 7 && greatGrandparents === 'Bhima, Ganga', greatGrandparents);

  res = await call('GET', '/api/cattle/17/pedigree?generations=1', { cookie: vet });
  check('P2 the generations limit stops at the parents', res.data.pedigree?.length === 3, `${res.data.pedigree?.length} rows`);

  res = await call('GET', '/api/cattle/99999/pedigree', { cookie: vet });
  check('P3 an unknown animal gives 404', res.status === 404, res.data.error);

  res = await call('GET', '/api/cattle/17/pedigree', { cookie: farmhand });
  check('P4 a Farmhand cannot view pedigrees', res.status === 403, res.data.error);

  // ---------------------------------------------------------------
  // Breeding and calving (sp_record_calving)
  // ---------------------------------------------------------------
  res = await call('POST', '/api/breeding', { cookie: owner, body: { damId: 4, sireId: 7, breedingDate: '2026-02-01', method: 'AI' } });
  check('B1 a bull recorded as the dam is refused (trigger)', res.status === 400 && res.data.code === '23514', res.data.detail);

  res = await call('POST', '/api/breeding', { cookie: vet, body: { damId: testCowId, sireId: 7, breedingDate: '2026-02-01', method: 'AI' } });
  check('B2 a Vet cannot record breedings', res.status === 403, res.data.error);

  res = await call('POST', '/api/breeding', { cookie: owner, body: { damId: testCowId, sireId: 7, breedingDate: '2026-02-01', method: 'AI' } });
  testBreedingId = res.data.breeding?.breeding_id;
  check('B3 the Owner can record a breeding (Pending)', res.status === 201 && res.data.breeding?.outcome === 'Pending', `breeding_id ${testBreedingId}`);

  res = await call('POST', `/api/breeding/${testBreedingId}/calving`, { cookie: owner, body: { tagNumber: `${TEST_TAG}-CALF`, name: 'Test Calf', sex: 'F', breed: 'Gir', dateOfBirth: '2025-12-01' } });
  const { rows: [{ n: halfSaved }] } = await pool.query(`SELECT count(*)::int AS n FROM Cattle WHERE tag_number = $1`, [`${TEST_TAG}-CALF`]);
  check('B4 a calf dated before the breeding is refused, nothing half-saved', res.status === 400 && halfSaved === 0, `${res.status}, ${halfSaved} calves saved`);

  res = await call('POST', `/api/breeding/${testBreedingId}/calving`, { cookie: owner, body: { tagNumber: `${TEST_TAG}-CALF`, name: 'Test Calf', sex: 'F', breed: 'Gir' } });
  const listed = await call('GET', `/api/breeding?damId=${testCowId}`, { cookie: owner });
  check('B5 recording the calving adds the calf and closes the breeding',
    res.status === 201 && listed.data.breeding?.[0]?.outcome === 'Calved' && listed.data.breeding[0].calf_name === 'Test Calf',
    `${listed.data.breeding?.[0]?.outcome}, calf ${listed.data.breeding?.[0]?.calf_name}`);

  res = await call('POST', `/api/breeding/${testBreedingId}/calving`, { cookie: owner, body: { tagNumber: `${TEST_TAG}-TWIN`, sex: 'F', breed: 'Gir' } });
  check('B6 the same breeding cannot calve twice', res.status === 400, res.data.detail);

  // ---------------------------------------------------------------
  // Milk yield
  // ---------------------------------------------------------------
  res = await call('POST', '/api/milk', { cookie: farmhand, body: { cattleId: 13, session: 'Morning', litres: 5.4, yieldDate: TEST_MILK_DATE } });
  check('M1 a Farmhand can record milk', res.status === 201 && res.data.reading?.recorded_by === 3, `yield_id ${res.data.reading?.yield_id}`);

  res = await call('POST', '/api/milk', { cookie: farmhand, body: { cattleId: 13, session: 'Morning', litres: 5.0, yieldDate: TEST_MILK_DATE } });
  check('M2 a second reading for the same session is refused (UNIQUE)', res.status === 409, res.data.detail);

  res = await call('POST', '/api/milk', { cookie: farmhand, body: { cattleId: 4, session: 'Evening', litres: 3, yieldDate: TEST_MILK_DATE } });
  check('M3 milk for a bull is refused (trigger)', res.status === 400 && res.data.code === '23514', res.data.detail);

  res = await call('POST', '/api/milk', { cookie: farmhand, body: { cattleId: 13, session: 'Evening', litres: -1, yieldDate: TEST_MILK_DATE } });
  check('M4 negative litres are refused (CHECK)', res.status === 400 && res.data.code === '23514', res.data.detail);

  res = await call('POST', '/api/milk', { cookie: vet, body: { cattleId: 13, session: 'Evening', litres: 4, yieldDate: TEST_MILK_DATE } });
  check('M5 a Vet cannot record milk', res.status === 403, res.data.error);

  res = await call('GET', '/api/milk?cattleId=10&days=7', { cookie: farmhand });
  check('M6 daily milk totals for one cow', res.status === 200 && res.data.milk.length === 7 && res.data.milk.every((d) => d.cattle_id === 10),
    `${res.data.milk?.length} days`);

  res = await call('GET', '/api/milk?days=0', { cookie: farmhand });
  check('M7 an invalid number of days is refused', res.status === 400, res.data.error);

  res = await call('GET', '/api/milk/anomalies', { cookie: vet });
  check('M8 yield-anomaly detection flags Lakshmi with her mastitis exam',
    res.status === 200 && res.data.anomalies.length === 1 && res.data.anomalies[0].name === 'Lakshmi' && res.data.anomalies[0].latest_condition === 'Mastitis',
    `${res.data.anomalies?.[0]?.name} ${res.data.anomalies?.[0]?.change_pct}%`);

  res = await call('GET', '/api/milk/anomalies', { cookie: farmhand });
  check('M9 a Farmhand cannot run anomaly detection', res.status === 403, res.data.error);
} catch (err) {
  check('Unexpected error', false, err.message);
} finally {
  // Remove anything the tests added
  await pool.query('DELETE FROM Milk_Yield WHERE yield_date = $1', [TEST_MILK_DATE]);
  if (testBreedingId) await pool.query('DELETE FROM Breeding_Records WHERE breeding_id = $1', [testBreedingId]);
  await pool.query('DELETE FROM Cattle WHERE tag_number LIKE $1', [`${TEST_TAG}%`]);
  await pool.end();
}

report.print();
