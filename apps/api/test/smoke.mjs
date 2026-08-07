// test/smoke.mjs — end-to-end API smoke test.
// Assumes the API is running (default http://localhost:3001) and the DB is seeded
// (admin@mpl.com / admin1234, client@mpl.com / client1234).
// Exits non-zero on any failure so CI fails loudly.
//
//   Local:  npm run dev   (in another terminal)  →  npm run smoke
//   CI:     started by the workflow before this runs.

const BASE = process.env.API_URL || 'http://localhost:3001'
const results = []
let pass = 0, fail = 0
const rnd = Math.floor(Math.random() * 1e6)

async function call(name, method, path, { token, body, expect = [200, 201] } = {}) {
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  let code = 0, json = {}
  try {
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    code = res.status
    try { json = JSON.parse(await res.text()) } catch { /* non-json */ }
  } catch (e) {
    json = { message: String(e) }
  }
  const ok = expect.includes(code)
  ok ? pass++ : fail++
  results.push({ name, code, ok, msg: json.message || '' })
  return { code, json, ok }
}

;(async () => {
  // health
  await call('GET /health', 'GET', '/health')

  // auth
  const a = await call('POST /auth/admin/login', 'POST', '/api/auth/admin/login', { body: { email: 'admin@mpl.com', password: 'admin1234' } })
  const ADMIN = a.json.token
  const c = await call('POST /auth/login', 'POST', '/api/auth/login', { body: { email: 'client@mpl.com', password: 'client1234' } })
  const CLIENT = c.json.token
  if (!ADMIN || !CLIENT) {
    console.error('FATAL: could not obtain tokens — is the DB seeded?')
    process.exit(1)
  }

  // users (admin)
  await call('GET /users', 'GET', '/api/users', { token: ADMIN })
  const created = await call('POST /users (create klien)', 'POST', '/api/users', { token: ADMIN, body: { fullName: 'Smoke Klien', email: `smoke${rnd}@t.com`, companyName: 'SmokeCo' }, expect: [201] })
  const NEW_ID = created.json.user?.id
  await call('GET /users/me (client)', 'GET', '/api/users/me', { token: CLIENT })
  await call('GET /users/companies', 'GET', '/api/users/companies', { token: ADMIN })
  if (NEW_ID) await call('PATCH /users/:id/verify', 'PATCH', `/api/users/${NEW_ID}/verify`, { token: ADMIN })

  // shipments
  const ship = await call('POST /shipments (client)', 'POST', '/api/shipments', { token: CLIENT, body: { packageType: 'Box', weightKg: 5, serviceLevel: 'Darat', originLocation: 'Jakarta', destinationLocation: 'Bandung' }, expect: [201] })
  const SHIP = ship.json.shipment?.id
  await call('GET /shipments', 'GET', '/api/shipments', { token: CLIENT })
  await call('GET /shipments/stats', 'GET', '/api/shipments/stats?period=monthly', { token: CLIENT })

  // fleet
  const driver = await call('POST /fleet/drivers', 'POST', '/api/fleet/drivers', { token: ADMIN, body: { fullName: 'Smoke Driver', phoneNumber: '0812' }, expect: [201] })
  const DRIVER = driver.json.driver?.id
  const vehicle = await call('POST /fleet/vehicles', 'POST', '/api/fleet/vehicles', { token: ADMIN, body: { type: 'Van', licensePlate: `S${rnd}` }, expect: [201] })
  const VEHICLE = vehicle.json.vehicle?.id
  await call('GET /fleet/drivers', 'GET', '/api/fleet/drivers', { token: ADMIN })
  await call('GET /fleet/vehicles', 'GET', '/api/fleet/vehicles', { token: ADMIN })

  // assign + status + tracking
  if (SHIP && DRIVER && VEHICLE) await call('PATCH /shipments/:id/assign', 'PATCH', `/api/shipments/${encodeURIComponent(SHIP)}/assign`, { token: ADMIN, body: { driverId: DRIVER, vehicleId: VEHICLE } })
  if (SHIP) await call('PATCH /shipments/:id/status', 'PATCH', `/api/shipments/${encodeURIComponent(SHIP)}/status`, { token: ADMIN, body: { status: 'TRANSIT', currentProgressPercent: 30 } })
  if (SHIP) await call('GET /tracking/:id', 'GET', `/api/tracking/${encodeURIComponent(SHIP)}`, { token: CLIENT })
  let EVENT
  if (SHIP) {
    const ev = await call('POST /tracking/:id/events', 'POST', `/api/tracking/${encodeURIComponent(SHIP)}/events`, { token: ADMIN, body: { stepName: 'Picked up', location: 'JKT', status: 'DONE', eventTimestamp: '2026-06-20T08:00:00Z' }, expect: [200, 201] })
    EVENT = ev.json.event?.id
  }
  if (EVENT) await call('PATCH /tracking/events/:id', 'PATCH', `/api/tracking/events/${EVENT}`, { token: ADMIN, body: { status: 'DONE' } })

  // notifications
  await call('GET /notifications', 'GET', '/api/notifications', { token: CLIENT })
  await call('GET /admin-notifications', 'GET', '/api/admin-notifications', { token: ADMIN })

  // onboarding — magic-link registration lifecycle (generate → validate → register → verify → login)
  const picEmail = `pic${rnd}@t.com`
  let NEW_PIC_ID
  const gen = await call('POST /users/magic-link (generate)', 'POST', '/api/users/magic-link', { token: ADMIN, body: { companyName: 'SmokeCo', accountType: 'client' }, expect: [201] })
  const mtoken = (gen.json.link || '').split('/').pop()
  if (mtoken) {
    await call('GET /users/magic-link/:token (validate)', 'GET', `/api/users/magic-link/${mtoken}`, { expect: [200] })
    const reg = await call('POST /users/magic-link/:token/register', 'POST', `/api/users/magic-link/${mtoken}/register`, { body: { fullName: 'PIC Smoke', email: picEmail, password: 'secret123', confirmPassword: 'secret123' }, expect: [201] })
    NEW_PIC_ID = reg.json.user?.id
    await call('POST /auth/registration-status (-> PENDING)', 'POST', '/api/auth/registration-status', { body: { email: picEmail }, expect: [200] })
    await call('POST /auth/login (pending -> 403)', 'POST', '/api/auth/login', { body: { email: picEmail, password: 'secret123' }, expect: [403] })
    if (NEW_PIC_ID) await call('PATCH /users/:id/verify (magic-link acct)', 'PATCH', `/api/users/${NEW_PIC_ID}/verify`, { token: ADMIN, expect: [200] })
    await call('POST /auth/registration-status (-> VERIFIED)', 'POST', '/api/auth/registration-status', { body: { email: picEmail }, expect: [200] })
    await call('POST /auth/login (verified -> 200)', 'POST', '/api/auth/login', { body: { email: picEmail, password: 'secret123' }, expect: [200] })
  }

  // permission guard — pipeline roles (PIC Gudang) may NOT manage clients
  const gud = await call('POST /auth/admin/login (gudang)', 'POST', '/api/auth/admin/login', { body: { email: 'gudang@mpl.com', password: 'gudang1234' }, expect: [200] })
  const GUDANG = gud.json.token
  if (GUDANG) {
    await call('POST /users (gudang blocked -> 403)', 'POST', '/api/users', { token: GUDANG, body: { fullName: 'Nope', email: `nope${rnd}@t.com` }, expect: [403] })
    await call('POST /users/magic-link (gudang blocked -> 403)', 'POST', '/api/users/magic-link', { token: GUDANG, body: { companyName: 'SmokeCo' }, expect: [403] })
  }

  // ── cleanup: remove everything this run created so the dev DB stays clean ──
  const del = async (path) => {
    try {
      const r = await fetch(BASE + path, { method: 'DELETE', headers: { Authorization: `Bearer ${ADMIN}` } })
      return r.ok
    } catch { return false }
  }
  let cleaned = 0
  if (SHIP)       cleaned += (await del(`/api/shipments/${encodeURIComponent(SHIP)}`)) ? 1 : 0
  if (DRIVER)     cleaned += (await del(`/api/fleet/drivers/${DRIVER}`)) ? 1 : 0
  if (VEHICLE)    cleaned += (await del(`/api/fleet/vehicles/${VEHICLE}`)) ? 1 : 0
  if (NEW_ID)     cleaned += (await del(`/api/users/${NEW_ID}`)) ? 1 : 0
  if (NEW_PIC_ID) cleaned += (await del(`/api/users/${NEW_PIC_ID}`)) ? 1 : 0
  console.log(`\n🧹 cleanup: removed ${cleaned} test record(s) (magic_link rows are one-time-use and left inert)`)

  // ── report ──
  console.log('\n================ SMOKE TEST ================')
  for (const r of results) {
    console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${String(r.code).padEnd(3)} ${r.name}${r.ok ? '' : '  -> ' + r.msg}`)
  }
  console.log('===========================================')
  console.log(`TOTAL: ${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
})()
