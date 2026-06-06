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

const mapDriverStatus = (apiStatus) => {
  if (!apiStatus) return 'inactive'
  const s = apiStatus.toUpperCase()
  if (s === 'ACTIVE') return 'available'
  if (s === 'UNAVAILABLE') return 'inactive'
  return apiStatus.toLowerCase()
}

export default function DriversSection() {
  const { showToast } = useToast()

  // List state
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedDriver, setSelectedDriver] = useState(null)

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseType, setLicenseType] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingDriverId, setEditingDriverId] = useState(null)
  const [status, setStatus] = useState('ACTIVE')

  const fetchDrivers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fleetAPI.getDrivers()
      const mapped = (data.drivers || []).map((d) => ({
        id: d.id,
        name: d.fullName || '-',
        phone: d.phoneNumber || '-',
        licenseNumber: d.licenseNumber || '-',
        licenseType: d.licenseType || '-',
        licenseExpiry: formatDate(d.licenseExpiry),
        rawLicenseExpiry: d.licenseExpiry,
        status: mapDriverStatus(d.status),
        rawStatus: d.status,
        assignments: d._count?.shipments ?? 0,
      }))
      setDrivers(mapped)
    } catch (err) {
      console.error('Failed to fetch drivers:', err)
      showToast(err.message || 'Gagal memuat data driver.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchDrivers()
  }, [fetchDrivers])

  const resetForm = () => {
    setIsEditMode(false)
    setEditingDriverId(null)
    setFullName('')
    setPhoneNumber('')
    setLicenseNumber('')
    setLicenseType('')
    setLicenseExpiry('')
    setStatus('ACTIVE')
  }

  const handleOpenCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    resetForm()
  }

  const handleOpenEdit = (row) => {
    setIsEditMode(true)
    setEditingDriverId(row.id)
    setFullName(row.name || '')
    setPhoneNumber(row.phone || '')
    setLicenseNumber(row.licenseNumber || '')
    setLicenseType(row.licenseType || '')
    
    let expiryDate = ''
    if (row.rawLicenseExpiry) {
      expiryDate = new Date(row.rawLicenseExpiry).toISOString().substring(0, 10)
    }
    setLicenseExpiry(expiryDate)
    setStatus(row.rawStatus || 'ACTIVE')
    setShowCreateModal(true)
  }

  const handleCreateDriver = async () => {
    if (!fullName.trim() || !phoneNumber.trim() || !licenseNumber.trim() || !licenseType || !licenseExpiry) {
      showToast('Harap lengkapi semua field yang wajib diisi.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await fleetAPI.addDriver({ fullName, phoneNumber, licenseNumber, licenseType, licenseExpiry })
      showToast('Driver baru berhasil ditambahkan!', 'success')
      setShowCreateModal(false)
      resetForm()
      await fetchDrivers()
    } catch (err) {
      showToast(err.message || 'Gagal menambah driver.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateDriver = async () => {
    if (!fullName.trim() || !phoneNumber.trim() || !licenseNumber.trim() || !licenseType || !licenseExpiry) {
      showToast('Harap lengkapi semua field yang wajib diisi.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await fleetAPI.updateDriver(editingDriverId, {
        fullName,
        phoneNumber,
        licenseNumber,
        licenseType,
        licenseExpiry,
        status,
      })
      showToast('Driver berhasil diperbarui!', 'success')
      setShowCreateModal(false)
      resetForm()
      await fetchDrivers()
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui driver.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteDriver = async (id, name) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus driver "${name}"? Penugasan pengirimannya akan dikosongkan.`)) {
      return
    }
    try {
      await fleetAPI.deleteDriver(id)
      showToast('Driver berhasil dihapus.', 'success')
      if (selectedDriver?.id === id) {
        setSelectedDriver(null)
      }
      await fetchDrivers()
    } catch (err) {
      showToast(err.message || 'Gagal menghapus driver.', 'error')
    }
  }

  const filters = [
    { id: 'all', label: 'Semua' },
    { id: 'available', label: 'Tersedia' },
    { id: 'inactive', label: 'Tidak Aktif' },
  ]

  const filtered = drivers.filter((d) => {
    const matchFilter = filter === 'all' || d.status === filter
    const matchSearch =
      !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.phone.includes(searchQuery) ||
      d.licenseNumber.toLowerCase().includes(searchQuery.toLowerCase())
    return matchFilter && matchSearch
  })

  const availableCount = drivers.filter((d) => d.status === 'available').length
  const inactiveCount = drivers.filter((d) => d.status === 'inactive').length

  const columns = [
    {
      key: 'name',
      label: 'Nama Driver',
      render: (v) => <span className="adm-table__cell-main">{v}</span>,
    },
    { key: 'phone', label: 'No. Telepon' },
    { key: 'licenseNumber', label: 'No. SIM' },
    { key: 'licenseType', label: 'Jenis SIM' },
    { key: 'licenseExpiry', label: 'Masa Berlaku SIM' },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <AdminStatusBadge status={v} type="driver" />,
    },
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
              setSelectedDriver(row)
            }}
          >
            <Icon name="visibility" size={16} />
          </button>
          <button
            className="adm-action-btn"
            title="Edit"
            onClick={(e) => {
              e.stopPropagation()
              handleOpenEdit(row)
            }}
          >
            <Icon name="edit" size={16} />
          </button>
          <button
            className="adm-action-btn adm-action-btn--danger"
            title="Hapus"
            onClick={(e) => {
              e.stopPropagation()
              handleDeleteDriver(row.id, row.name)
            }}
          >
            <Icon name="delete" size={16} />
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
          <h2 className="dash-header__title">Driver</h2>
          <p className="dash-header__subtitle">Kelola data driver dan informasi SIM.</p>
        </div>
        <div className="adm-section-actions">
          <button className="adm-create-btn" onClick={handleOpenCreateModal}>
            <Icon name="add" size={18} /> Tambah Driver
          </button>
        </div>
      </section>

      {/* Search */}
      <div className="adm-search-bar">
        <Icon name="search" size={18} />
        <input
          type="text"
          placeholder="Cari nama driver, telepon, atau no. SIM..."
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
              ? drivers.length
              : drivers.filter((d) => d.status === f.id).length
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
            <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>Memuat data driver...</p>
          </div>
        ) : (
          <>
            <AdminDataTable columns={columns} data={filtered} onRowClick={setSelectedDriver} />
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
          <strong>{drivers.length}</strong> Total Driver
        </span>
        <span>|</span>
        <span>
          <strong>{availableCount}</strong> Tersedia
        </span>
        <span>|</span>
        <span>
          <strong>{inactiveCount}</strong> Tidak Aktif
        </span>
      </div>

      {/* Detail Panel */}
      {selectedDriver && (
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
              <AdminStatusBadge status={selectedDriver.status} type="driver" />
              <h3
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 900,
                  color: 'var(--dash-primary)',
                  margin: '0.5rem 0 0',
                }}
              >
                {selectedDriver.name}
              </h3>
            </div>
            <button className="adm-action-btn" onClick={() => setSelectedDriver(null)}>
              <Icon name="close" size={18} />
            </button>
          </div>

          <div className="adm-detail-grid">
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title">
                <Icon name="person" size={16} /> Informasi Driver
              </h4>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Nama</span>
                <span className="adm-detail-value">{selectedDriver.name}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Telepon</span>
                <span className="adm-detail-value">{selectedDriver.phone}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Status</span>
                <span className="adm-detail-value">
                  <AdminStatusBadge status={selectedDriver.status} type="driver" />
                </span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Total Penugasan</span>
                <span className="adm-detail-value">{selectedDriver.assignments}</span>
              </div>
            </div>

            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title">
                <Icon name="badge" size={16} /> Informasi SIM
              </h4>
              <div className="adm-detail-row">
                <span className="adm-detail-label">No. SIM</span>
                <span className="adm-detail-value">{selectedDriver.licenseNumber}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Jenis SIM</span>
                <span className="adm-detail-value">{selectedDriver.licenseType}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">Masa Berlaku SIM</span>
                <span className="adm-detail-value">{selectedDriver.licenseExpiry}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <AdminModal
          title={isEditMode ? 'Edit Driver' : 'Tambah Driver Baru'}
          subtitle={isEditMode ? 'Ubah data lengkap driver dan informasi SIM.' : 'Isi data lengkap driver dan informasi SIM.'}
          onClose={handleCloseCreateModal}
          onSubmit={isEditMode ? handleUpdateDriver : handleCreateDriver}
          submitLabel={submitting ? 'Menyimpan...' : (isEditMode ? 'Simpan Perubahan' : 'Simpan Driver')}
        >
          <div className="adm-form-grid">
            <AdminFormField label="Nama Lengkap" required fullWidth>
              <input
                type="text"
                placeholder="Cth: Ahmad Fauzi"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </AdminFormField>

            <AdminFormField label="No. Telepon" required>
              <input
                type="text"
                placeholder="0813-xxxx-xxxx"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </AdminFormField>

            <AdminFormField label="Nomor SIM" required>
              <input
                type="text"
                placeholder="Cth: 1234567890"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
              />
            </AdminFormField>

            <AdminFormField label="Jenis SIM" required>
              <select
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
              >
                <option value="" disabled>
                  Pilih Jenis SIM...
                </option>
                <option value="A">A</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
              </select>
            </AdminFormField>

            <AdminFormField label="Masa Berlaku SIM" required>
              <input
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
              />
            </AdminFormField>

            {isEditMode && (
              <AdminFormField label="Status" required>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ACTIVE">Tersedia</option>
                  <option value="UNAVAILABLE">Tidak Aktif</option>
                </select>
              </AdminFormField>
            )}
          </div>
        </AdminModal>
      )}
    </div>
  )
}
