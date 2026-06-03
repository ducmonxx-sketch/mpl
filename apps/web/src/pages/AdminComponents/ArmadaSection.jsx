import { useState, useEffect, useCallback } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import AdminDataTable from './components/AdminDataTable'
import AdminStatusBadge from './components/AdminStatusBadge'
import AdminPagination from './components/AdminPagination'
import AdminModal from './components/AdminModal'
import AdminFormField from './components/AdminFormField'
import { fleetAPI } from '../../lib/api'

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '-'
  }
}

const VEHICLE_STATUS_DISPLAY = {
  AVAILABLE: 'Tersedia',
  IN_USE: 'Digunakan',
  MAINTENANCE: 'Perawatan',
}

const mapVehicleStatus = (apiStatus) => {
  if (!apiStatus) return 'AVAILABLE'
  return apiStatus.toUpperCase()
}

const VEHICLE_STATUS_BADGE_MAP = {
  AVAILABLE: 'available',
  IN_USE: 'on_duty',
  MAINTENANCE: 'inactive',
}

export default function ArmadaSection() {
  const { showToast } = useToast()

  // List state
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedVehicle, setSelectedVehicle] = useState(null)

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [type, setType] = useState('')
  const [licensePlate, setLicensePlate] = useState('')
  const [stnkExpiry, setStnkExpiry] = useState('')
  const [kirExpiry, setKirExpiry] = useState('')

  const fetchVehicles = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fleetAPI.getVehicles()
      const mapped = (data.vehicles || data || []).map((v) => ({
        id: v.id,
        type: v.type || '-',
        licensePlate: v.licensePlate || '-',
        status: mapVehicleStatus(v.status),
        stnkExpiry: formatDate(v.stnkExpiry),
        kirExpiry: formatDate(v.kirExpiry),
        assignments: v._count?.shipments ?? 0,
      }))
      setVehicles(mapped)
    } catch (err) {
      console.error('Failed to fetch vehicles:', err)
      showToast(err.message || 'Gagal memuat data armada.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchVehicles()
  }, [fetchVehicles])

  const resetForm = () => {
    setType('')
    setLicensePlate('')
    setStnkExpiry('')
    setKirExpiry('')
  }

  const handleOpenCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    resetForm()
  }

  const handleCreateVehicle = async () => {
    if (!type || !licensePlate.trim() || !stnkExpiry || !kirExpiry) {
      showToast('Harap lengkapi semua field yang wajib diisi.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await fleetAPI.addVehicle({ type, licensePlate, stnkExpiry, kirExpiry })
      showToast('Kendaraan baru berhasil ditambahkan!', 'success')
      setShowCreateModal(false)
      resetForm()
      await fetchVehicles()
    } catch (err) {
      showToast(err.message || 'Gagal menambah kendaraan.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const filters = [
    { id: 'all', label: 'Semua' },
    { id: 'AVAILABLE', label: 'Tersedia' },
    { id: 'IN_USE', label: 'Digunakan' },
    { id: 'MAINTENANCE', label: 'Perawatan' },
  ]

  const filtered = vehicles.filter((v) => {
    const matchFilter = filter === 'all' || v.status === filter
    const matchSearch =
      !searchQuery ||
      v.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.licensePlate.toLowerCase().includes(searchQuery.toLowerCase())
    return matchFilter && matchSearch
  })

  const availableCount = vehicles.filter((v) => v.status === 'AVAILABLE').length
  const inUseCount = vehicles.filter((v) => v.status === 'IN_USE').length
  const maintenanceCount = vehicles.filter((v) => v.status === 'MAINTENANCE').length

  const columns = [
    {
      key: 'licensePlate',
      label: 'No. Plat',
      render: (v) => <span className="adm-table__cell-main">{v}</span>,
    },
    { key: 'type', label: 'Jenis Kendaraan' },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span
          style={{
            display: 'inline-block',
            padding: '0.25rem 0.65rem',
            borderRadius: '99px',
            fontSize: '0.72rem',
            fontWeight: 700,
            background:
              v === 'AVAILABLE'
                ? 'rgba(34,197,94,0.12)'
                : v === 'IN_USE'
                ? 'rgba(59,130,246,0.12)'
                : 'rgba(239,68,68,0.12)',
            color:
              v === 'AVAILABLE'
                ? '#16a34a'
                : v === 'IN_USE'
                ? '#2563eb'
                : '#dc2626',
          }}
        >
          {VEHICLE_STATUS_DISPLAY[v] || v}
        </span>
      ),
    },
    { key: 'stnkExpiry', label: 'Masa Berlaku STNK' },
    { key: 'kirExpiry', label: 'Masa Berlaku KIR' },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="adm-actions">
          <button
            className="adm-action-btn"
            title="Lihat Detail"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedVehicle(row)
            }}
          >
            <Icon name="visibility" size={16} />
          </button>
          <button
            className="adm-action-btn"
            title="Edit"
            onClick={(e) => {
              e.stopPropagation()
              showToast('Fitur edit kendaraan dalam tahap pengembangan.', 'info')
            }}
          >
            <Icon name="edit" size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="dash-content">
      {/* Header */}
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Armada Kendaraan</h2>
          <p className="dash-header__subtitle">Kelola kendaraan, status, dan dokumen armada.</p>
        </div>
        <div className="adm-section-actions">
          <button className="adm-create-btn" onClick={handleOpenCreateModal}>
            <Icon name="add" size={18} /> Tambah Kendaraan
          </button>
        </div>
      </section>

      {/* Search */}
      <div className="adm-search-bar">
        <Icon name="search" size={18} />
        <input
          type="text"
          placeholder="Cari jenis kendaraan atau no. plat..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setCurrentPage(1)
          }}
        />
      </div>

      {/* Filters */}
      <div className="adm-filters" style={{ marginTop: '1rem' }}>
        {filters.map((f) => {
          const count =
            f.id === 'all'
              ? vehicles.length
              : vehicles.filter((v) => v.status === f.id).length
          return (
            <button
              key={f.id}
              className={`adm-filter-tab${filter === f.id ? ' adm-filter-tab--active' : ''}`}
              onClick={() => {
                setFilter(f.id)
                setCurrentPage(1)
              }}
            >
              {f.label} <span className="adm-filter-count">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--dash-text-muted)' }}>
            <Icon name="sync" size={28} />
            <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>Memuat data armada...</p>
          </div>
        ) : (
          <>
            <AdminDataTable columns={columns} data={filtered} onRowClick={setSelectedVehicle} />
            <AdminPagination
              currentPage={currentPage}
              totalPages={Math.max(1, Math.ceil(filtered.length / 20))}
              totalItems={filtered.length}
              itemsPerPage={20}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* Summary Bar */}
      <div className="adm-driver-summary">
        <span>
          <strong>{vehicles.length}</strong> Total Kendaraan
        </span>
        <span>|</span>
        <span>
          <strong>{availableCount}</strong> Tersedia
        </span>
        <span>|</span>
        <span>
          <strong>{inUseCount}</strong> Digunakan
        </span>
        <span>|</span>
        <span>
          <strong>{maintenanceCount}</strong> Perawatan
        </span>
      </div>

      {/* Detail Panel */}
      {selectedVehicle && (
        <div className="adm-detail-panel glass-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '1.5rem',
            }}
          >
            <div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '99px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background:
                    selectedVehicle.status === 'AVAILABLE'
                      ? 'rgba(34,197,94,0.12)'
                      : selectedVehicle.status === 'IN_USE'
                      ? 'rgba(59,130,246,0.12)'
                      : 'rgba(239,68,68,0.12)',
                  color:
                    selectedVehicle.status === 'AVAILABLE'
                      ? '#16a34a'
                      : selectedVehicle.status === 'IN_USE'
                      ? '#2563eb'
                      : '#dc2626',
                }}
              >
                {VEHICLE_STATUS_DISPLAY[selectedVehicle.status] || selectedVehicle.status}
              </span>
              <h3
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 900,
                  color: 'var(--dash-primary)',
                  margin: '0.5rem 0 0',
                }}
              >
                {selectedVehicle.licensePlate}
              </h3>
            </div>
            <button className="adm-action-btn" onClick={() => setSelectedVehicle(null)}>
              <Icon name="close" size={18} />
            </button>
          </div>

          <div className="adm-detail-grid">
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title">
                <Icon name="directions_car" size={16} /> Informasi Kendaraan
              </h4>
              <div className="adm-detail-row">
                <span className="adm-detail-label">No. Plat</span>
                <span className="adm-detail-value">{selectedVehicle.licensePlate}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Jenis</span>
                <span className="adm-detail-value">{selectedVehicle.type}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Status</span>
                <span className="adm-detail-value">
                  {VEHICLE_STATUS_DISPLAY[selectedVehicle.status] || selectedVehicle.status}
                </span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Total Penugasan</span>
                <span className="adm-detail-value">{selectedVehicle.assignments}</span>
              </div>
            </div>

            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title">
                <Icon name="description" size={16} /> Dokumen Kendaraan
              </h4>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Masa Berlaku STNK</span>
                <span className="adm-detail-value">{selectedVehicle.stnkExpiry}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Masa Berlaku KIR</span>
                <span className="adm-detail-value">{selectedVehicle.kirExpiry}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <AdminModal
          title="Tambah Kendaraan Baru"
          subtitle="Isi data kendaraan dan dokumen armada."
          onClose={handleCloseCreateModal}
          onSubmit={handleCreateVehicle}
          submitLabel={submitting ? 'Menyimpan...' : 'Simpan Kendaraan'}
        >
          <div className="adm-form-grid">
            <AdminFormField label="Jenis Kendaraan" required>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="" disabled>
                  Pilih Jenis...
                </option>
                <option value="Truk Box">Truk Box</option>
                <option value="Pickup">Pickup</option>
                <option value="Truk Kontainer">Truk Kontainer</option>
                <option value="Van">Van</option>
                <option value="Motor">Motor</option>
              </select>
            </AdminFormField>

            <AdminFormField label="No. Plat Kendaraan" required>
              <input
                type="text"
                placeholder="B 1234 XY"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
              />
            </AdminFormField>

            <AdminFormField label="Masa Berlaku STNK" required>
              <input
                type="date"
                value={stnkExpiry}
                onChange={(e) => setStnkExpiry(e.target.value)}
              />
            </AdminFormField>

            <AdminFormField label="Masa Berlaku KIR" required>
              <input
                type="date"
                value={kirExpiry}
                onChange={(e) => setKirExpiry(e.target.value)}
              />
            </AdminFormField>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
