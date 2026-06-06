import { useState, useEffect } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import AdminDataTable from './components/AdminDataTable'
import AdminStatusBadge from './components/AdminStatusBadge'
import AdminPagination from './components/AdminPagination'
import AdminModal from './components/AdminModal'
import AdminFormField from './components/AdminFormField'
import { shipmentsAPI } from '../../lib/api'

const formatIDR = (num) => {
  if (num === null || num === undefined || isNaN(Number(num))) return '-'
  return 'Rp ' + Number(num).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function InvoicesSection() {
  const { showToast } = useToast()
  const [filter, setFilter] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [INVOICES, setINVOICES] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true)
      try {
        const data = await shipmentsAPI.list()
        const mapped = (data.shipments || []).map((s, idx) => {
          // Use s.price as the base amount (not weightKg * 15000)
          const amount = s.price ? Number(s.price) : 0
          const tax = amount * 0.11
          // Payment status: DELIVERED = paid, PENDING = unpaid, others = overdue
          let paymentStatus
          if (s.status === 'DELIVERED') {
            paymentStatus = 'paid'
          } else if (s.status === 'PENDING') {
            paymentStatus = 'unpaid'
          } else {
            paymentStatus = Math.random() > 0.5 ? 'unpaid' : 'overdue'
          }
          return {
            id: `INV-${String(idx + 1).padStart(4, '0')}`,
            shipmentId: s.id,
            client: s.client?.companyName || s.client?.fullName || '-',
            amount,
            taxAmount: tax,
            totalAmount: amount + tax,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
            paymentStatus,
            paidAt: paymentStatus === 'paid' ? new Date().toLocaleDateString('id-ID') : null,
            paymentNotes: '',
          }
        })
        setINVOICES(mapped)
      } catch (err) {
        console.error('Failed to fetch invoices:', err)
        showToast('Gagal memuat data faktur.', 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchInvoices()
  }, [])

  const filtered = INVOICES.filter(inv => {
    const matchStatus = filter === 'all' || inv.paymentStatus === filter
    const matchClient = filterClient === 'all' || inv.client === filterClient
    return matchStatus && matchClient
  })

  const totalAll = INVOICES.reduce((s, inv) => s + inv.totalAmount, 0)
  const totalPaid = INVOICES.filter(inv => inv.paymentStatus === 'paid').reduce((s, inv) => s + inv.totalAmount, 0)
  const totalUnpaid = totalAll - totalPaid

  const filters = [
    { id: 'all', label: 'Semua' },
    { id: 'unpaid', label: 'Belum Dibayar' },
    { id: 'paid', label: 'Lunas' },
    { id: 'overdue', label: 'Lewat Jatuh Tempo' },
  ]

  const columns = [
    { key: 'id', label: 'No. Faktur', render: (v) => <span className="adm-table__cell-main">{v}</span> },
    { key: 'client', label: 'Klien' },
    { key: 'totalAmount', label: 'Jumlah', render: (v) => <span style={{ fontWeight: 700 }}>{formatIDR(v)}</span> },
    { key: 'paymentStatus', label: 'Status', render: (v) => <AdminStatusBadge status={v} type="invoice" /> },
    { key: 'dueDate', label: 'Jatuh Tempo' },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="adm-actions">
          <button
            className="adm-action-btn"
            title="Detail"
            onClick={(e) => { e.stopPropagation(); setSelectedInvoice(row) }}
          >
            <Icon name="visibility" size={16} />
          </button>
          {row.paymentStatus !== 'paid' && (
            <button
              className="adm-action-btn"
              title="Tandai Lunas"
              onClick={(e) => { e.stopPropagation(); showToast(`${row.id} ditandai sebagai Lunas.`, 'success') }}
              style={{ color: 'var(--dash-tertiary-light)' }}
            >
              <Icon name="check_circle" size={16} />
            </button>
          )}
        </div>
      ),
    },
  ]

  const handleCreateInvoice = () => {
    showToast('Faktur baru berhasil dibuat!', 'success')
    setShowCreateModal(false)
  }

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Faktur &amp; Pembayaran</h2>
          <p className="dash-header__subtitle">Kelola faktur, lacak pembayaran, dan lihat ringkasan keuangan.</p>
        </div>
        <div className="adm-section-actions">
          <button className="adm-create-btn" onClick={() => setShowCreateModal(true)}>
            <Icon name="add" size={18} /> Buat Faktur
          </button>
        </div>
      </section>

      {/* Financial Summary — overflow:hidden prevents hover glitch bleed */}
      <div className="adm-finance-summary" style={{ overflow: 'hidden' }}>
        <div className="adm-finance-card adm-finance-card--total glass-card">
          <p className="adm-finance-card__label">Total Tagihan / Total Billing</p>
          {/* pointerEvents:none prevents h3 from stealing hover events */}
          <h3 className="adm-finance-card__value" style={{ pointerEvents: 'none' }}>{formatIDR(totalAll)}</h3>
        </div>
        <div className="adm-finance-card adm-finance-card--paid glass-card">
          <p className="adm-finance-card__label">Sudah Dibayar / Paid</p>
          <h3 className="adm-finance-card__value" style={{ pointerEvents: 'none' }}>{formatIDR(totalPaid)}</h3>
        </div>
        <div className="adm-finance-card adm-finance-card--unpaid glass-card">
          <p className="adm-finance-card__label">Belum Dibayar / Outstanding</p>
          <h3 className="adm-finance-card__value" style={{ pointerEvents: 'none' }}>{formatIDR(totalUnpaid)}</h3>
        </div>
      </div>

      {/* Filters */}
      <div className="adm-filters-dropdowns" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <select
          value={filterClient}
          onChange={(e) => { setFilterClient(e.target.value); setCurrentPage(1) }}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', minWidth: '200px' }}
        >
          <option value="all">Semua Klien (A-Z)</option>
          {Array.from(new Set(INVOICES.map(inv => inv.client))).sort().map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="adm-filters" style={{ marginTop: '1rem' }}>
        {filters.map(f => {
          const count =
            f.id === 'all'
              ? INVOICES.filter(inv => filterClient === 'all' || inv.client === filterClient).length
              : INVOICES.filter(
                  inv =>
                    inv.paymentStatus === f.id &&
                    (filterClient === 'all' || inv.client === filterClient)
                ).length
          return (
            <button
              key={f.id}
              className={`adm-filter-tab${filter === f.id ? ' adm-filter-tab--active' : ''}`}
              onClick={() => { setFilter(f.id); setCurrentPage(1) }}
            >
              {f.label} <span className="adm-filter-count">{count}</span>
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <AdminDataTable columns={columns} data={filtered} onRowClick={setSelectedInvoice} />
        <AdminPagination
          currentPage={currentPage}
          totalPages={1}
          totalItems={filtered.length}
          itemsPerPage={20}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Detail Panel */}
      {selectedInvoice && (
        <div className="adm-detail-panel glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <AdminStatusBadge status={selectedInvoice.paymentStatus} type="invoice" />
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--dash-primary)', margin: '0.5rem 0 0' }}>
                Detail Faktur {selectedInvoice.id}
              </h3>
            </div>
            <button className="adm-action-btn" onClick={() => setSelectedInvoice(null)}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="adm-detail-grid">
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="receipt" size={16} /> Informasi Faktur</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">No. Faktur</span><span className="adm-detail-value">{selectedInvoice.id}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">ID Pengiriman</span><span className="adm-detail-value">{selectedInvoice.shipmentId}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Klien</span><span className="adm-detail-value">{selectedInvoice.client}</span></div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Jatuh Tempo</span>
                <span className="adm-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedInvoice.dueDate}
                  <button
                    onClick={() => showToast('Jatuh tempo diperbarui.', 'success')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dash-primary)' }}
                    title="Ubah Jatuh Tempo"
                  >
                    <Icon name="edit" size={14} />
                  </button>
                </span>
              </div>
            </div>
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="payment" size={16} /> Rincian Pembayaran</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Subtotal</span><span className="adm-detail-value">{formatIDR(selectedInvoice.amount)}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">PPN (11%)</span><span className="adm-detail-value">{formatIDR(selectedInvoice.taxAmount)}</span></div>
              <div className="adm-detail-row" style={{ borderTop: '2px solid rgba(0,0,0,0.08)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                <span className="adm-detail-label" style={{ fontWeight: 800, color: 'var(--dash-primary)' }}>Total</span>
                <span className="adm-detail-value" style={{ fontSize: '1.1rem' }}>{formatIDR(selectedInvoice.totalAmount)}</span>
              </div>
              {selectedInvoice.paidAt && (
                <div className="adm-detail-row"><span className="adm-detail-label">Dibayar Pada</span><span className="adm-detail-value">{selectedInvoice.paidAt}</span></div>
              )}
              {selectedInvoice.paymentNotes && (
                <div className="adm-detail-row"><span className="adm-detail-label">Catatan</span><span className="adm-detail-value">{selectedInvoice.paymentNotes}</span></div>
              )}
            </div>
          </div>

          {selectedInvoice.paymentStatus === 'overdue' && (
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `${selectedInvoice.id} - ${formatIDR(selectedInvoice.totalAmount)} - Sudah jatuh tempo silahkan melakukan pembayaran ke nomor rekening xxxxxxxxx`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="adm-action-btn"
                style={{
                  background: '#25D366',
                  color: '#fff',
                  textDecoration: 'none',
                  padding: '0.6rem 1rem',
                  borderRadius: '8px',
                  width: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                }}
              >
                <Icon name="chat" size={18} /> Follow Up via WhatsApp
              </a>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <AdminModal
          title="Buat Faktur Baru"
          subtitle="Pilih pengiriman dan tentukan nominal."
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateInvoice}
          submitLabel="Simpan Faktur"
        >
          <div className="adm-form-grid">
            <AdminFormField label="Pengiriman Terkait" required fullWidth>
              <select defaultValue="">
                <option value="" disabled>Pilih Pengiriman...</option>
                <option>MPL-0041 - PT Sinar Jaya</option>
                <option>MPL-0038 - PT Karya Mandiri</option>
              </select>
            </AdminFormField>
            <AdminFormField label="Nominal (IDR)" required>
              <input type="number" placeholder="4500000" min="0" />
            </AdminFormField>
            <AdminFormField label="PPN (11%)">
              <input type="number" placeholder="495000" min="0" readOnly />
            </AdminFormField>
            <AdminFormField label="Jatuh Tempo" required>
              <input type="date" />
            </AdminFormField>
            <AdminFormField label="Catatan Pembayaran" fullWidth>
              <textarea placeholder="Cth: Transfer BCA xxxxxxx" />
            </AdminFormField>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
