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

  // ── report ──
  console.log('\n================ SMOKE TEST ================')
  for (const r of results) {
    console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${String(r.code).padEnd(3)} ${r.name}${r.ok ? '' : '  -> ' + r.msg}`)
  }
  console.log('===========================================')
  console.log(`TOTAL: ${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
})()
