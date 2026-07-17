export default function AdminStatusBadge({ status, type = 'shipment' }) {
  const configs = {
    shipment: {
      pending:    { label: 'Menunggu',          cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
      standby:    { label: 'Standby',           cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
      assigned:   { label: 'Ditugaskan',        cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
      at_plant:   { label: 'Di Pabrik',         cls: 'bg-purple-50 text-purple-700 border border-purple-200' },
      processing: { label: 'Diproses',          cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
      in_transit: { label: 'Dalam Perjalanan',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
      transit:    { label: 'Dalam Perjalanan',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
      diterima:   { label: 'Diterima',          cls: 'bg-cyan-50 text-cyan-700 border border-cyan-200' },
      diturunkan: { label: 'Diturunkan',        cls: 'bg-teal-50 text-teal-700 border border-teal-200' },
      delivered:  { label: 'Selesai',           cls: 'bg-green-50 text-green-700 border border-green-200' },
      cancelled:  { label: 'Dibatalkan',        cls: 'bg-red-50 text-red-700 border border-red-200' },
      failed:     { label: 'Dibatalkan',        cls: 'bg-red-50 text-red-700 border border-red-200' },
    },
    invoice: {
      draft: { label: 'Konsep', cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
      sent: { label: 'Terkirim', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
      unpaid: { label: 'Belum Dibayar', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
      paid: { label: 'Lunas', cls: 'bg-green-50 text-green-700 border border-green-200' },
      overdue: { label: 'Lewat Jatuh Tempo', cls: 'bg-red-50 text-red-700 border border-red-200' },
      cancelled: { label: 'Dibatalkan', cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
    },
    driver: {
      available: { label: 'Tersedia', cls: 'bg-green-50 text-green-700 border border-green-200' },
      standby: { label: 'Standby', cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
      on_duty: { label: 'Bertugas', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
      inactive: { label: 'Tidak Aktif', cls: 'bg-red-50 text-red-700 border border-red-200' },
    },
    user: {
      active: { label: 'Aktif', cls: 'bg-green-50 text-green-700 border border-green-200' },
      inactive: { label: 'Nonaktif', cls: 'bg-red-50 text-red-700 border border-red-200' },
    },
  }

  const normStatus = (status || '').toLowerCase()
  const cfg = configs[type]?.[normStatus] || { label: status, cls: 'bg-gray-100 text-gray-600 border border-gray-200' }

  return (
    <span className={`adm-status-badge inline-flex items-center px-2.5 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-wider ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}
