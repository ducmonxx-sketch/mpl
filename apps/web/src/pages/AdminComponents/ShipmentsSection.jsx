import { useState, useEffect } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import { shipmentsAPI } from '../../lib/api'
import AdminDataTable from './components/AdminDataTable'
import AdminStatusBadge from './components/AdminStatusBadge'
import AdminPagination from './components/AdminPagination'
import AdminModal from './components/AdminModal'
import AdminFormField from './components/AdminFormField'

export const SERVICE_LABELS = { 'Darat': 'Darat', 'Laut': 'Laut', 'Udara': 'Udara', inter_island: 'Antar Pulau', last_mile: 'Lokal', warehousing: 'Gudang' }
export const STATUS_OPTIONS = ['pending', 'in_transit', 'delivered', 'cancelled']

// Map API status to display status
const mapStatus = (s) => {
  const map = { PENDING: 'pending', TRANSIT: 'in_transit', DELIVERED: 'delivered', FAILED: 'cancelled', CANCELLED: 'cancelled' }
  return map[s] || s.toLowerCase()
}

export default function ShipmentsSection({ onTrackFull }) {
  const { showToast } = useToast()
  const [filter, setFilter] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [filterService, setFilterService] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [SHIPMENTS, setSHIPMENTS] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchShipments() {
      setLoading(true)
      try {
        const data = await shipmentsAPI.list()
        const mapped = (data.shipments || []).map(s => ({
          id: s.id,
          client: s.client?.companyName || s.client?.fullName || '-',
          clientId: s.userId,
          serviceType: s.serviceLevel || 'Darat',
          originCity: s.originLocation,
          destinationCity: s.destinationLocation,
          pickupDate: s.pickupDate ? new Date(s.pickupDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(s.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          estimatedArrival: null,
          actualArrival: null,
          cargoDescription: s.packageType,
          weightKg: s.weightKg,
          volumeM3: 0,
          packageCount: 0,
          driverId: s.driverId,
          driverName: s.driver?.fullName || null,
          status: mapStatus(s.status),
          notes: s.specialNotes || '',
          createdBy: 'System',
        }))
        setSHIPMENTS(mapped)
      } catch (err) {
        console.error('Failed to fetch shipments:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchShipments()
  }, [])

  const filtered = SHIPMENTS.filter(s => {
    const matchStatus = filter === 'all' || s.status === filter
    const matchClient = filterClient === 'all' || s.client === filterClient
    const matchService = filterService === 'all' || s.serviceType === filterService
    const matchSearch = !searchQuery ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.client.toLowerCase().includes(searchQuery.toLowerCase())
    return matchStatus && matchClient && matchService && matchSearch
  })

  const filters = [
    { id: 'all', label: 'Semua' },
    { id: 'delivered', label: 'Terkirim' },
    { id: 'in_transit', label: 'Dalam Perjalanan' },
    { id: 'pending', label: 'Menunggu' },
    { id: 'cancelled', label: 'Gagal' },
  ]

  const columns = [
    { key: 'id', label: 'ID Order', render: (v) => <span className="adm-table__cell-main">{v}</span> },
    { key: 'client', label: 'Klien' },
    { key: 'serviceType', label: 'Layanan', render: (v) => SERVICE_LABELS[v] || v },
    { key: 'destinationCity', label: 'Tujuan' },
    { key: 'status', label: 'Status', render: (v) => <AdminStatusBadge status={v} type="shipment" /> },
    { key: 'pickupDate', label: 'Tgl Pickup' },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="adm-actions">
        <button className="adm-action-btn" title="Lihat Detail" onClick={(e) => { e.stopPropagation(); setSelectedShipment(row) }}>
          <Icon name="visibility" size={16} />
        </button>
        <button className="adm-action-btn" title="Edit" onClick={(e) => { e.stopPropagation(); showToast('Fitur edit dalam tahap pengembangan.', 'info') }}>
          <Icon name="edit" size={16} />
        </button>
      </div>
    )},
  ]

  const handleCreateShipment = () => {
    showToast('Pengiriman baru berhasil dibuat!', 'success')
    setShowCreateModal(false)
  }

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Manajemen Pengiriman</h2>
          <p className="dash-header__subtitle">Kelola semua pengiriman dari pickup hingga delivery.</p>
        </div>
        <div className="adm-section-actions">
          <button className="adm-create-btn" onClick={() => setShowCreateModal(true)}>
            <Icon name="add" size={18} /> Buat Pengiriman Baru
          </button>
        </div>
      </section>

      {/* Search */}
      <div className="adm-search-bar">
        <Icon name="search" size={18} />
        <input
          type="text"
          placeholder="Cari ID order atau nama klien..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="adm-filters-dropdowns" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <select value={filterClient} onChange={e => { setFilterClient(e.target.value); setCurrentPage(1) }} style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', minWidth: '200px' }}>
          <option value="all">Semua Klien (A-Z)</option>
          {Array.from(new Set(SHIPMENTS.map(s => s.client))).sort().map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterService} onChange={e => { setFilterService(e.target.value); setCurrentPage(1) }} style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', minWidth: '160px' }}>
          <option value="all">Semua Layanan</option>
          <option value="inter_island">Antar Pulau</option>
          <option value="last_mile">Lokal</option>
          <option value="warehousing">Gudang</option>
        </select>
      </div>

      <div className="adm-filters" style={{ marginTop: '1rem' }}>
        {filters.map(f => {
          const count = f.id === 'all' 
            ? SHIPMENTS.filter(s => (filterClient === 'all' || s.client === filterClient) && (filterService === 'all' || s.serviceType === filterService)).length 
            : SHIPMENTS.filter(s => s.status === f.id && (filterClient === 'all' || s.client === filterClient) && (filterService === 'all' || s.serviceType === filterService)).length
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

      {/* Table */}
      <div style={{ marginTop: '1.25rem' }}>
        <AdminDataTable columns={columns} data={filtered} onRowClick={setSelectedShipment} />
        <AdminPagination currentPage={currentPage} totalPages={1} totalItems={filtered.length} itemsPerPage={20} onPageChange={setCurrentPage} />
      </div>

      {/* Detail Panel */}
      {selectedShipment && (
        <div className="adm-detail-panel glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <AdminStatusBadge status={selectedShipment.status} type="shipment" />
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--dash-primary)', margin: '0.5rem 0 0' }}>Detail Pengiriman #{selectedShipment.id}</h3>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
                value={selectedShipment.status}
                onChange={(e) => showToast(`Status diubah ke: ${e.target.value}`, 'success')}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>)}
              </select>
              <button 
                className="adm-action-btn" 
                style={{ backgroundColor: 'rgba(254, 195, 48, 0.1)', color: 'var(--dash-secondary-hover)', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, width: 'auto' }} 
                onClick={() => onTrackFull && onTrackFull(selectedShipment.id)}
              >
                Lacak Penuh
              </button>
              <button className="adm-action-btn" onClick={() => setSelectedShipment(null)}><Icon name="close" size={18} /></button>
            </div>
          </div>
          <div className="adm-detail-grid">
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="people" size={16} /> Informasi Klien</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Perusahaan</span><span className="adm-detail-value">{selectedShipment.client}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Dibuat oleh</span><span className="adm-detail-value">{selectedShipment.createdBy}</span></div>
            </div>
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="route" size={16} /> Rute Pengiriman</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Asal</span><span className="adm-detail-value">{selectedShipment.originCity}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Tujuan</span><span className="adm-detail-value">{selectedShipment.destinationCity}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Pickup</span><span className="adm-detail-value">{selectedShipment.pickupDate}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Est. Tiba</span><span className="adm-detail-value">{selectedShipment.estimatedArrival || '-'}</span></div>
            </div>
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="inventory_2" size={16} /> Detail Muatan</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Deskripsi</span><span className="adm-detail-value">{selectedShipment.cargoDescription}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Berat</span><span className="adm-detail-value">{selectedShipment.weightKg} kg</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Volume</span><span className="adm-detail-value">{selectedShipment.volumeM3} m³</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Jumlah Koli</span><span className="adm-detail-value">{selectedShipment.packageCount}</span></div>
            </div>
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="directions_car" size={16} /> Driver & Kendaraan</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Driver</span><span className="adm-detail-value">{selectedShipment.driverName || 'Belum ditugaskan'}</span></div>
              {selectedShipment.notes && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(254,195,48,0.06)', borderRadius: '8px', border: '1px solid rgba(254,195,48,0.12)' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#795900', fontStyle: 'italic', margin: 0 }}>"{selectedShipment.notes}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <AdminModal title="Buat Pengiriman Baru" subtitle="Masukkan detail pengiriman lengkap." onClose={() => setShowCreateModal(false)} onSubmit={handleCreateShipment} submitLabel="Simpan Pengiriman">
          <div className="adm-form-grid">
            <AdminFormField label="Klien" required fullWidth>
              <select defaultValue=""><option value="" disabled>Pilih Klien...</option><option>PT Sinar Jaya</option><option>CV Maju Bersama</option><option>PT Nusantara Lestari</option></select>
            </AdminFormField>
            <AdminFormField label="Jenis Layanan" required>
              <select defaultValue=""><option value="" disabled>Pilih Layanan...</option><option value="inter_island">Antar Pulau</option><option value="last_mile">Lokal</option><option value="warehousing">Gudang</option></select>
            </AdminFormField>
            <AdminFormField label="Kota Asal" required><input type="text" placeholder="Cth: Jakarta Timur" /></AdminFormField>
            <AdminFormField label="Kota Tujuan" required><input type="text" placeholder="Cth: Surabaya" /></AdminFormField>
            <AdminFormField label="Tanggal Pickup" required><input type="date" /></AdminFormField>
            <AdminFormField label="Estimasi Tiba"><input type="date" /></AdminFormField>
            <AdminFormField label="Deskripsi Barang" required fullWidth><input type="text" placeholder="Cth: Elektronik, Suku Cadang" /></AdminFormField>
            <AdminFormField label="Berat (kg)" required><input type="number" placeholder="450" min="0" /></AdminFormField>
            <AdminFormField label="Volume (m³)"><input type="number" placeholder="2.4" min="0" step="0.1" /></AdminFormField>
            <AdminFormField label="Jumlah Koli"><input type="number" placeholder="12" min="0" /></AdminFormField>
            <AdminFormField label="Pilih Driver">
              <select defaultValue=""><option value="" disabled>Pilih Driver...</option><option>Ahmad Fauzi</option><option>Budi Santoso</option><option>Candra Wijaya</option></select>
            </AdminFormField>
            <AdminFormField label="Catatan Tambahan" fullWidth><textarea placeholder="Catatan khusus untuk pengiriman ini..." /></AdminFormField>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
