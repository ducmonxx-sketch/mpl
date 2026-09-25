// Canonical client-facing label + Tailwind pill classes for every ShipmentStatus enum
// value (schema.prisma's `ShipmentStatus`, 10 members incl. legacy `FAILED`). Keyed
// lowercase since every call site already lowercases `shipment.status` before lookup.
// Color language mirrors the admin dashboard's AdminStatusBadge (bg-x-50/text-x-700),
// so a status reads the same regardless of which dashboard you're looking at.
// Icon names must exist in the curated set in `components/Icon.jsx` (not the full
// Material Symbols catalog) — checked against it, not guessed.
// `accent` is a left-border color used to make a status readable at a glance from a
// row's edge, without re-reading the pill text — same hue family as `pill`.
export const SHIPMENT_STATUS_CONFIG = {
  pending:    { label: 'Menunggu',         icon: 'schedule',       pill: 'bg-gray-100 text-gray-600 border border-gray-200', accent: 'border-gray-300' },
  standby:    { label: 'Standby',          icon: 'pending_actions', pill: 'bg-indigo-50 text-indigo-700 border border-indigo-200', accent: 'border-indigo-400' },
  ditugaskan: { label: 'Ditugaskan',       icon: 'assignment',     pill: 'bg-blue-50 text-blue-700 border border-blue-200', accent: 'border-blue-400' },
  at_plant:   { label: 'Di Pabrik',        icon: 'warehouse',      pill: 'bg-purple-50 text-purple-700 border border-purple-200', accent: 'border-purple-400' },
  transit:    { label: 'Dalam Perjalanan', icon: 'local_shipping', pill: 'bg-amber-50 text-amber-700 border border-amber-200', accent: 'border-amber-400' },
  diterima:   { label: 'Diterima',         icon: 'inventory_2',    pill: 'bg-cyan-50 text-cyan-700 border border-cyan-200', accent: 'border-cyan-400' },
  diturunkan: { label: 'Diturunkan',       icon: 'download',       pill: 'bg-teal-50 text-teal-700 border border-teal-200', accent: 'border-teal-400' },
  delivered:  { label: 'Terkirim',         icon: 'check_circle',   pill: 'bg-green-50 text-green-700 border border-green-200', accent: 'border-green-400' },
  cancelled:  { label: 'Dibatalkan',       icon: 'cancel',         pill: 'bg-red-50 text-red-700 border border-red-200', accent: 'border-red-400' },
  failed:     { label: 'Dibatalkan',       icon: 'cancel',         pill: 'bg-red-50 text-red-700 border border-red-200', accent: 'border-red-400' },
}

export function getStatusConfig(status) {
  const key = (status || '').toLowerCase()
  return SHIPMENT_STATUS_CONFIG[key] || { label: status, icon: 'help_outline', pill: 'bg-gray-100 text-gray-600 border border-gray-200', accent: 'border-gray-300' }
}

// Three-bucket grouping for the Shipments page's quick filters (Semua/Aktif/Selesai/
// Dibatalkan) — the 7 in-flight statuses collapse into "active" so the filter row stays
// short; a "Lainnya" dropdown lets a client still drill into one specific active stage.
export const ACTIVE_STATUSES = ['pending', 'standby', 'ditugaskan', 'at_plant', 'transit', 'diterima', 'diturunkan']
export const DONE_STATUSES = ['delivered']
export const CANCELLED_STATUSES = ['cancelled', 'failed']

export function getStatusBucket(status) {
  const key = (status || '').toLowerCase()
  if (DONE_STATUSES.includes(key)) return 'done'
  if (CANCELLED_STATUSES.includes(key)) return 'cancelled'
  return 'active'
}

// Riwayat (History) only ever shows terminal statuses (delivered/failed/cancelled), and
// deliberately keeps "Gagal" (delivery failed) and "Dibatalkan" (cancelled) as distinct
// labels for a client reviewing past shipments — unlike SHIPMENT_STATUS_CONFIG above,
// which merges them into one "Dibatalkan" to mirror admin's operational view. Also uses
// "Selesai" instead of "Terkirim" for delivered, matching the Dashboard section's framing
// of a completed-shipments list. One source for HistorySection/HistoryTable/ReceiptModal,
// which previously each kept their own slightly different copy of this map.
export const HISTORY_STATUS_CONFIG = {
  delivered: { label: 'Selesai',    icon: 'check_circle', pill: 'bg-green-50 text-green-700 border border-green-200', accent: 'border-green-400' },
  failed:    { label: 'Gagal',      icon: 'warning',       pill: 'bg-red-50 text-red-700 border border-red-200', accent: 'border-red-400' },
  cancelled: { label: 'Dibatalkan', icon: 'cancel',        pill: 'bg-red-50 text-red-700 border border-red-200', accent: 'border-red-400' },
}

export function getHistoryStatusConfig(status) {
  const key = (status || '').toLowerCase()
  return HISTORY_STATUS_CONFIG[key] || { label: status, icon: 'help_outline', pill: 'bg-gray-100 text-gray-600 border border-gray-200', accent: 'border-gray-300' }
}
