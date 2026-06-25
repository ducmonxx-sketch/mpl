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

const getExpiryStatus = (dateStr) => {
  if (!dateStr) return null
  const exp = new Date(dateStr)
  const now = new Date()
  const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return { status: 'expired', label: 'Expired' }
  if (daysLeft <= 30) return { status: 'warning', label: `${daysLeft} hari lagi` }
  return null
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
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState(null)
  const [status, setStatus] = useState('AVAILABLE')

  const fetchVehicles = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const data = await fleetAPI.getVehicles()
      const mapped = (data.vehicles || data || []).map((v) => ({
        id: v.id,
        type: v.type || '-',
        licensePlate: v.licensePlate || '-',
        status: mapVehicleStatus(v.status),
        rawStatus: v.status,
        stnkExpiry: formatDate(v.stnkExpiry),
        rawStnkExpiry: v.stnkExpiry,
        kirExpiry: formatDate(v.kirExpiry),
        rawKirExpiry: v.kirExpiry,
        assignments: v._count?.shipments ?? 0,
      }))
      setVehicles(mapped)
    } catch (err) {
      console.error('Failed to fetch vehicles:', err)
      showToast(err.message || 'Gagal memuat data armada.', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchVehicles()
    const interval = setInterval(() => fetchVehicles({ silent: true }), 8000)
    return () => clearInterval(interval)
  }, [fetchVehicles])

  const resetForm = () => {
    setIsEditMode(false)
    setEditingVehicleId(null)
    setType('')
    setLicensePlate('')
    setStnkExpiry('')
    setKirExpiry('')
    setStatus('AVAILABLE')
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
    setEditingVehicleId(row.id)
    setType(row.type || '')
    setLicensePlate(row.licensePlate || '')
    
    let stnkDate = ''
    if (row.rawStnkExpiry) {
      stnkDate = new Date(row.rawStnkExpiry).toISOString().substring(0, 10)
    }
    setStnkExpiry(stnkDate)
    
    let kirDate = ''
    if (row.rawKirExpiry) {
      kirDate = new Date(row.rawKirExpiry).toISOString().substring(0, 10)
    }
    setKirExpiry(kirDate)
    setStatus(row.rawStatus || 'AVAILABLE')
    setShowCreateModal(true)
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

  const handleUpdateVehicle = async () => {
    if (!type || !licensePlate.trim() || !stnkExpiry || !kirExpiry) {
      showToast('Harap lengkapi semua field yang wajib diisi.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await fleetAPI.updateVehicle(editingVehicleId, {
        type,
        licensePlate,
        stnkExpiry,
        kirExpiry,
        status,
      })
      showToast('Kendaraan berhasil diperbarui!', 'success')
      setShowCreateModal(false)
      resetForm()
      await fetchVehicles()
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui kendaraan.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteVehicle = async (id, plate) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus kendaraan dengan no plat "${plate}"? Penugasan pengirimannya akan dikosongkan.`)) {
      return
    }
    try {
      await fleetAPI.deleteVehicle(id)
      showToast('Kendaraan berhasil dihapus.', 'success')
      if (selectedVehicle?.id === id) {
        setSelectedVehicle(null)
      }
      await fetchVehicles()
    } catch (err) {
      showToast(err.message || 'Gagal menghapus kendaraan.', 'error')
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
    {
      key: 'stnkExpiry',
      label: 'Masa Berlaku STNK',
      render: (v, row) => {
        const warning = getExpiryStatus(row.rawStnkExpiry)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{v}</span>
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
    {
      key: 'kirExpiry',
      label: 'Masa Berlaku KIR',
      render: (v, row) => {
        const warning = getExpiryStatus(row.rawKirExpiry)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{v}</span>
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
              handleDeleteVehicle(row.id, row.licensePlate)
            }}
          >
            <Icon name="delete" size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 w-full relative">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl md:text-3xl font-black text-[#002442] tracking-tight">Armada Kendaraan</h2>
          <p className="text-sm text-gray-500 font-medium">Kelola kendaraan, status, dan dokumen armada.</p>
        </div>
        <button 
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#fec330] hover:bg-[#eab308] text-[#002442] font-bold rounded-xl shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5" 
          onClick={handleOpenCreateModal}
        >
          <Icon name="add" size={18} /> Tambah Kendaraan
        </button>
      </section>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Icon name="search" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari jenis kendaraan atau no. plat..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] transition-all placeholder:text-gray-400"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-px">
          {filters.map((f) => {
            const count =
              f.id === 'all'
                ? vehicles.length
                : vehicles.filter((v) => v.status === f.id).length
            const isActive = filter === f.id
            return (
              <button
                key={f.id}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${isActive ? 'border-[#002442] text-[#002442]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                onClick={() => {
                  setFilter(f.id)
                  setCurrentPage(1)
                }}
              >
                {f.label} 
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-[#002442]/10 text-[#002442]' : 'bg-gray-100 text-gray-500'}`}>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Kendaraan', value: vehicles.length, icon: 'directions_car', color: 'text-gray-600', bg: 'bg-gray-50' },
          { label: 'Tersedia', value: availableCount, icon: 'check_circle', color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Digunakan', value: inUseCount, icon: 'local_shipping', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Perawatan', value: maintenanceCount, icon: 'build', color: 'text-red-600', bg: 'bg-red-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
              <Icon name={stat.icon} size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-[#002442]">{stat.value}</span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Slide-over Detail Panel */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#002442]/20 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedVehicle(null)}
          />
          
          {/* Panel */}
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-100">
            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-gray-100 bg-gray-50/50">
              <div>
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${
                    selectedVehicle.status === 'AVAILABLE' ? 'bg-green-50 text-green-700 border-green-200' :
                    selectedVehicle.status === 'IN_USE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {VEHICLE_STATUS_DISPLAY[selectedVehicle.status] || selectedVehicle.status}
                </span>
                <h3 className="text-2xl font-black text-[#002442] mt-3">
                  {selectedVehicle.licensePlate}
                </h3>
              </div>
              <button 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:text-[#002442] hover:bg-gray-50 transition-colors shadow-sm"
                onClick={() => setSelectedVehicle(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
              <div className="flex flex-col gap-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                  <Icon name="directions_car" size={18} className="text-gray-400" /> Informasi Kendaraan
                </h4>
                <div className="grid grid-cols-2 gap-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">No. Plat</span>
                    <span className="text-sm font-bold text-[#002442]">{selectedVehicle.licensePlate}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Jenis</span>
                    <span className="text-sm font-bold text-[#002442]">{selectedVehicle.type}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Penugasan</span>
                    <span className="text-sm font-bold text-[#002442]">{selectedVehicle.assignments}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                  <Icon name="description" size={18} className="text-gray-400" /> Dokumen Kendaraan
                </h4>
                <div className="flex flex-col gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Masa Berlaku STNK</span>
                      <span className="text-sm font-bold text-[#002442]">{selectedVehicle.stnkExpiry}</span>
                    </div>
                    <Icon name="event" size={24} className="text-gray-300" />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Masa Berlaku KIR</span>
                      <span className="text-sm font-bold text-[#002442]">{selectedVehicle.kirExpiry}</span>
                    </div>
                    <Icon name="event" size={24} className="text-gray-300" />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer actions */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/50">
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 font-bold rounded-xl transition-all shadow-sm"
                onClick={() => {
                  handleOpenEdit(selectedVehicle)
                  setSelectedVehicle(null)
                }}
              >
                <Icon name="edit" size={18} /> Edit Data Kendaraan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <AdminModal
          title={isEditMode ? 'Edit Kendaraan' : 'Tambah Kendaraan Baru'}
          subtitle={isEditMode ? 'Ubah data kendaraan dan dokumen armada.' : 'Isi data kendaraan dan dokumen armada.'}
          onClose={handleCloseCreateModal}
          onSubmit={isEditMode ? handleUpdateVehicle : handleCreateVehicle}
          submitLabel={submitting ? 'Menyimpan...' : (isEditMode ? 'Simpan Perubahan' : 'Simpan Kendaraan')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminFormField label="Jenis Kendaraan" required>
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
              >
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
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
              />
            </AdminFormField>

            <AdminFormField label="Masa Berlaku STNK" required>
              <input
                type="date"
                value={stnkExpiry}
                onChange={(e) => setStnkExpiry(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
              />
            </AdminFormField>

            <AdminFormField label="Masa Berlaku KIR" required>
              <input
                type="date"
                value={kirExpiry}
                onChange={(e) => setKirExpiry(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
              />
            </AdminFormField>

            {isEditMode && (
              <AdminFormField label="Status Kendaraan" required>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                >
                  <option value="AVAILABLE">Tersedia</option>
                  <option value="IN_USE">Digunakan</option>
                  <option value="MAINTENANCE">Perawatan</option>
                </select>
              </AdminFormField>
            )}
          </div>
        </AdminModal>
      )}
    </div>
  )
}
