// test/smoke.mjs — end-to-end API smoke test.
// Assumes the API is running (default http://localhost:3001) and the DB is seeded
// (admin@mpl.com / admin1234). The seed creates NO client accounts (clients onboard via
// magic link), so the suite bootstraps its own: the create-klien call returns a
// temporaryPassword, and that account becomes the CLIENT identity for every client-scoped
// test below (deleted again in cleanup).
// Exits non-zero on any failure so CI fails loudly.
//
// Auth is cookie-session based (Phase 2, 2026-09-22): login sets httpOnly `mpl_session`
// + readable `mpl_csrf`; there is NO body token and the Bearer path no longer exists.
// Each identity below holds its own cookie jar, and every mutating request echoes the
// jar's csrf cookie in `x-csrf-token` (signed double-submit).
//
//   Local:  npm run dev   (in another terminal)  →  npm run smoke
//   CI:     started by the workflow before this runs.

const BASE = process.env.API_URL || 'http://localhost:3001'
const results = []
let pass = 0, fail = 0
const rnd = Math.floor(Math.random() * 1e6)

// ── cookie-jar identities ────────────────────────────────────
const makeJar = () => ({})
const absorbCookies = (res, jar) => {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [kv] = c.split(';')
    const eq = kv.indexOf('=')
    if (eq > 0) jar[kv.slice(0, eq).trim()] = kv.slice(eq + 1)
  }
}
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')

// `as` is an identity's cookie jar (or undefined for unauthenticated calls).
// Response Set-Cookie headers are absorbed back into the jar, browser-style,
// so a login call with a fresh jar leaves that jar holding the session.
async function call(name, method, path, { as, body, expect = [200, 201] } = {}) {
  const headers = {}
  if (as && Object.keys(as).length) headers['Cookie'] = cookieHeader(as)
  if (as?.mpl_csrf && method !== 'GET') headers['x-csrf-token'] = as.mpl_csrf
  if (body) headers['Content-Type'] = 'application/json'
  let code = 0, json = {}
  try {
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    code = res.status
    if (as) absorbCookies(res, as)
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

  // auth — each identity gets a jar; success = session cookie present, no body token
  const ADMIN = makeJar(), CLIENT = makeJar()
  const a = await call('POST /auth/admin/login', 'POST', '/api/auth/admin/login', { as: ADMIN, body: { email: 'admin@mpl.com', password: 'admin1234' } })
  if (!ADMIN.mpl_session) {
    console.error('FATAL: could not obtain an admin session cookie — is the DB seeded?')
    process.exit(1)
  }

  // users (admin) — the created klien doubles as this run's CLIENT identity
  await call('GET /users', 'GET', '/api/users', { as: ADMIN })
  const created = await call('POST /users (create klien)', 'POST', '/api/users', { as: ADMIN, body: { fullName: 'Smoke Klien', email: `smoke${rnd}@t.com`, companyName: 'SmokeCo' }, expect: [201] })
  const NEW_ID = created.json.user?.id
  const tempPassword = created.json.temporaryPassword
  const c = await call('POST /auth/login (bootstrapped klien)', 'POST', '/api/auth/login', { as: CLIENT, body: { email: `smoke${rnd}@t.com`, password: tempPassword || 'missing' }, expect: [200] })
  if (!CLIENT.mpl_session) {
    console.error('FATAL: could not obtain a client session — create-klien temporaryPassword flow broken?')
    process.exit(1)
  }
  // the Bearer world must stay dead: no token in the login body
  const noToken = !('token' in a.json) && !('token' in c.json)
  noToken ? pass++ : fail++
  results.push({ name: 'login body carries no legacy token', code: noToken ? 200 : 500, ok: noToken, msg: noToken ? '' : 'token field re-appeared' })

  await call('GET /users/me (client)', 'GET', '/api/users/me', { as: CLIENT })
  await call('GET /users/companies', 'GET', '/api/users/companies', { as: ADMIN })
  if (NEW_ID) await call('PATCH /users/:id/verify', 'PATCH', `/api/users/${NEW_ID}/verify`, { as: ADMIN })

  // CSRF is enforced for cookie-authenticated mutations: same session, missing header → 403
  {
    const res = await fetch(BASE + '/api/users', { method: 'POST', headers: { Cookie: cookieHeader(ADMIN), 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: 'CSRF Probe', email: `csrf${rnd}@t.com` }) })
    const ok = res.status === 403
    ok ? pass++ : fail++
    results.push({ name: 'POST /users without x-csrf-token -> 403', code: res.status, ok, msg: ok ? '' : 'CSRF not enforced' })
  }

  // shipments
  const ship = await call('POST /shipments (client)', 'POST', '/api/shipments', { as: CLIENT, body: { packageType: 'Box', weightKg: 5, serviceLevel: 'Darat', originLocation: 'Jakarta', destinationLocation: 'Bandung' }, expect: [201] })
  const SHIP = ship.json.shipment?.id
  await call('GET /shipments', 'GET', '/api/shipments', { as: CLIENT })
  const stats = await call('GET /shipments/stats', 'GET', '/api/shipments/stats?period=monthly', { as: CLIENT })
  // `active` (added 2026-09-22): every in-flight status, unwindowed by createdAt — additive
  // field, so just assert it exists and is numeric rather than an exact count (the exact
  // count depends on whatever liveish-seeded ongoing shipments are in the DB at run time).
  const activeIsNumeric = typeof stats.json.active === 'number'
  activeIsNumeric ? pass++ : fail++
  results.push({ name: 'GET /shipments/stats returns numeric `active`', code: stats.code, ok: activeIsNumeric, msg: activeIsNumeric ? '' : `active was ${typeof stats.json.active}` })

  // fleet
  const driver = await call('POST /fleet/drivers', 'POST', '/api/fleet/drivers', { as: ADMIN, body: { fullName: 'Smoke Driver', phoneNumber: '0812' }, expect: [201] })
  const DRIVER = driver.json.driver?.id
  const vehicle = await call('POST /fleet/vehicles', 'POST', '/api/fleet/vehicles', { as: ADMIN, body: { type: 'Van', licensePlate: `S${rnd}` }, expect: [201] })
  const VEHICLE = vehicle.json.vehicle?.id
  await call('GET /fleet/drivers', 'GET', '/api/fleet/drivers', { as: ADMIN })
  await call('GET /fleet/vehicles', 'GET', '/api/fleet/vehicles', { as: ADMIN })

  // assign + status + tracking
  if (SHIP && DRIVER && VEHICLE) await call('PATCH /shipments/:id/assign', 'PATCH', `/api/shipments/${encodeURIComponent(SHIP)}/assign`, { as: ADMIN, body: { driverId: DRIVER, vehicleId: VEHICLE } })
  // /assign must mirror the fleet: SHIP went PENDING -> DITUGASKAN on assign, so the
  // driver should now be ON_DUTY (previously stayed ACTIVE — the bug this regression-tests).
  if (DRIVER) {
    const fd = await call('GET /fleet/drivers (post-assign mirror check)', 'GET', '/api/fleet/drivers', { as: ADMIN })
    const mirrored = (fd.json.drivers || []).find(d => d.id === DRIVER)?.status === 'ON_DUTY'
    mirrored ? pass++ : fail++
    results.push({ name: '/assign mirrors driver to ON_DUTY', code: fd.code, ok: mirrored, msg: mirrored ? '' : 'driver did not engage' })
  }
  if (SHIP) await call('PATCH /shipments/:id/status', 'PATCH', `/api/shipments/${encodeURIComponent(SHIP)}/status`, { as: ADMIN, body: { status: 'TRANSIT', currentProgressPercent: 30 } })
  if (SHIP) await call('GET /tracking/:id', 'GET', `/api/tracking/${encodeURIComponent(SHIP)}`, { as: CLIENT })
  let EVENT
  if (SHIP) {
    const ev = await call('POST /tracking/:id/events', 'POST', `/api/tracking/${encodeURIComponent(SHIP)}/events`, { as: ADMIN, body: { stepName: 'Picked up', location: 'JKT', status: 'DONE', eventTimestamp: '2026-06-20T08:00:00Z' }, expect: [200, 201] })
    EVENT = ev.json.event?.id
  }
  if (EVENT) await call('PATCH /tracking/events/:id', 'PATCH', `/api/tracking/events/${EVENT}`, { as: ADMIN, body: { status: 'DONE' } })
  // finish trip 1 → frees the driver (departure guard allows one TRANSIT per driver,
  // so the pipeline shipment below could not depart while this one is on the road)
  if (SHIP) await call('PATCH /shipments/:id/status (-> DELIVERED, frees driver)', 'PATCH', `/api/shipments/${encodeURIComponent(SHIP)}/status`, { as: ADMIN, body: { status: 'DELIVERED' } })

  // plant-check → handover → condition-analytics (Kepala Armada → Kepala Gudang pipeline)
  const ship2 = await call('POST /shipments (client, pipeline)', 'POST', '/api/shipments', { as: CLIENT, body: { packageType: 'Unit', weightKg: 120, serviceLevel: 'Darat', originLocation: 'Jakarta', destinationLocation: 'Semarang', shippingCategory: 'Unit' }, expect: [201] })
  const SHIP2 = ship2.json.shipment?.id
  if (SHIP2 && DRIVER && VEHICLE) await call('PATCH /shipments/:id/assign (pipeline)', 'PATCH', `/api/shipments/${encodeURIComponent(SHIP2)}/assign`, { as: ADMIN, body: { driverId: DRIVER, vehicleId: VEHICLE } })
  if (SHIP2) await call('PATCH /shipments/:id/status (-> AT_PLANT)', 'PATCH', `/api/shipments/${encodeURIComponent(SHIP2)}/status`, { as: ADMIN, body: { status: 'AT_PLANT' } })
  if (SHIP2) {
    await call('PATCH /shipments/:id/plant-check', 'PATCH', `/api/shipments/${encodeURIComponent(SHIP2)}/plant-check`, {
      as: ADMIN,
      body: {
        dataPengiriman: [{ tipeMotor: 'Honda Beat', jumlah: 2, satuan: 'unit' }],
        lku: [
          { tipeMotor: 'Honda Beat', noMesin: `M${rnd}A`, noRangka: `R${rnd}A`, warna: 'Merah' },
          { tipeMotor: 'Honda Beat', noMesin: `M${rnd}B`, noRangka: `R${rnd}B`, warna: 'Hitam' },
        ],
      },
    })
  }
  if (SHIP2) await call('PATCH /shipments/:id/status (-> DITERIMA)', 'PATCH', `/api/shipments/${encodeURIComponent(SHIP2)}/status`, { as: ADMIN, body: { status: 'DITERIMA' } })
  if (SHIP2) await call('PATCH /shipments/:id/status (-> DITURUNKAN)', 'PATCH', `/api/shipments/${encodeURIComponent(SHIP2)}/status`, { as: ADMIN, body: { status: 'DITURUNKAN' } })
  if (SHIP2) {
    const detail = await call('GET /shipments/:id (fetch LKU ids)', 'GET', `/api/shipments/${encodeURIComponent(SHIP2)}`, { as: ADMIN })
    const lkuRows = detail.json.shipment?.plantCheck?.lku || []
    const lkuUpdates = lkuRows.map((r, i) => ({ id: r.id, arrivedDefective: i === 0, arrivalNote: i === 0 ? 'Lecet saat bongkar' : null }))
    await call('PATCH /shipments/:id/handover (with lkuUpdates)', 'PATCH', `/api/shipments/${encodeURIComponent(SHIP2)}/handover`, { as: ADMIN, body: { catatanGudangPenerima: 'Smoke handover', lkuUpdates } })
  }
  await call('GET /shipments/condition-analytics', 'GET', '/api/shipments/condition-analytics?range=month', { as: ADMIN })
  await call('GET /shipments/condition-analytics?category=Unit', 'GET', '/api/shipments/condition-analytics?range=month&category=Unit', { as: ADMIN })
  await call('GET /shipments/condition-analytics?category=Cargo', 'GET', '/api/shipments/condition-analytics?range=month&category=Cargo', { as: ADMIN })

  // OPERATIONS exists and logs in (seed: admin2@mpl.com — replaced ops@mpl.com 2026-09-22)
  const OPS = makeJar()
  await call('POST /auth/admin/login (operations)', 'POST', '/api/auth/admin/login', { as: OPS, body: { email: 'admin2@mpl.com', password: 'admin1234' }, expect: [200] })

  // status guard on /handover: a NON-override role may not handover a shipment that hasn't
  // reached DITURUNKAN (PENDING → DELIVERED is not a forward move). OPERATIONS gained
  // status:override on 2026-09-22, so PIC Gudang is the guard's test subject now.
  const GUDANG = makeJar()
  await call('POST /auth/admin/login (gudang)', 'POST', '/api/auth/admin/login', { as: GUDANG, body: { email: 'gudang@mpl.com', password: 'gudang1234' }, expect: [200] })
  const ship3 = await call('POST /shipments (client, guard check)', 'POST', '/api/shipments', { as: CLIENT, body: { packageType: 'Unit', weightKg: 100, serviceLevel: 'Darat', originLocation: 'Jakarta', destinationLocation: 'Solo' }, expect: [201] })
  const SHIP3 = ship3.json.shipment?.id
  if (GUDANG.mpl_session && SHIP3) await call('PATCH /shipments/:id/handover (guard rejects PENDING -> 403)', 'PATCH', `/api/shipments/${encodeURIComponent(SHIP3)}/handover`, { as: GUDANG, body: { catatanGudangPenerima: 'x' }, expect: [403] })

  // notifications
  await call('GET /notifications', 'GET', '/api/notifications', { as: CLIENT })
  await call('GET /admin-notifications', 'GET', '/api/admin-notifications', { as: ADMIN })

  // admin self-service profile (Profil page): self-update + self-scoped activity log
  {
    const before = await call('GET /auth/admin/me (before rename)', 'GET', '/api/auth/admin/me', { as: ADMIN })
    const originalName = before.json.admin?.fullName
    const renamed = await call('PATCH /auth/admin/me (rename)', 'PATCH', '/api/auth/admin/me', { as: ADMIN, body: { fullName: `Smoke Admin ${rnd}` } })
    const nameChanged = renamed.json.admin?.fullName === `Smoke Admin ${rnd}`
    nameChanged ? pass++ : fail++
    results.push({ name: 'PATCH /auth/admin/me actually changes fullName', code: renamed.code, ok: nameChanged, msg: nameChanged ? '' : 'fullName did not change' })
    if (originalName) await call('PATCH /auth/admin/me (restore name)', 'PATCH', '/api/auth/admin/me', { as: ADMIN, body: { fullName: originalName } })

    const mine = await call('GET /audit-logs/me', 'GET', '/api/audit-logs/me', { as: ADMIN })
    const onlyMine = (mine.json.logs || []).every(l => l.admin?.id === before.json.admin?.id)
    onlyMine ? pass++ : fail++
    results.push({ name: 'GET /audit-logs/me returns only the caller\'s own rows', code: mine.code, ok: onlyMine, msg: onlyMine ? '' : 'another admin\'s row leaked' })
  }

  // onboarding — magic-link registration lifecycle (generate → validate → register → verify → login)
  const picEmail = `pic${rnd}@t.com`
  let NEW_PIC_ID
  const gen = await call('POST /users/magic-link (generate)', 'POST', '/api/users/magic-link', { as: ADMIN, body: { companyName: 'SmokeCo', accountType: 'client' }, expect: [201] })
  const mtoken = (gen.json.link || '').split('/').pop()
  if (mtoken) {
    await call('GET /users/magic-link/:token (validate)', 'GET', `/api/users/magic-link/${mtoken}`, { expect: [200] })
    const reg = await call('POST /users/magic-link/:token/register', 'POST', `/api/users/magic-link/${mtoken}/register`, { body: { fullName: 'PIC Smoke', email: picEmail, password: 'secret123', confirmPassword: 'secret123' }, expect: [201] })
    NEW_PIC_ID = reg.json.user?.id
    await call('POST /auth/registration-status (-> PENDING)', 'POST', '/api/auth/registration-status', { body: { email: picEmail }, expect: [200] })
    await call('POST /auth/login (pending -> 403)', 'POST', '/api/auth/login', { as: makeJar(), body: { email: picEmail, password: 'secret123' }, expect: [403] })
    if (NEW_PIC_ID) await call('PATCH /users/:id/verify (magic-link acct)', 'PATCH', `/api/users/${NEW_PIC_ID}/verify`, { as: ADMIN, expect: [200] })
    await call('POST /auth/registration-status (-> VERIFIED)', 'POST', '/api/auth/registration-status', { body: { email: picEmail }, expect: [200] })
    await call('POST /auth/login (verified -> 200)', 'POST', '/api/auth/login', { as: makeJar(), body: { email: picEmail, password: 'secret123' }, expect: [200] })
  }

  // permission guard — pipeline roles (PIC Gudang) may NOT manage clients
  if (GUDANG.mpl_session) {
    await call('POST /users (gudang blocked -> 403)', 'POST', '/api/users', { as: GUDANG, body: { fullName: 'Nope', email: `nope${rnd}@t.com` }, expect: [403] })
    await call('POST /users/magic-link (gudang blocked -> 403)', 'POST', '/api/users/magic-link', { as: GUDANG, body: { companyName: 'SmokeCo' }, expect: [403] })
  }

  // ── cleanup: remove everything this run created so the dev DB stays clean ──
  const del = async (path) => {
    try {
      const r = await fetch(BASE + path, { method: 'DELETE', headers: { Cookie: cookieHeader(ADMIN), 'x-csrf-token': ADMIN.mpl_csrf || '' } })
      return r.ok
    } catch { return false }
  }
  let cleaned = 0
  if (SHIP)       cleaned += (await del(`/api/shipments/${encodeURIComponent(SHIP)}`)) ? 1 : 0
  if (SHIP2)      cleaned += (await del(`/api/shipments/${encodeURIComponent(SHIP2)}`)) ? 1 : 0
  if (SHIP3)      cleaned += (await del(`/api/shipments/${encodeURIComponent(SHIP3)}`)) ? 1 : 0
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
