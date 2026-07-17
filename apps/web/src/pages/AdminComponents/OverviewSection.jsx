import { useState, useEffect } from 'react'
import AdminKPICard from './components/AdminKPICard'
import AdminDataTable from './components/AdminDataTable'
import AdminStatusBadge from './components/AdminStatusBadge'
import Icon from '../../components/Icon'
import { shipmentsAPI, usersAPI, fleetAPI, auditLogsAPI, adminsAPI } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

const ACTIVITY_LIMIT = 12

// Map an AdminAuditLog actionType to a timeline icon + colors. Order matters:
// specific cases (create/delete/verify/send/reset) before the generic update/assign.
const ACTIVITY_VISUALS = [
  { test: (a) => a.startsWith('CREATE_') || a === 'ADD_SHIPMENT_EVENT', icon: 'add', color: 'text-green-600', bg: 'bg-green-50' },
  { test: (a) => a.startsWith('DELETE_') || a === 'REJECT_USER' || a === 'CANCEL_INVOICE', icon: 'delete', color: 'text-red-500', bg: 'bg-red-50' },
  { test: (a) => a === 'VERIFY_USER' || a === 'MARK_INVOICE_PAID', icon: 'verified', color: 'text-[#d49811]', bg: 'bg-[#fec330]/20' },
  { test: (a) => a === 'SEND_INVOICE' || a === 'SEND_WHATSAPP_DRIVER' || a === 'GENERATE_MAGIC_LINK', icon: 'send', color: 'text-purple-500', bg: 'bg-purple-50' },
  { test: (a) => a === 'RESET_PASSWORD', icon: 'lock_reset', color: 'text-amber-600', bg: 'bg-amber-50' },
  { test: (a) => a.startsWith('UPDATE_') || a.startsWith('ASSIGN_'), icon: 'edit', color: 'text-blue-500', bg: 'bg-blue-50' },
]

function activityVisual(actionType) {
  const a = actionType || ''
  return ACTIVITY_VISUALS.find((v) => v.test(a)) || { icon: 'history', color: 'text-gray-500', bg: 'bg-gray-100' }
}

function humanizeAction(actionType) {
  return `melakukan ${(actionType || 'aksi').replace(/_/g, ' ').toLowerCase()}`
}

function relativeTime(iso) {
  if (!iso) return '-'
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diffSec < 60) return 'Baru saja'
  const min = Math.floor(diffSec / 60)
  if (min < 60) return `${min} menit lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'Kemarin'
  if (day < 7) return `${day} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Uppercase Indonesian status labels (mirrors AdminStatusBadge). Shipment + invoice
// statuses are the only enum tokens that appear in "Status X → Y" audit summaries.
const STATUS_LABELS = {
  PENDING: 'MENUNGGU',
  DITUGASKAN: 'DITUGASKAN',
  TRANSIT: 'DALAM PERJALANAN',
  DELIVERED: 'TERKIRIM',
  FAILED: 'DIBATALKAN',
  CANCELLED: 'DIBATALKAN',
  DRAFT: 'KONSEP',
  SENT: 'TERKIRIM',
  PAID: 'LUNAS',
  OVERDUE: 'LEWAT JATUH TEMPO',
}

// English → Indonesian for every AdminAuditLog summary template. Each rule is a
// full-line (^…$) match with capture groups, so the entity detail is preserved and
// no fragment is ever replaced by accident. "Status …" changes are handled separately.
const SUMMARY_RULES = [
  [/^Created driver (.+)$/, 'Menambahkan driver $1'],
  [/^Updated driver (.+)$/, 'Memperbarui data driver $1'],
  [/^Deleted driver (.+)$/, 'Menghapus driver $1'],
  [/^Created vehicle (.+)$/, 'Menambahkan kendaraan $1'],
  [/^Updated vehicle (.+)$/, 'Memperbarui kendaraan $1'],
  [/^Deleted vehicle (.+)$/, 'Menghapus kendaraan $1'],
  [/^Paired driver (.+) as primary driver of vehicle (.+)$/, 'Memasangkan driver $1 sebagai driver utama kendaraan $2'],
  [/^Unpaired driver from vehicle (.+)$/, 'Melepaskan driver utama dari kendaraan $1'],
  [/^Assigned driver (.+) and vehicle (.+)$/, 'Menugaskan driver $1 dan kendaraan $2'],
  [/^Sent WhatsApp assignment notification to driver (.+)$/, 'Mengirim notifikasi WhatsApp ke driver $1'],
  [/^Created client (.+)$/, 'Menambahkan klien $1'],
  [/^Updated client (.+)$/, 'Memperbarui data klien $1'],
  [/^Deleted client (.+) and related shipments\/invoices$/, 'Menghapus klien $1 beserta pengiriman/invoice terkait'],
  [/^Verified user (.+)$/, 'Memverifikasi klien $1'],
  [/^Rejected user (.+)$/, 'Menolak klien $1'],
  [/^Generated registration magic link for (.+)$/, 'Membuat magic link registrasi untuk $1'],
  [/^Generated password reset link for (.+)$/, 'Membuat link reset password untuk $1'],
  [/^Added checkpoint: (.+) at (.+)$/, 'Menambahkan checkpoint: $1 di $2'],
  [/^Created invoice (.+) for shipment (.+)$/, 'Membuat invoice $1 untuk pengiriman $2'],
  [/^Sent invoice (.+) to client$/, 'Mengirim invoice $1 ke klien'],
  [/^Marked invoice (.+) as paid$/, 'Menandai invoice $1 sebagai lunas'],
  [/^Cancelled invoice (.+)$/, 'Membatalkan invoice $1'],
  [/^Created admin (.+) \((.+)\)$/, 'Membuat admin $1 ($2)'],
  [/^Reset password for admin (.+)$/, 'Mereset password admin $1'],
  [/^Changed own password$/, 'Mengubah password sendiri'],
]

// Localize an audit-log changesSummary to Indonesian for display. Falls back to the raw
// summary if the format is unrecognized, so nothing is ever hidden from the audit trail.
function formatAuditSummary(summary) {
  if (!summary) return ''
  const status = summary.match(/^Status (\S+) → (\S+)(?: \((reversal|override) by (\w+)\))?$/)
  if (status) {
    const [, from, to, kind, role] = status
    const f = STATUS_LABELS[from] || from
    const t = STATUS_LABELS[to] || to
    let out = `Mengubah status ${f} → ${t}`
    if (kind === 'reversal') out += ` (dikembalikan oleh ${role})`
    else if (kind === 'override') out += ` (diubah paksa oleh ${role})`
    return out
  }
  for (const [re, rep] of SUMMARY_RULES) {
    if (re.test(summary)) return summary.replace(re, rep)
  }
  return summary
}

export default function OverviewSection({ onChangeNav, onNavigateToShipment, userRole }) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPERADMIN'

  const [recentShipments, setRecentShipments] = useState([])
  const [kpiData, setKpiData] = useState({ activeShipments: 0, totalClients: 0, availableDrivers: 0, unassignedDrivers: 0 })
  const [loading, setLoading] = useState(true)

  // Activity log (SUPERADMIN only) — normal-admin (OPERATIONS/SUPPORT) actions.
  const [activities, setActivities] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityTotal, setActivityTotal] = useState(0)
  const [adminOptions, setAdminOptions] = useState([])
  const [filterAdminId, setFilterAdminId] = useState('')

  async function loadActivities({ append = false } = {}) {
    setActivityLoading(true)
    try {
      const offset = append ? activities.length : 0
      const data = await auditLogsAPI.list({
        scope: 'normal',
        limit: ACTIVITY_LIMIT,
        offset,
        ...(filterAdminId ? { adminId: filterAdminId } : {}),
      })
      const logs = data.logs || []
      setActivityTotal(data.total || 0)
      setActivities((prev) => (append ? [...prev, ...logs] : logs))
    } catch (err) {
      console.error('Failed to fetch activity log:', err)
    } finally {
      setActivityLoading(false)
    }
  }

  // Reload from the top whenever the admin filter changes (and on first load).
  useEffect(() => {
    if (isSuperAdmin) loadActivities({ append: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, filterAdminId])

  // Populate the filter dropdown with normal admins (SUPERADMIN only).
  useEffect(() => {
    if (!isSuperAdmin) return
    adminsAPI.list()
      .then((data) => setAdminOptions((data.admins || []).filter((a) => a.role !== 'SUPERADMIN')))
      .catch(() => { /* non-fatal: dropdown just stays empty */ })
  }, [isSuperAdmin])

  useEffect(() => {
    async function fetchData() {
      try {
        const [shipmentsData, statsData] = await Promise.all([
          shipmentsAPI.list(),
          shipmentsAPI.getStats('monthly'),
        ])

        const shipments = shipmentsData.shipments || []
        setRecentShipments(shipments.slice(0, 5).map(s => ({
          id: s.id,
          client: s.client?.companyName || s.client?.fullName || '-',
          serviceType: s.serviceLevel || 'Darat',
          destinationCity: s.destinationLocation,
          status: s.status.toLowerCase() === 'transit' ? 'in_transit' : s.status.toLowerCase(),
          pickupDate: s.pickupDate ? new Date(s.pickupDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(s.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        })))

        setKpiData({
          activeShipments: statsData.transit || 0,
          totalClients: 0,
          availableDrivers: 0,
          unassignedDrivers: 0,
          pending: statsData.pending || 0,
          total: statsData.total || 0,
        })

        // Fetch users and drivers counts
        try {
          const [usersData, driversData] = await Promise.all([
            usersAPI.listAll(),
            fleetAPI.getDrivers(),
          ])
          const driversList = driversData.drivers || []
          // Driver is assigned if shipment is pending or transit
          const assignedDriverIds = new Set(
            shipments
              .filter(s => s.status === 'PENDING' || s.status === 'TRANSIT')
              .map(s => s.driverId)
              .filter(Boolean)
          )
          const unassignedCount = driversList.filter(
            d => d.status === 'ACTIVE' && !assignedDriverIds.has(d.id)
          ).length

          setKpiData(prev => ({
            ...prev,
            totalClients: (usersData.users || []).length,
            availableDrivers: driversList.filter(d => d.status === 'ACTIVE').length,
            unassignedDrivers: unassignedCount,
          }))
        } catch { /* Non-critical */ }
      } catch (err) {
        console.error('Failed to fetch overview data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const SERVICE_LABELS = { 'Darat': 'Darat', 'Laut': 'Laut', 'Udara': 'Udara' }

  const columns = [
    {
      key: 'id',
      label: 'ID Order',
      render: (v) => (
        <span
          className="adm-table__cell-main adm-clickable-id"
          onClick={(e) => { e.stopPropagation(); onNavigateToShipment?.(v) }}
          style={{ cursor: 'pointer', color: 'var(--dash-primary)', textDecoration: 'underline' }}
          title="Klik untuk melihat detail pengiriman"
        >
          {v}
        </span>
      ),
    },
    { key: 'client', label: 'Klien' },
    { key: 'serviceType', label: 'Layanan', render: (v) => SERVICE_LABELS[v] || v },
    { key: 'destinationCity', label: 'Tujuan' },
    { key: 'status', label: 'Status', render: (v) => <AdminStatusBadge status={v} type="shipment" /> },
    { key: 'pickupDate', label: 'Tanggal' },
  ]

  useEffect(() => {
    // Activities will be loaded via the other useEffect if isSuperAdmin
  }, [loading]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] text-gray-500">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#fec330] rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Memuat data beranda...</p>
      </div>
    )
  }

  const hasMoreActivities = activities.length < activityTotal

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto w-full pb-10">
      
      {/* Command Center Header */}
      <section className="adm-overview-header flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-200 pb-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-black text-[#002442] tracking-tight">Command Center</h2>
          </div>
          <p className="text-sm text-gray-500 font-medium">Ikhtisar operasional & log aktivitas PT Mahkota Putra Logistik.</p>
        </div>
      </section>

      {/* Grid Layout: 70/30 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Pane: Vitals & Shipments (70% for SUPERADMIN, full width otherwise) */}
        <div className={`${isSuperAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} flex flex-col gap-8`}>
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <AdminKPICard icon="local_shipping" label="Pengiriman Aktif" sublabel="Dalam Perjalanan" value={String(kpiData.activeShipments)} trend={`${kpiData.unassignedDrivers} menunggu`} color="primary" delay={0.05} onClick={() => onChangeNav?.('tracking')} />
            <AdminKPICard icon="receipt" label="Total Pengiriman" sublabel="Semua Transaksi" value={String(kpiData.total || 0)} color="gold" delay={0.1} onClick={() => onChangeNav?.('shipments')} />
            {!['KEPALA_ARMADA', 'PIC_PABRIK', 'PIC_GUDANG'].includes(userRole) && (
              <AdminKPICard icon="people" label="Total Klien" sublabel="Perusahaan Terdaftar" value={String(kpiData.totalClients)} color="green" delay={0.15} onClick={() => onChangeNav?.('clients')} />
            )}
            {!['PIC_PABRIK', 'PIC_GUDANG'].includes(userRole) && (
              <AdminKPICard icon="directions_car" label="Driver Tersedia" sublabel="Standby" value={String(kpiData.availableDrivers)} color="primary" delay={0.2} onClick={() => onChangeNav?.('drivers')} />
            )}
          </div>

          {/* Recent Shipments */}
          <div className="adm-recent-shipments bg-white border border-gray-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 md:p-8 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-[#002442]">Pengiriman Terbaru / Recent Shipments</h3>
              <button 
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-[#002442] bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
                onClick={() => onChangeNav?.('shipments')}
              >
                Lihat Semua <Icon name="chevron_right" size={16} />
              </button>
            </div>
            <AdminDataTable columns={columns} data={recentShipments} />
          </div>

        </div>

        {/* Right Pane: Activity Feed (30%) — SUPERADMIN only */}
        {isSuperAdmin && (
          <div className="lg:col-span-1 relative">
            {/* On lg the card is pinned to fill the stretched grid cell (= left column height)
                so the panel matches "Pengiriman Terbaru" and the log list scrolls inside it. */}
            <div className="adm-activity-log-card bg-white border border-gray-200 rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] p-6 md:p-8 flex flex-col lg:absolute lg:inset-0">
              <div className="flex items-center justify-between mb-2 pb-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-[#002442] flex items-center gap-2">
                  <Icon name="history" size={20} className="text-[#fec330]" />
                  Log Aktivitas
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Live</span>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-2 mb-3">Aktivitas admin operasional &amp; support.</p>

              {/* Filter by admin name */}
              <div className="relative mb-5">
                <Icon name="filter_list" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={filterAdminId}
                  onChange={(e) => setFilterAdminId(e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-sm font-medium text-[#002442] bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-dash-secondary/20 focus:border-dash-secondary outline-none transition-all cursor-pointer"
                >
                  <option value="">Semua Admin</option>
                  {adminOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.fullName}</option>
                  ))}
                </select>
                <Icon name="expand_more" size={18} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {activityLoading && activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <div className="w-6 h-6 border-4 border-gray-200 border-t-[#fec330] rounded-full animate-spin mb-3" />
                  <p className="text-sm">Memuat aktivitas...</p>
                </div>
              ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
                  <Icon name="history" size={32} className="mb-2 opacity-40" />
                  <p className="text-sm">{filterAdminId ? 'Belum ada aktivitas untuk admin ini.' : 'Belum ada aktivitas admin.'}</p>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 -mr-2 max-h-[560px] lg:max-h-none">
                  <div className="flex flex-col gap-6 relative">
                    {/* Vertical Timeline Line */}
                    <div className="absolute left-[19px] top-2 bottom-2 w-[2px] bg-gray-100 rounded-full" />

                    {activities.map((log) => {
                      const v = activityVisual(log.actionType)
                      return (
                        <div key={log.id} className="adm-activity-log-item relative z-10 flex gap-4">
                          <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${v.bg} ${v.color}`}>
                            <Icon name={v.icon} size={18} />
                          </div>
                          <div className="flex flex-col pt-1">
                            <p className="text-sm text-gray-700 leading-snug">
                              <span className="font-bold text-[#002442]">{log.admin?.fullName || 'Sistem'}</span> {formatAuditSummary(log.changesSummary) || humanizeAction(log.actionType)}
                            </p>
                            <span className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                              {relativeTime(log.timestamp)}{log.admin?.role ? ` · ${log.admin.role}` : ''}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {hasMoreActivities && (
                <button
                  className="mt-8 w-full py-3 border border-dashed border-gray-300 rounded-xl text-sm font-bold text-gray-500 hover:text-[#002442] hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-60"
                  onClick={() => loadActivities({ append: true })}
                  disabled={activityLoading}
                >
                  {activityLoading ? 'Memuat...' : 'Muat Lebih Banyak'}
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
