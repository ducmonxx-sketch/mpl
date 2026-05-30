export default function AdminStatusBadge({ status, type = 'shipment' }) {
  const configs = {
    shipment: {
      pending: { label: 'Menunggu', cls: 'adm-badge--pending' },
      processing: { label: 'Diproses', cls: 'adm-badge--processing' },
      in_transit: { label: 'Dalam Perjalanan', cls: 'adm-badge--transit' },
      delivered: { label: 'Terkirim', cls: 'adm-badge--delivered' },
      cancelled: { label: 'Dibatalkan', cls: 'adm-badge--cancelled' },
    },
    invoice: {
      unpaid: { label: 'Belum Dibayar', cls: 'adm-badge--pending' },
      paid: { label: 'Lunas', cls: 'adm-badge--delivered' },
      overdue: { label: 'Lewat Jatuh Tempo', cls: 'adm-badge--failed' },
    },
    driver: {
      available: { label: 'Tersedia', cls: 'adm-badge--delivered' },
      on_duty: { label: 'Bertugas', cls: 'adm-badge--transit' },
      inactive: { label: 'Tidak Aktif', cls: 'adm-badge--failed' },
    },
    user: {
      active: { label: 'Aktif', cls: 'adm-badge--delivered' },
      inactive: { label: 'Nonaktif', cls: 'adm-badge--failed' },
    },
  }

  const cfg = configs[type]?.[status] || { label: status, cls: 'adm-badge--pending' }

  return <span className={`adm-badge ${cfg.cls}`}>{cfg.label}</span>
}
