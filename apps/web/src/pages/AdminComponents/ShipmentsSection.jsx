import { useState, useEffect, useCallback } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import { shipmentsAPI, usersAPI, fleetAPI } from '../../lib/api'
import AdminDataTable from './components/AdminDataTable'
import AdminStatusBadge from './components/AdminStatusBadge'
import AdminPagination from './components/AdminPagination'
import AdminModal from './components/AdminModal'
import AdminFormField from './components/AdminFormField'

export const SERVICE_LABELS = {
  'Darat': 'Darat',
  'Laut': 'Laut',
  'Udara': 'Udara',
  inter_island: 'Antar Pulau',
  last_mile: 'Lokal',
  warehousing: 'Gudang',
}

export const STATUS_OPTIONS = ['pending', 'in_transit', 'delivered', 'cancelled']

const RAW_STATUS_OPTIONS = [
  { value: 'PENDING',   label: 'Menunggu' },
  { value: 'TRANSIT',   label: 'Dalam Perjalanan' },
  { value: 'DELIVERED', label: 'Terkirim' },
  { value: 'FAILED',    label: 'Gagal' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
]

const mapStatus = (s) => {
  const map = { PENDING: 'pending', TRANSIT: 'in_transit', DELIVERED: 'delivered', FAILED: 'cancelled', CANCELLED: 'cancelled' }
  return map[s] || s.toLowerCase()
}

const formatDate = (raw) => {
  if (!raw) return '-'
  try {
    return new Date(raw).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '-'
  }
}

export default function ShipmentsSection({ onTrackFull }) {
  const { showToast } = useToast()

  // ── List / filter state ──────────────────────────────────────
  const [filter, setFilter]               = useState('all')
  const [filterClient, setFilterClient]   = useState('all')
  const [filterService, setFilterService] = useState('all')
  const [searchQuery, setSearchQuery]     = useState('')
  const [currentPage, setCurrentPage]     = useState(1)
  const [SHIPMENTS, setSHIPMENTS]         = useState([])
  const [loading, setLoading]             = useState(true)

  // ── Detail panel ─────────────────────────────────────────────
  const [selectedShipment, setSelectedShipment] = useState(null)

  // ── Create modal ─────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [clientOptions, setClientOptions]     = useState([])
  const [formClientId, setFormClientId]               = useState('')
  const [formService, setFormService]                 = useState('Darat')
  const [formOrigin, setFormOrigin]                   = useState('')
  const [formDestination, setFormDestination]         = useState('')
  const [formPickupDate, setFormPickupDate]           = useState('')
  const [formEstimatedArrival, setFormEstimatedArrival] = useState('')
  const [formPackageType, setFormPackageType]         = useState('')
  const [formUnits, setFormUnits]                     = useState('')
  const [formWeight, setFormWeight]                   = useState('')
  const [formPrice, setFormPrice]                     = useState('')
  const [formNotes, setFormNotes]                     = useState('')

  // ── Assign modal ─────────────────────────────────────────────
  const [showAssignModal, setShowAssignModal]     = useState(false)
  const [assigningShipment, setAssigningShipment] = useState(null)
  const [assignDriverId, setAssignDriverId]       = useState('')
  const [assignVehicleId, setAssignVehicleId]     = useState('')
  const [availableDrivers, setAvailableDrivers]   = useState([])
  const [availableVehicles, setAvailableVehicles] = useState([])

  // ── Data fetching ─────────────────────────────────────────────
  const fetchShipments = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const data = await shipmentsAPI.list()
      const mapped = (data.shipments || data || []).map(s => ({
        id:               s.id,
        clientId:         s.clientId,
        client:           s.client?.companyName || s.client?.fullName || '-',
        serviceType:      s.serviceLevel || 'Darat',
        originCity:       s.originLocation,
        destinationCity:  s.destinationLocation,
        pickupDate:       formatDate(s.pickupDate || s.createdAt),
        estimatedArrival: s.estimatedArrival ? formatDate(s.estimatedArrival) : '-',
        cargoDescription: s.packageType,
        weightKg:         s.weightKg,
        units:            s.units || '-',
        price:            s.price ? Number(s.price) : null,
        driverId:         s.driverId,
        driverName:       s.driver?.fullName || null,
        vehicleId:        s.vehicleId,
        vehicleName:      s.vehicle ? `${s.vehicle.type} • ${s.vehicle.licensePlate}` : null,
        status:           mapStatus(s.status),
        rawStatus:        s.status,
        notes:            s.specialNotes || '',
        createdBy:        'Admin',
      }))
      setSHIPMENTS(mapped)
    } catch (err) {
      console.error('Failed to fetch shipments:', err)
      showToast('Gagal memuat data pengiriman.', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchShipments()
    const interval = setInterval(() => fetchShipments({ silent: true }), 8000)
    return () => clearInterval(interval)
  }, [fetchShipments])

  // Fetch clients for create form
  const fetchClients = async () => {
    try {
      const data = await usersAPI.listAll()
      const users = data.users || data || []
      setClientOptions(users.map(u => ({ id: u.id, label: u.companyName || u.fullName || u.email })))
    } catch (err) {
      console.error('Failed to fetch clients:', err)
    }
  }

  // Fetch fleet for assign modal
  const fetchFleet = async () => {
    try {
      const [driversData, vehiclesData] = await Promise.all([
        fleetAPI.getDrivers(),
        fleetAPI.getVehicles(),
      ])
      setAvailableDrivers(driversData.drivers || driversData || [])
      setAvailableVehicles(vehiclesData.vehicles || vehiclesData || [])
    } catch (err) {
      console.error('Failed to fetch fleet:', err)
      showToast('Gagal memuat data armada.', 'error')
    }
  }

  // ── Handlers ──────────────────────────────────────────────────
  const resetCreateForm = () => {
    setFormClientId('')
    setFormService('Darat')
    setFormOrigin('')
    setFormDestination('')
    setFormPickupDate('')
    setFormEstimatedArrival('')
    setFormPackageType('')
    setFormUnits('')
    setFormWeight('')
    setFormPrice('')
    setFormNotes('')
  }

  const openCreateModal = () => {
    fetchClients()
    resetCreateForm()
    setShowCreateModal(true)
  }

  const handleCreateShipment = async () => {
    if (!formClientId) {
      showToast('Pilih Klien terlebih dahulu.', 'error')
      return
    }
    if (!formPackageType.trim()) {
      showToast('Harap isi Deskripsi Barang.', 'error')
      return
    }
    if (!formOrigin.trim()) {
      showToast('Harap isi Kota Asal.', 'error')
      return
    }
    if (!formDestination.trim()) {
      showToast('Harap isi Kota Tujuan.', 'error')
      return
    }
    if (!formPickupDate) {
      showToast('Harap tentukan Tanggal Pickup.', 'error')
      return
    }
    if (!formUnits || Number(formUnits) <= 0) {
      showToast('Harap isi Units / Pcs dengan nilai lebih dari 0.', 'error')
      return
    }
    if (!formPrice || Number(formPrice) <= 0) {
      showToast('Harap isi Total Invoice Price dengan nilai lebih dari 0.', 'error')
      return
    }

    try {
      await shipmentsAPI.create({
        clientId:            formClientId,
        packageType:         formPackageType,
        weightKg:            Number(formWeight) || 0,
        units:               formUnits ? Number(formUnits) : null,
        serviceLevel:        formService,
        originLocation:      formOrigin,
        destinationLocation: formDestination,
        specialNotes:        formNotes || null,
        pickupDate:          formPickupDate ? new Date(formPickupDate).toISOString() : null,
        estimatedArrival:    formEstimatedArrival ? new Date(formEstimatedArrival).toISOString() : null,
        price:               formPrice ? Number(formPrice) : null,
      })
      showToast('Pengiriman baru berhasil dibuat!', 'success')
      setShowCreateModal(false)
      resetCreateForm()
      fetchShipments()
    } catch (err) {
      showToast(err.message || 'Gagal membuat pengiriman.', 'error')
    }
  }

  const openAssignModal = (row) => {
    if (row.status === 'delivered') {
      showToast('Tidak dapat menugaskan driver untuk pengiriman yang sudah terkirim.', 'error')
      return
    }
    setAssigningShipment(row)
    setAssignDriverId(row.driverId || '')
    setAssignVehicleId(row.vehicleId || '')
    fetchFleet()
    setShowAssignModal(true)
  }

  const handleAssignDriver = async () => {
    try {
      await shipmentsAPI.assign(assigningShipment.id, {
        driverId:  assignDriverId,
        vehicleId: assignVehicleId,
      })
      showToast('Driver dan armada berhasil ditugaskan!', 'success')
      setShowAssignModal(false)
      fetchShipments()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleStatusUpdate = async (newRawStatus) => {
    try {
      await shipmentsAPI.updateStatus(selectedShipment.id, { status: newRawStatus })
      showToast('Status diperbarui!', 'success')
      fetchShipments()
      setSelectedShipment(prev => ({
        ...prev,
        rawStatus: newRawStatus,
        status:    mapStatus(newRawStatus),
      }))
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // ── Filtering & pagination ────────────────────────────────────
  const ITEMS_PER_PAGE = 20

  const filtered = SHIPMENTS.filter(s => {
    const matchStatus  = filter === 'all' || s.status === filter
    const matchClient  = filterClient === 'all' || s.client === filterClient
    const matchService = filterService === 'all' || s.serviceType === filterService
    const matchSearch  = !searchQuery ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.client.toLowerCase().includes(searchQuery.toLowerCase())
    return matchStatus && matchClient && matchService && matchSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const filters = [
    { id: 'all',       label: 'Semua' },
    { id: 'delivered', label: 'Terkirim' },
    { id: 'in_transit',label: 'Dalam Perjalanan' },
    { id: 'pending',   label: 'Menunggu' },
    { id: 'cancelled', label: 'Gagal' },
  ]

  // ── Table columns ─────────────────────────────────────────────
  const columns = [
    {
      key: 'id',
      label: 'ID Order',
      render: (v) => <span className="adm-table__cell-main">{v}</span>,
    },
    { key: 'client', label: 'Klien' },
    { key: 'serviceType', label: 'Layanan', render: (v) => SERVICE_LABELS[v] || v },
    { key: 'destinationCity', label: 'Tujuan' },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <AdminStatusBadge status={v} type="shipment" />,
    },
    { key: 'pickupDate', label: 'Tgl Pickup' },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="adm-actions">
          <button
            className="adm-action-btn"
            title="Lihat Detail"
            onClick={(e) => { e.stopPropagation(); setSelectedShipment(row) }}
          >
            <Icon name="visibility" size={16} />
          </button>
          <button
            className="adm-action-btn"
            title={row.status === 'delivered' ? 'Pengiriman Selesai (Terkunci)' : 'Tugaskan Driver'}
            onClick={(e) => { e.stopPropagation(); openAssignModal(row) }}
            disabled={row.status === 'delivered'}
            style={row.status === 'delivered' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            <Icon name="person_add" size={16} />
          </button>
        </div>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="dash-content">
      {/* Header */}
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Manajemen Pengiriman</h2>
          <p className="dash-header__subtitle">Kelola semua pengiriman dari pickup hingga delivery.</p>
        </div>
        <div className="adm-section-actions">
          <button className="adm-create-btn" onClick={openCreateModal}>
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
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
        />
      </div>

      {/* Filter dropdowns */}
      <div className="adm-filters-dropdowns" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <select
          value={filterClient}
          onChange={e => { setFilterClient(e.target.value); setCurrentPage(1) }}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', minWidth: '200px' }}
        >
          <option value="all">Semua Klien (A-Z)</option>
          {Array.from(new Set(SHIPMENTS.map(s => s.client))).sort().map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterService}
          onChange={e => { setFilterService(e.target.value); setCurrentPage(1) }}
          style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', minWidth: '160px' }}
        >
          <option value="all">Semua Layanan</option>
          <option value="Darat">Darat</option>
          <option value="Laut">Laut</option>
          <option value="Udara">Udara</option>
          <option value="inter_island">Antar Pulau</option>
          <option value="last_mile">Lokal</option>
          <option value="warehousing">Gudang</option>
        </select>
      </div>

      {/* Status filter tabs */}
      <div className="adm-filters" style={{ marginTop: '1rem' }}>
        {filters.map(f => {
          const baseSet = SHIPMENTS.filter(s =>
            (filterClient  === 'all' || s.client      === filterClient) &&
            (filterService === 'all' || s.serviceType === filterService)
          )
          const count = f.id === 'all'
            ? baseSet.length
            : baseSet.filter(s => s.status === f.id).length
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
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <Icon name="sync" size={24} />
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>Memuat data pengiriman…</p>
          </div>
        ) : (
          <>
            <AdminDataTable columns={columns} data={paginated} onRowClick={setSelectedShipment} />
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

      {/* ── Detail Panel ── */}
      {selectedShipment && (
        <div className="adm-detail-panel glass-card">
          {/* Panel header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <AdminStatusBadge status={selectedShipment.status} type="shipment" />
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--dash-primary)', margin: '0.5rem 0 0' }}>
                Detail Pengiriman #{selectedShipment.id}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {/* Status updater */}
              <select
                style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
                value={selectedShipment.rawStatus}
                onChange={(e) => handleStatusUpdate(e.target.value)}
              >
                {RAW_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {onTrackFull && (
                <button
                  className="adm-action-btn"
                  style={{ backgroundColor: 'rgba(254,195,48,0.1)', color: 'var(--dash-secondary-hover)', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, width: 'auto' }}
                  onClick={() => onTrackFull(selectedShipment.id)}
                >
                  Lacak Penuh
                </button>
              )}
              <button
                className="adm-action-btn"
                title="Tutup"
                onClick={() => setSelectedShipment(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>

          {/* Detail grid */}
          <div className="adm-detail-grid">
            {/* Informasi Klien */}
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="people" size={16} /> Informasi Klien</h4>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Perusahaan</span>
                <span className="adm-detail-value">{selectedShipment.client}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Dibuat oleh</span>
                <span className="adm-detail-value">{selectedShipment.createdBy}</span>
              </div>
            </div>

            {/* Rute Pengiriman */}
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="route" size={16} /> Rute Pengiriman</h4>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Asal</span>
                <span className="adm-detail-value">{selectedShipment.originCity}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Tujuan</span>
                <span className="adm-detail-value">{selectedShipment.destinationCity}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Pickup</span>
                <span className="adm-detail-value">{selectedShipment.pickupDate}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Est. Tiba</span>
                <span className="adm-detail-value">{selectedShipment.estimatedArrival}</span>
              </div>
            </div>

            {/* Detail Muatan */}
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="inventory_2" size={16} /> Detail Muatan</h4>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Deskripsi</span>
                <span className="adm-detail-value">{selectedShipment.cargoDescription}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Berat</span>
                <span className="adm-detail-value">{selectedShipment.weightKg} kg</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Units / Pcs</span>
                <span className="adm-detail-value">{selectedShipment.units}</span>
              </div>
            </div>

            {/* Driver & Kendaraan */}
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="directions_car" size={16} /> Driver &amp; Kendaraan</h4>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Driver</span>
                <span className="adm-detail-value">{selectedShipment.driverName || 'Belum ditugaskan'}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Kendaraan</span>
                <span className="adm-detail-value">{selectedShipment.vehicleName || 'Belum ditugaskan'}</span>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  className="adm-create-btn"
                  style={{ width: '100%', justifyContent: 'center', gap: '0.4rem', padding: '0.625rem 1rem', opacity: 0.5, cursor: 'not-allowed', backgroundColor: '#64748b' }}
                  disabled={true}
                  title="Fitur ini dinonaktifkan dalam mode Detail (Lihat Detail)"
                >
                  <Icon name="person_add" size={14} /> Tugaskan Driver &amp; Armada
                </button>
              </div>
              {selectedShipment.notes && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(254,195,48,0.06)', borderRadius: '8px', border: '1px solid rgba(254,195,48,0.12)' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#795900', fontStyle: 'italic', margin: 0 }}>
                    &ldquo;{selectedShipment.notes}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Harga */}
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="payments" size={16} /> Harga</h4>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Invoice</span>
                <span className="adm-detail-value" style={{ fontWeight: 700 }}>
                  {selectedShipment.price !== null && selectedShipment.price !== undefined
                    ? 'Rp ' + Number(selectedShipment.price).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Driver Modal ── */}
      {showAssignModal && assigningShipment && (
        <AdminModal
          title="Tugaskan Driver & Armada"
          subtitle={`Pengiriman: ${assigningShipment.id}`}
          onClose={() => setShowAssignModal(false)}
          onSubmit={handleAssignDriver}
          submitLabel="Tugaskan"
        >
          <div className="adm-form-grid">
            <AdminFormField label="Pilih Driver" required>
              <select
                value={assignDriverId}
                onChange={e => setAssignDriverId(e.target.value)}
              >
                <option value="">-- Pilih Driver --</option>
                {availableDrivers.map(d => (
                  <option key={d.id} value={d.id}>{d.fullName}</option>
                ))}
              </select>
            </AdminFormField>
            <AdminFormField label="Pilih Armada" required>
              <select
                value={assignVehicleId}
                onChange={e => setAssignVehicleId(e.target.value)}
              >
                <option value="">-- Pilih Armada --</option>
                {availableVehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.type} - {v.licensePlate}</option>
                ))}
              </select>
            </AdminFormField>
          </div>
        </AdminModal>
      )}

      {/* ── Create Shipment Modal ── */}
      {showCreateModal && (
        <AdminModal
          title="Buat Pengiriman Baru"
          subtitle="Isi detail pengiriman baru di bawah ini."
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateShipment}
          submitLabel="Simpan Pengiriman"
        >
          <div className="adm-form-grid">
            {/* Klien */}
            <AdminFormField label="Klien" required fullWidth>
              <select value={formClientId} onChange={e => setFormClientId(e.target.value)}>
                <option value="">-- Pilih Klien --</option>
                {clientOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </AdminFormField>

            {/* Jenis Layanan */}
            <AdminFormField label="Jenis Layanan" required>
              <select value={formService} onChange={e => setFormService(e.target.value)}>
                <option value="Darat">Darat</option>
                <option value="Laut">Laut</option>
                <option value="Udara">Udara</option>
              </select>
            </AdminFormField>

            {/* Kota Asal */}
            <AdminFormField label="Kota Asal" required>
              <input
                type="text"
                placeholder="Cth: Jakarta Timur"
                value={formOrigin}
                onChange={e => setFormOrigin(e.target.value)}
              />
            </AdminFormField>

            {/* Kota Tujuan */}
            <AdminFormField label="Kota Tujuan" required>
              <input
                type="text"
                placeholder="Cth: Surabaya"
                value={formDestination}
                onChange={e => setFormDestination(e.target.value)}
              />
            </AdminFormField>

            {/* Tanggal Pickup */}
            <AdminFormField label="Tanggal Pickup" required>
              <input
                type="date"
                value={formPickupDate}
                onChange={e => setFormPickupDate(e.target.value)}
              />
            </AdminFormField>

            {/* Estimasi Tiba */}
            <AdminFormField label="Estimasi Tiba">
              <input
                type="datetime-local"
                value={formEstimatedArrival}
                onChange={e => setFormEstimatedArrival(e.target.value)}
              />
            </AdminFormField>

            {/* Deskripsi Barang */}
            <AdminFormField label="Deskripsi Barang" required fullWidth>
              <input
                type="text"
                placeholder="Cth: Elektronik, Suku Cadang"
                value={formPackageType}
                onChange={e => setFormPackageType(e.target.value)}
              />
            </AdminFormField>

            {/* Units / Pcs */}
            <AdminFormField label="Units / Pcs" required>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={formUnits}
                onChange={e => setFormUnits(e.target.value)}
                required
              />
            </AdminFormField>

            {/* Berat */}
            <AdminFormField label="Berat (kg)">
              <input
                type="number"
                min="0"
                placeholder="0"
                value={formWeight}
                onChange={e => setFormWeight(e.target.value)}
              />
            </AdminFormField>

            {/* Invoice Box */}
            <div style={{
              gridColumn: 'span 2',
              padding: '1.25rem',
              background: 'rgba(254,195,48,0.05)',
              border: '1.5px solid rgba(254,195,48,0.3)',
              borderRadius: '12px',
              marginTop: '0.5rem',
              marginBottom: '0.5rem'
            }}>
              <AdminFormField label="Total Invoice Price (Jumlah Harga Invoice)" required>
                <input
                  type="number"
                  min="0"
                  placeholder="Masukkan total harga invoice (Cth: 5000000)"
                  value={formPrice}
                  onChange={e => setFormPrice(e.target.value)}
                  required
                  style={{ background: '#fff' }}
                />
              </AdminFormField>
            </div>

            {/* Catatan Tambahan */}
            <AdminFormField label="Catatan Tambahan" fullWidth>
              <textarea
                placeholder="Catatan khusus untuk pengiriman ini..."
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={3}
              />
            </AdminFormField>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
