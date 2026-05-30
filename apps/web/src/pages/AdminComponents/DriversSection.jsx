import { useState, useEffect } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import AdminDataTable from './components/AdminDataTable'
import AdminStatusBadge from './components/AdminStatusBadge'
import AdminPagination from './components/AdminPagination'
import AdminModal from './components/AdminModal'
import AdminFormField from './components/AdminFormField'
import { fleetAPI } from '../../lib/api'

export default function DriversSection() {
  const { showToast } = useToast()
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [DRIVERS, setDRIVERS] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDrivers() {
      setLoading(true)
      try {
        const data = await fleetAPI.getDrivers()
        const mapped = (data.drivers || []).map(d => ({
          id: d.id,
          name: d.fullName,
          phone: d.phoneNumber || '-',
          licenseNumber: d.licenseNumber || '-',
          licenseExpiry: '-', // Add to DB later
          vehicleType: '-', // Fetch from vehicle join later
          vehiclePlate: '-',
          status: d.status.toLowerCase() === 'active' ? 'available' : d.status.toLowerCase(), // basic mapping
          isActive: d.status === 'ACTIVE',
          notes: '',
          assignments: 0,
        }))
        setDRIVERS(mapped)
      } catch (err) {
        console.error('Failed to fetch drivers:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDrivers()
  }, [])

  const filtered = DRIVERS.filter(d => {
    const matchFilter = filter === 'all' || d.status === filter
    const matchSearch = !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchFilter && matchSearch
  })

  const activeCount = DRIVERS.filter(d => d.isActive).length
  const onDutyCount = DRIVERS.filter(d => d.status === 'on_duty').length
  const availableCount = DRIVERS.filter(d => d.status === 'available').length

  const filters = [
    { id: 'all', label: 'Semua' },
    { id: 'available', label: 'Tersedia' },
    { id: 'on_duty', label: 'Bertugas' },
    { id: 'inactive', label: 'Tidak Aktif' },
  ]

  const columns = [
    { key: 'name', label: 'Nama Driver', render: (v) => <span className="adm-table__cell-main">{v}</span> },
    { key: 'vehiclePlate', label: 'No. Kendaraan' },
    { key: 'vehicleType', label: 'Jenis' },
    { key: 'phone', label: 'Telepon' },
    { key: 'status', label: 'Status', render: (v) => <AdminStatusBadge status={v} type="driver" /> },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="adm-actions">
        <button className="adm-action-btn" title="Detail" onClick={(e) => { e.stopPropagation(); setSelectedDriver(row) }}>
          <Icon name="visibility" size={16} />
        </button>
        <button className="adm-action-btn" title="Edit" onClick={(e) => { e.stopPropagation(); showToast('Fitur edit driver dalam pengembangan.', 'info') }}>
          <Icon name="edit" size={16} />
        </button>
      </div>
    )},
  ]

  const handleCreateDriver = () => {
    showToast('Driver baru berhasil ditambahkan!', 'success')
    setShowCreateModal(false)
  }

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Driver & Armada</h2>
          <p className="dash-header__subtitle">Kelola driver, kendaraan, dan ketersediaan armada.</p>
        </div>
        <div className="adm-section-actions">
          <button className="adm-create-btn" onClick={() => setShowCreateModal(true)}>
            <Icon name="add" size={18} /> Tambah Driver
          </button>
        </div>
      </section>

      <div className="adm-search-bar">
        <Icon name="search" size={18} />
        <input type="text" placeholder="Cari nama driver..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      <div className="adm-filters" style={{ marginTop: '1rem' }}>
        {filters.map(f => {
          const count = f.id === 'all' ? DRIVERS.length : DRIVERS.filter(d => d.status === f.id).length
          return (
            <button key={f.id} className={`adm-filter-tab${filter === f.id ? ' adm-filter-tab--active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label} <span className="adm-filter-count">{count}</span>
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <AdminDataTable columns={columns} data={filtered} onRowClick={setSelectedDriver} />
        <AdminPagination currentPage={currentPage} totalPages={1} totalItems={filtered.length} itemsPerPage={20} onPageChange={setCurrentPage} />
      </div>

      {/* Summary Bar */}
      <div className="adm-driver-summary">
        <span><strong>{activeCount}</strong> Driver Aktif</span>
        <span>|</span>
        <span><strong>{onDutyCount}</strong> Bertugas</span>
        <span>|</span>
        <span><strong>{availableCount}</strong> Tersedia</span>
      </div>

      {/* Detail Panel */}
      {selectedDriver && (
        <div className="adm-detail-panel glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <AdminStatusBadge status={selectedDriver.status} type="driver" />
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--dash-primary)', margin: '0.5rem 0 0' }}>{selectedDriver.name}</h3>
            </div>
            <button className="adm-action-btn" onClick={() => setSelectedDriver(null)}><Icon name="close" size={18} /></button>
          </div>
          <div className="adm-detail-grid">
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="person" size={16} /> Informasi Driver</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Telepon</span><span className="adm-detail-value">{selectedDriver.phone}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">No. SIM</span><span className="adm-detail-value">{selectedDriver.licenseNumber}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">SIM Expired</span><span className="adm-detail-value">{selectedDriver.licenseExpiry}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Total Penugasan</span><span className="adm-detail-value">{selectedDriver.assignments}</span></div>
            </div>
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="directions_car" size={16} /> Informasi Kendaraan</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Jenis</span><span className="adm-detail-value">{selectedDriver.vehicleType}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">No. Plat</span><span className="adm-detail-value">{selectedDriver.vehiclePlate}</span></div>
              {selectedDriver.notes && <div className="adm-detail-row"><span className="adm-detail-label">Catatan</span><span className="adm-detail-value">{selectedDriver.notes}</span></div>}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <AdminModal title="Tambah Driver Baru" subtitle="Isi data driver dan kendaraan." onClose={() => setShowCreateModal(false)} onSubmit={handleCreateDriver} submitLabel="Simpan Driver">
          <div className="adm-form-grid">
            <AdminFormField label="Nama Lengkap" required><input type="text" placeholder="Cth: Ahmad Fauzi" /></AdminFormField>
            <AdminFormField label="No. Telepon" required><input type="text" placeholder="0813-xxxx-xxxx" /></AdminFormField>
            <AdminFormField label="Nomor SIM" required><input type="text" placeholder="SIM B2 - 1234567890" /></AdminFormField>
            <AdminFormField label="SIM Berlaku Hingga" required><input type="date" /></AdminFormField>
            <AdminFormField label="Jenis Kendaraan" required>
              <select defaultValue=""><option value="" disabled>Pilih...</option><option>Truk Box</option><option>Pickup</option><option>Truk Kontainer</option><option>Van</option></select>
            </AdminFormField>
            <AdminFormField label="No. Plat Kendaraan" required><input type="text" placeholder="B 1234 XY" /></AdminFormField>
            <AdminFormField label="Catatan" fullWidth><textarea placeholder="Catatan internal..." /></AdminFormField>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
