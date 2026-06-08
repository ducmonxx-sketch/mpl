import { useState, useEffect } from 'react'
import Icon from '../../components/Icon'
import { invoicesAPI } from '../../lib/api'

const formatIDR = (num) => {
  if (num === null || num === undefined || isNaN(Number(num))) return '-'
  return 'Rp ' + Number(num).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_LABELS = {
  paid: 'Lunas',
  sent: 'Belum Dibayar',
  unpaid: 'Belum Dibayar',
  overdue: 'Lewat Jatuh Tempo',
  cancelled: 'Dibatalkan'
}

const STATUS_COLORS = {
  paid: 'ship-status--delivered', // green
  sent: 'ship-status--pending',   // gray/blue
  unpaid: 'ship-status--pending', // gray/blue
  overdue: 'ship-status--failed',  // red
  cancelled: 'ship-status--failed' // red
}

export default function InvoicesSection() {
  const [filter, setFilter] = useState('all')
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true)
      try {
        const res = await invoicesAPI.list()
        setInvoices(res.invoices || [])
      } catch (err) {
        console.error('Failed to fetch client invoices:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchInvoices()
  }, [])

  // Filter out DRAFT invoices for clients
  const clientInvoices = invoices.filter(inv => inv.status !== 'DRAFT')

  const filtered = clientInvoices.filter(inv => {
    const statusLower = inv.status.toLowerCase()
    if (filter === 'all') return true
    if (filter === 'unpaid') return statusLower === 'sent'
    if (filter === 'paid') return statusLower === 'paid'
    if (filter === 'overdue') return statusLower === 'overdue'
    return false
  })

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
          <h2 className="dash-header__title">Faktur &amp; Pembayaran</h2>
          <p className="dash-header__subtitle">Lihat riwayat tagihan dan status pembayaran Anda.</p>
        </div>
      </section>

      {/* Filter Tabs */}
      <div className="dash-header__tabs" style={{ marginTop: '1rem', display: 'inline-flex', gap: '0.5rem' }}>
        {filters.map(f => {
          const count = f.id === 'all' 
            ? clientInvoices.length 
            : clientInvoices.filter(inv => {
                const statusLower = inv.status.toLowerCase()
                if (f.id === 'unpaid') return statusLower === 'sent'
                if (f.id === 'paid') return statusLower === 'paid'
                if (f.id === 'overdue') return statusLower === 'overdue'
                return false
              }).length
          return (
            <button
              key={f.id}
              className={`dash-header__tab${filter === f.id ? ' dash-header__tab--active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label} <span style={{ marginLeft: '4px', opacity: 0.7, fontSize: '0.8em' }}>({count})</span>
            </button>
          )
        })}
      </div>

      <div className="hist-list" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <Icon name="sync" size={24} />
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>Memuat data faktur…</p>
          </div>
        ) : (
          <>
            {filtered.map(inv => {
              const statusLower = inv.status.toLowerCase()
              const label = STATUS_LABELS[statusLower] || statusLower
              const colorClass = STATUS_COLORS[statusLower] || 'ship-status--pending'
              const dueDateFormatted = new Date(inv.dueDate).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })

              return (
                <div key={inv.id} className="hist-item glass-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '1.25rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <div className="ship-card__icon-wrap"><Icon name="receipt" size={20} /></div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--dash-primary)' }}>{inv.invoiceNumber}</h4>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Pengiriman: {inv.shipmentId}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--dash-primary)' }}>{formatIDR(inv.totalAmount)}</h3>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: '#64748b' }}>Jatuh Tempo: {dueDateFormatted}</p>
                    <span className={`ship-status ${colorClass}`} style={{ display: 'inline-block', marginTop: '0.5rem' }}>
                      {label}
                    </span>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                <Icon name="receipt_long" size={32} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                <p>Tidak ada faktur ditemukan.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
