import { useState } from 'react'
import Icon from '../../components/Icon'

const formatIDR = (num) => 'Rp ' + num.toLocaleString('id-ID')

const INVOICES = [
  { id: 'INV-0091', shipmentId: 'MPL-0041', amount: 4500000, taxAmount: 495000, totalAmount: 4995000, dueDate: '15 Apr 2026', paymentStatus: 'overdue' },
  { id: 'INV-0090', shipmentId: 'MPL-0040', amount: 2200000, taxAmount: 242000, totalAmount: 2442000, dueDate: '25 Apr 2026', paymentStatus: 'unpaid' },
  { id: 'INV-0089', shipmentId: 'MPL-0037', amount: 6800000, taxAmount: 748000, totalAmount: 7548000, dueDate: '10 Apr 2026', paymentStatus: 'paid' },
]

const STATUS_LABELS = {
  paid: 'Lunas',
  unpaid: 'Belum Dibayar',
  overdue: 'Lewat Jatuh Tempo'
}

const STATUS_COLORS = {
  paid: 'ship-status--delivered', // reuse green
  unpaid: 'ship-status--pending',  // reuse gray/blue
  overdue: 'ship-status--failed'   // reuse red
}

export default function InvoicesSection() {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? INVOICES : INVOICES.filter(inv => inv.paymentStatus === filter)

  const filters = [
    { id: 'all', label: 'Semua' },
    { id: 'unpaid', label: 'Belum Dibayar' },
    { id: 'paid', label: 'Lunas' },
    { id: 'overdue', label: 'Lewat Jatuh Tempo' },
  ]

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Faktur & Pembayaran</h2>
          <p className="dash-header__subtitle">Lihat riwayat tagihan dan status pembayaran Anda.</p>
        </div>
      </section>

      {/* Filter Tabs */}
      <div className="dash-header__tabs" style={{ marginTop: '1rem', display: 'inline-flex', gap: '0.5rem' }}>
        {filters.map(f => (
          <button
            key={f.id}
            className={`dash-header__tab${filter === f.id ? ' dash-header__tab--active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="hist-list" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filtered.map(inv => (
          <div key={inv.id} className="hist-item glass-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '1.25rem', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div className="ship-card__icon-wrap"><Icon name="receipt" size={20} /></div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--dash-primary)' }}>{inv.id}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Pengiriman: {inv.shipmentId}</p>
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--dash-primary)' }}>{formatIDR(inv.totalAmount)}</h3>
              <p style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: '#64748b' }}>Jatuh Tempo: {inv.dueDate}</p>
              <span className={`ship-status ${STATUS_COLORS[inv.paymentStatus]}`} style={{ display: 'inline-block', marginTop: '0.5rem' }}>
                {STATUS_LABELS[inv.paymentStatus]}
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            <Icon name="receipt_long" size={32} style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <p>Tidak ada faktur ditemukan.</p>
          </div>
        )}
      </div>
    </div>
  )
}
