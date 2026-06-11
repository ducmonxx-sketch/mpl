import { useState, useEffect } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import AdminDataTable from './components/AdminDataTable'
import AdminStatusBadge from './components/AdminStatusBadge'
import AdminPagination from './components/AdminPagination'
import AdminModal from './components/AdminModal'
import AdminFormField from './components/AdminFormField'
import SearchableSelect from './components/SearchableSelect'
import { shipmentsAPI, invoicesAPI } from '../../lib/api'

const formatIDR = (num) => {
  if (num === null || num === undefined || isNaN(Number(num))) return '-'
  return 'Rp ' + Number(num).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function InvoicesSection() {
  const { showToast } = useToast()
  const [filter, setFilter] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [INVOICES, setINVOICES] = useState([])
  const [loading, setLoading] = useState(true)

  // Create invoice form state
  const [availableShipments, setAvailableShipments] = useState([])
  const [formShipmentId, setFormShipmentId] = useState('')
  const [formSubtotal, setFormSubtotal] = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const fetchInvoices = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const data = await invoicesAPI.list()
      const mapped = (data.invoices || []).map((inv) => ({
        id: inv.invoiceNumber,
        dbId: inv.id,
        shipmentId: inv.shipmentId,
        client: inv.client?.companyName || inv.client?.fullName || '-',
        amount: Number(inv.subtotal),
        taxAmount: Number(inv.taxAmount),
        totalAmount: Number(inv.totalAmount),
        dueDate: new Date(inv.dueDate).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        paymentStatus: inv.status.toLowerCase(), // 'draft', 'sent', 'paid', 'overdue', 'cancelled'
        paidAt: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('id-ID') : null,
        paymentNotes: inv.notes || '',
        rawInvoice: inv
      }))
      setINVOICES(mapped)
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
      showToast('Gagal memuat data faktur.', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
    const interval = setInterval(() => fetchInvoices({ silent: true }), 8000)
    return () => clearInterval(interval)
  }, [])

  // Load shipments that don't have an invoice when create modal is opened
  useEffect(() => {
    if (showCreateModal) {
      async function loadShipments() {
        try {
          const res = await shipmentsAPI.list()
          const filteredShipments = (res.shipments || res || []).filter(s => !s.invoice)
          setAvailableShipments(filteredShipments)
          if (filteredShipments.length > 0) {
            setFormShipmentId(filteredShipments[0].id)
            const initialPrice = filteredShipments[0].price
            setFormSubtotal(initialPrice ? String(Number(initialPrice)) : '')
          } else {
            setFormShipmentId('')
            setFormSubtotal('')
          }
          setFormDueDate('')
          setFormNotes('')
        } catch (err) {
          console.error(err)
          showToast('Gagal memuat data pengiriman.', 'error')
        }
      }
      loadShipments()
    }
  }, [showCreateModal])

  const handleAction = async (actionFn, successMsg) => {
    if (!selectedInvoice) return
    try {
      const res = await actionFn(selectedInvoice.dbId)
      showToast(successMsg, 'success')
      await fetchInvoices()
      if (res && res.invoice) {
        const inv = res.invoice
        setSelectedInvoice({
          id: inv.invoiceNumber,
          dbId: inv.id,
          shipmentId: inv.shipmentId,
          client: selectedInvoice.client,
          amount: Number(inv.subtotal),
          taxAmount: Number(inv.taxAmount),
          totalAmount: Number(inv.totalAmount),
          dueDate: new Date(inv.dueDate).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
          paymentStatus: inv.status.toLowerCase(),
          paidAt: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('id-ID') : null,
          paymentNotes: inv.notes || '',
          rawInvoice: inv
        })
      } else {
        setSelectedInvoice(null)
      }
    } catch (err) {
      console.error(err)
      showToast(err.message || 'Gagal memproses aksi.', 'error')
    }
  }

  const handleCreateInvoice = async () => {
    if (!formShipmentId) {
      showToast('Pilih pengiriman terlebih dahulu.', 'error')
      return
    }
    if (!formSubtotal || Number(formSubtotal) <= 0) {
      showToast('Nominal subtotal harus lebih besar dari 0.', 'error')
      return
    }
    if (!formDueDate) {
      showToast('Tanggal jatuh tempo wajib diisi.', 'error')
      return
    }

    try {
      await invoicesAPI.create({
        shipmentId: formShipmentId,
        subtotal: Number(formSubtotal),
        taxRate: 11,
        dueDate: new Date(formDueDate).toISOString(),
        notes: formNotes || null
      })
      showToast('Faktur baru berhasil dibuat!', 'success')
      setShowCreateModal(false)
      fetchInvoices()
    } catch (err) {
      showToast(err.message || 'Gagal membuat faktur.', 'error')
    }
  }

  const filtered = INVOICES.filter(inv => {
    const isUnpaid = inv.paymentStatus === 'draft' || inv.paymentStatus === 'sent'
    const matchStatus =
      filter === 'all' ||
      (filter === 'unpaid' && isUnpaid) ||
      (filter === 'paid' && inv.paymentStatus === 'paid') ||
      (filter === 'overdue' && inv.paymentStatus === 'overdue')
    const matchClient = filterClient === 'all' || inv.client === filterClient
    const matchFilterStatus = filterStatus === 'all' || inv.paymentStatus === filterStatus
    return matchStatus && matchClient && matchFilterStatus
  })

  const totalAll = INVOICES.filter(inv => inv.paymentStatus !== 'cancelled').reduce((s, inv) => s + inv.totalAmount, 0)
  const totalPaid = INVOICES.filter(inv => inv.paymentStatus === 'paid').reduce((s, inv) => s + inv.totalAmount, 0)
  const totalUnpaid = INVOICES.filter(inv => inv.paymentStatus === 'draft' || inv.paymentStatus === 'sent' || inv.paymentStatus === 'overdue').reduce((s, inv) => s + inv.totalAmount, 0)

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
          {row.paymentStatus !== 'paid' && row.paymentStatus !== 'cancelled' && (
            <button
              className="adm-action-btn"
              title="Tandai Lunas"
              onClick={async (e) => {
                e.stopPropagation()
                try {
                  await invoicesAPI.markPaid(row.dbId)
                  showToast(`${row.id} ditandai sebagai Lunas.`, 'success')
                  fetchInvoices()
                } catch (err) {
                  showToast(err.message || 'Gagal menandai lunas.', 'error')
                }
              }}
              style={{ color: 'var(--dash-tertiary-light)' }}
            >
              <Icon name="check_circle" size={16} />
            </button>
          )}
        </div>
      ),
    },
  ]

  const ITEMS_PER_PAGE = 20
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

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

      {/* Financial Summary */}
      <div className="adm-finance-summary" style={{ overflow: 'hidden' }}>
        <div className="adm-finance-card adm-finance-card--total glass-card">
          <p className="adm-finance-card__label">Total Tagihan / Total Billing</p>
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
        <SearchableSelect
          options={Array.from(new Set(INVOICES.map(inv => inv.client))).sort().map(c => ({ value: c, label: c }))}
          value={filterClient}
          onChange={(v) => { setFilterClient(v); setCurrentPage(1) }}
          placeholder="Semua Klien (A-Z)"
          searchPlaceholder="Cari klien..."
          allLabel="Semua Klien (A-Z)"
          style={{ width: '250px' }}
        />
        <SearchableSelect
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'sent', label: 'Terkirim' },
            { value: 'paid', label: 'Lunas' },
            { value: 'overdue', label: 'Lewat Jatuh Tempo' },
            { value: 'cancelled', label: 'Dibatalkan' },
          ]}
          value={filterStatus}
          onChange={(v) => { setFilterStatus(v); setCurrentPage(1) }}
          placeholder="Semua Status"
          searchPlaceholder="Cari status..."
          allLabel="Semua Status"
          style={{ width: '200px' }}
        />
      </div>

      <div className="adm-filters" style={{ marginTop: '1rem' }}>
        {filters.map(f => {
          const count =
            f.id === 'all'
              ? INVOICES.filter(inv => filterClient === 'all' || inv.client === filterClient).length
              : INVOICES.filter(
                  inv => {
                    const matchClient = filterClient === 'all' || inv.client === filterClient
                    const matchFilterStatus = filterStatus === 'all' || inv.paymentStatus === filterStatus
                    if (!matchClient || !matchFilterStatus) return false
                    if (f.id === 'unpaid') return inv.paymentStatus === 'draft' || inv.paymentStatus === 'sent'
                    if (f.id === 'paid') return inv.paymentStatus === 'paid'
                    if (f.id === 'overdue') return inv.paymentStatus === 'overdue'
                    return false
                  }
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
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <Icon name="sync" size={24} />
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>Memuat data faktur…</p>
          </div>
        ) : (
          <>
            <AdminDataTable columns={columns} data={paginated} onRowClick={setSelectedInvoice} />
            <AdminPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
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

          <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
            {selectedInvoice.paymentStatus === 'draft' && (
              <>
                <button
                  className="adm-create-btn"
                  style={{ width: 'auto' }}
                  onClick={() => handleAction(invoicesAPI.send, 'Faktur berhasil dikirim.')}
                >
                  <Icon name="send" size={16} /> Kirim Faktur
                </button>
                <button
                  className="adm-action-btn"
                  style={{ color: '#ef4444', borderColor: '#fca5a5', width: 'auto' }}
                  onClick={() => handleAction(invoicesAPI.cancel, 'Faktur berhasil dibatalkan.')}
                >
                  <Icon name="cancel" size={16} /> Batalkan Faktur
                </button>
              </>
            )}
            {(selectedInvoice.paymentStatus === 'sent' || selectedInvoice.paymentStatus === 'overdue') && (
              <>
                <button
                  className="adm-create-btn"
                  style={{ width: 'auto', backgroundColor: 'var(--dash-tertiary-light)', borderColor: 'var(--dash-tertiary-light)' }}
                  onClick={() => handleAction(invoicesAPI.markPaid, 'Faktur ditandai sebagai Lunas.')}
                >
                  <Icon name="check_circle" size={16} /> Tandai Lunas
                </button>
                <button
                  className="adm-action-btn"
                  style={{ color: '#ef4444', borderColor: '#fca5a5', width: 'auto' }}
                  onClick={() => handleAction(invoicesAPI.cancel, 'Faktur berhasil dibatalkan.')}
                >
                  <Icon name="cancel" size={16} /> Batalkan Faktur
                </button>
              </>
            )}
            {selectedInvoice.paymentStatus === 'overdue' && (
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
                  border: 'none',
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
            )}
          </div>
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
              <select
                value={formShipmentId}
                onChange={(e) => {
                  const shipId = e.target.value
                  setFormShipmentId(shipId)
                  const found = availableShipments.find(s => s.id === shipId)
                  if (found && found.price) {
                    setFormSubtotal(String(Number(found.price)))
                  } else {
                    setFormSubtotal('')
                  }
                }}
              >
                <option value="" disabled>Pilih Pengiriman...</option>
                {availableShipments.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.id} - {s.client?.companyName || s.client?.fullName || 'No Client'}
                  </option>
                ))}
              </select>
            </AdminFormField>
            <AdminFormField label="Nominal (IDR)" required>
              <input
                type="number"
                placeholder="4500000"
                min="0"
                value={formSubtotal}
                onChange={(e) => setFormSubtotal(e.target.value)}
                readOnly={!!availableShipments.find(s => s.id === formShipmentId)?.price}
                style={availableShipments.find(s => s.id === formShipmentId)?.price ? { background: '#f1f5f9', cursor: 'not-allowed' } : {}}
              />
              {availableShipments.find(s => s.id === formShipmentId)?.price && (
                <span style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: '4px', display: 'block' }}>
                  ✓ Harga otomatis dari data pengiriman
                </span>
              )}
            </AdminFormField>
            <AdminFormField label="PPN (11%)">
              <input
                type="number"
                placeholder="495000"
                min="0"
                value={formSubtotal ? Math.round(Number(formSubtotal) * 0.11) : ''}
                readOnly
              />
            </AdminFormField>
            <AdminFormField label="Jatuh Tempo" required>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
              />
            </AdminFormField>
            <AdminFormField label="Catatan Pembayaran" fullWidth>
              <textarea
                placeholder="Cth: Transfer BCA xxxxxxx"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </AdminFormField>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
