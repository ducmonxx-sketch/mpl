import { useState, useEffect, useCallback } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import AdminDataTable from './components/AdminDataTable'
import AdminStatusBadge from './components/AdminStatusBadge'
import AdminPagination from './components/AdminPagination'
import AdminModal from './components/AdminModal'
import AdminFormField from './components/AdminFormField'
import AdminDatePicker from './components/AdminDatePicker'
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

const getExpiryStatus = (dateStr) => {
  if (!dateStr) return null
  const exp = new Date(dateStr)
  const now = new Date()
  const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return { status: 'expired', label: 'SIM Expired' }
  if (daysLeft <= 30) return { status: 'warning', label: `SIM ${daysLeft} hari lagi` }
  return null
}

const mapDriverStatus = (apiStatus) => {
  if (!apiStatus) return 'inactive'
  const s = apiStatus.toUpperCase()
  if (s === 'ACTIVE')      return 'available'
  if (s === 'ON_DUTY')     return 'on_duty'
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

  const fetchDrivers = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
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
        primaryVehicle: d.primaryVehicle || null,
      }))
      setDrivers(mapped)
    } catch (err) {
      console.error('Failed to fetch drivers:', err)
      showToast(err.message || 'Gagal memuat data driver.', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchDrivers()
    const interval = setInterval(() => fetchDrivers({ silent: true }), 8000)
    return () => clearInterval(interval)
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
    { id: 'on_duty', label: 'On Duty' },
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
  const onDutyCount    = drivers.filter((d) => d.status === 'on_duty').length
  const inactiveCount  = drivers.filter((d) => d.status === 'inactive').length

  const columns = [
    {
      key: 'name',
      label: 'Nama Driver',
      render: (v, row) => {
        const warning = getExpiryStatus(row.rawLicenseExpiry)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="adm-table__cell-main">{v}</span>
            {warning && (
              <span className={`adm-expiry-badge adm-expiry-badge--${warning.status}`} title={warning.label}>
                <Icon name={warning.status === 'expired' ? 'error' : 'warning'} size={12} />
                {warning.label}
              </span>
            )}
          </div>
        )
      },
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

      {/* Premium KPI Cards */}
      <div className="adm-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: '1.25rem' }}>
        <div className="adm-kpi-card" style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div className="adm-kpi-card__header">
            <div className="adm-kpi-card__icon" style={{ background: 'rgba(0,36,66,0.05)', color: 'var(--dash-primary)' }}>
              <Icon name="people" size={24} />
            </div>
          </div>
          <div>
            <h3 className="adm-kpi-card__value">{drivers.length}</h3>
            <p className="adm-kpi-card__label">Total Driver</p>
            <p className="adm-kpi-card__sublabel">Seluruh driver terdaftar</p>
          </div>
        </div>

        <div className="adm-kpi-card" style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div className="adm-kpi-card__header">
            <div className="adm-kpi-card__icon" style={{ background: 'rgba(34,197,94,0.08)', color: '#16a34a' }}>
              <Icon name="check_circle" size={24} />
            </div>
          </div>
          <div>
            <h3 className="adm-kpi-card__value">{availableCount}</h3>
            <p className="adm-kpi-card__label">Tersedia</p>
            <p className="adm-kpi-card__sublabel">Siap untuk penugasan</p>
          </div>
        </div>

        <div className="adm-kpi-card" style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div className="adm-kpi-card__header">
            <div className="adm-kpi-card__icon" style={{ background: 'rgba(59,130,246,0.08)', color: '#2563eb' }}>
              <Icon name="local_shipping" size={24} />
            </div>
          </div>
          <div>
            <h3 className="adm-kpi-card__value">{onDutyCount}</h3>
            <p className="adm-kpi-card__label">On Duty</p>
            <p className="adm-kpi-card__sublabel">Sedang dalam perjalanan</p>
          </div>
        </div>

        <div className="adm-kpi-card" style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div className="adm-kpi-card__header">
            <div className="adm-kpi-card__icon" style={{ background: 'rgba(186,26,26,0.08)', color: '#93000a' }}>
              <Icon name="block" size={24} />
            </div>
          </div>
          <div>
            <h3 className="adm-kpi-card__value">{inactiveCount}</h3>
            <p className="adm-kpi-card__label">Tidak Aktif</p>
            <p className="adm-kpi-card__sublabel">Sedang tidak bertugas</p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mt-6">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Icon name="search" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama driver, telepon, atau no. SIM..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-dash-secondary/20 focus:border-dash-secondary transition-all placeholder:text-gray-400"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-px">
          {filters.map((f) => {
            const count =
              f.id === 'all'
                ? drivers.length
                : drivers.filter((d) => d.status === f.id).length
            const isActive = filter === f.id
            return (
              <button
                key={f.id}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${isActive ? 'border-dash-primary text-dash-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                onClick={() => {
                  setFilter(f.id)
                  setCurrentPage(1)
                }}
              >
                {f.label} 
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-dash-primary/10 text-dash-primary' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
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
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div 
                style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--dash-secondary) 0%, #d49811 100%)',
                  color: 'var(--dash-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', fontWeight: 900, boxShadow: '0 4px 15px rgba(254,195,48,0.3)',
                  flexShrink: 0
                }}
              >
                {(selectedDriver.name || 'D').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
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

            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title">
                <Icon name="directions_car" size={16} /> Kendaraan Utama
              </h4>
              {selectedDriver.primaryVehicle ? (
                <>
                  <div className="adm-detail-row">
                    <span className="adm-detail-label">No. Plat</span>
                    <span className="adm-detail-value">{selectedDriver.primaryVehicle.licensePlate}</span>
                  </div>
                  <div className="adm-detail-row">
                    <span className="adm-detail-label">Jenis</span>
                    <span className="adm-detail-value">{selectedDriver.primaryVehicle.type}</span>
                  </div>
                </>
              ) : (
                <div className="adm-detail-row">
                  <span className="adm-detail-label" style={{ fontStyle: 'italic', color: '#9ca3af' }}>Belum dipasangkan ke kendaraan</span>
                </div>
              )}
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
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['A', 'B1', 'B2'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLicenseType(type)}
                    style={{
                      flex: 1,
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: `2px solid ${licenseType === type ? 'var(--dash-secondary)' : '#e2e8f0'}`,
                      background: licenseType === type ? 'rgba(254,195,48,0.1)' : '#fff',
                      color: licenseType === type ? 'var(--dash-primary)' : '#64748b',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                  >
                    SIM {type}
                  </button>
                ))}
              </div>
            </AdminFormField>

            <AdminFormField label="Masa Berlaku SIM" required>
              <AdminDatePicker
                value={licenseExpiry}
                onChange={setLicenseExpiry}
                placeholder="Pilih Tanggal Masa Berlaku"
              />
            </AdminFormField>

            {isEditMode && (
              <AdminFormField label="Status" required>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[
                    { value: 'ACTIVE', label: 'Tersedia' },
                    { value: 'UNAVAILABLE', label: 'Tidak Aktif' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      style={{
                        flex: 1,
                        padding: '0.7rem',
                        borderRadius: '8px',
                        border: `2px solid ${status === opt.value ? 'var(--dash-secondary)' : '#e2e8f0'}`,
                        background: status === opt.value ? 'rgba(254,195,48,0.1)' : '#fff',
                        color: status === opt.value ? 'var(--dash-primary)' : '#64748b',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </AdminFormField>
            )}
          </div>
        </AdminModal>
      )}
    </div>
  )
}
