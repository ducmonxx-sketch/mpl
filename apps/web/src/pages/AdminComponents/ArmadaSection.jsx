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
  const [chassisNumber, setChassisNumber] = useState('')
  const [engineNumber, setEngineNumber] = useState('')
  const [stnkExpiry, setStnkExpiry] = useState('')
  const [kirExpiry, setKirExpiry] = useState('')
  const [serviceDate, setServiceDate] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState(null)
  const [status, setStatus] = useState('AVAILABLE')

  // Service Modal state
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [serviceVehicleId, setServiceVehicleId] = useState(null)
  const [serviceNotes, setServiceNotes] = useState('')

  // Pair Driver Modal state
  const [showPairModal, setShowPairModal] = useState(false)
  const [pairingVehicle, setPairingVehicle] = useState(null)
  const [availableDrivers, setAvailableDrivers] = useState([])
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [pairing, setPairing] = useState(false)

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
        chassisNumber: v.chassisNumber || '-',
        engineNumber: v.engineNumber || '-',
        serviceDate: formatDate(v.serviceDate),
        rawServiceDate: v.serviceDate,
        assignments: v._count?.shipments ?? 0,
        primaryDriver: v.primaryDriver || null,
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

  useEffect(() => {
    if (!loading) {
      import('animejs').then((animeModule) => {
        const anime = animeModule.default
        anime({
          targets: '.adm-kpi-card',
          translateY: [20, 0],
          opacity: [0, 1],
          easing: 'easeOutElastic(1, .8)',
          duration: 800,
          delay: anime.stagger(100)
        })
      })
    }
  }, [loading])

  useEffect(() => {
    if (selectedVehicle) {
      import('animejs').then((animeModule) => {
        const anime = animeModule.default
        anime({
          targets: '.adm-detail-panel',
          translateX: [50, 0],
          opacity: [0, 1],
          easing: 'easeOutExpo',
          duration: 400
        })
      })
    }
  }, [selectedVehicle])

  const resetForm = () => {
    setIsEditMode(false)
    setEditingVehicleId(null)
    setType('')
    setLicensePlate('')
    setChassisNumber('')
    setEngineNumber('')
    setStnkExpiry('')
    setKirExpiry('')
    setServiceDate('')
    setStatus('AVAILABLE')
    setSelectedDriverId('')
  }

  const handleOpenCreateModal = async () => {
    resetForm()
    setShowCreateModal(true)
    // Load drivers so a primary driver can be paired at creation time.
    setLoadingDrivers(true)
    try {
      const data = await fleetAPI.getDrivers()
      setAvailableDrivers((data.drivers || []).filter(d => d.status !== 'UNAVAILABLE'))
    } catch {
      showToast('Gagal memuat daftar driver.', 'error')
    } finally {
      setLoadingDrivers(false)
    }
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
    setChassisNumber(row.chassisNumber !== '-' ? row.chassisNumber : '')
    setEngineNumber(row.engineNumber !== '-' ? row.engineNumber : '')
    
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
    
    let serviceDateStr = ''
    if (row.rawServiceDate) {
      serviceDateStr = new Date(row.rawServiceDate).toISOString().substring(0, 10)
    }
    setServiceDate(serviceDateStr)

    setStatus(row.rawStatus || 'AVAILABLE')
    setShowCreateModal(true)
  }

  const handleOpenService = (row) => {
    setServiceVehicleId(row.id)
    
    let serviceDateStr = ''
    if (row.rawServiceDate) {
      serviceDateStr = new Date(row.rawServiceDate).toISOString().substring(0, 10)
    }
    setServiceDate(serviceDateStr)
    setServiceNotes('')
    setShowServiceModal(true)
  }

  const handleCreateVehicle = async () => {
    if (!type || !licensePlate.trim() || !stnkExpiry || !kirExpiry) {
      showToast('Harap lengkapi semua field yang wajib diisi.', 'error')
      return
    }
    if (!selectedDriverId) {
      showToast('Pilih driver utama untuk kendaraan ini.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const { vehicle } = await fleetAPI.addVehicle({ type, licensePlate, stnkExpiry, kirExpiry, chassisNumber, engineNumber, serviceDate })
      // Vehicle created → pair the chosen primary driver (separate endpoint).
      try {
        await fleetAPI.pairDriver(vehicle.id, selectedDriverId)
        showToast('Kendaraan baru ditambahkan & driver utama dipasangkan!', 'success')
      } catch (pairErr) {
        showToast(`Kendaraan dibuat, tetapi gagal memasangkan driver: ${pairErr.message}. Pasangkan manual dari daftar armada.`, 'error')
      }
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
        chassisNumber,
        engineNumber,
        serviceDate,
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

  const handleSaveService = async () => {
    if (!serviceDate) {
      showToast('Harap pilih Tanggal Service.', 'error')
      return
    }
    setSubmitting(true)
    try {
      // Find the existing vehicle to merge its other properties
      const existing = vehicles.find(v => v.id === serviceVehicleId)
      
      // Update just the service date (we send everything else as is since backend expects full update currently)
      await fleetAPI.updateVehicle(serviceVehicleId, {
        type: existing.type,
        licensePlate: existing.licensePlate,
        stnkExpiry: existing.rawStnkExpiry,
        kirExpiry: existing.rawKirExpiry,
        chassisNumber: existing.chassisNumber !== '-' ? existing.chassisNumber : '',
        engineNumber: existing.engineNumber !== '-' ? existing.engineNumber : '',
        status: existing.rawStatus,
        serviceDate,
        // Service notes could be sent here if backend supported it: serviceNotes
      })
      showToast('Jadwal service berhasil diperbarui!', 'success')
      setShowServiceModal(false)
      setServiceVehicleId(null)
      setServiceDate('')
      setServiceNotes('')
      await fetchVehicles()
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui jadwal service.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenPairModal = async (row) => {
    setPairingVehicle(row)
    setSelectedDriverId('')
    setShowPairModal(true)
    setLoadingDrivers(true)
    try {
      const data = await import('../../lib/api').then(m => m.fleetAPI.getDrivers())
      // Show all non-UNAVAILABLE drivers; ON_DUTY ones are shown but disabled
      setAvailableDrivers((data.drivers || []).filter(d => d.status !== 'UNAVAILABLE'))
    } catch {
      showToast('Gagal memuat daftar driver.', 'error')
      setShowPairModal(false)
    } finally {
      setLoadingDrivers(false)
    }
  }

  const handlePairDriver = async () => {
    if (!selectedDriverId) {
      showToast('Pilih driver terlebih dahulu.', 'error')
      return
    }
    setPairing(true)
    try {
      await fleetAPI.pairDriver(pairingVehicle.id, selectedDriverId)
      showToast('Driver berhasil dipasangkan ke kendaraan.', 'success')
      setShowPairModal(false)
      setPairingVehicle(null)
      setSelectedDriverId('')
      await fetchVehicles()
    } catch (err) {
      showToast(err.message || 'Gagal memasangkan driver.', 'error')
    } finally {
      setPairing(false)
    }
  }

  const handleUnpairDriver = async (vehicleId) => {
    if (!window.confirm('Lepaskan driver utama dari kendaraan ini?')) return
    try {
      await fleetAPI.unpairDriver(vehicleId)
      showToast('Driver berhasil dilepaskan.', 'success')
      if (selectedVehicle?.id === vehicleId) setSelectedVehicle(null)
      await fetchVehicles()
    } catch (err) {
      showToast(err.message || 'Gagal melepaskan driver.', 'error')
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
      key: 'serviceDate',
      label: 'Tanggal Service',
      render: (v, row) => {
        const warning = getExpiryStatus(row.rawServiceDate)
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
      key: 'primaryDriver',
      label: 'Driver Utama',
      render: (v) => {
        if (!v) return <span className="text-gray-400 text-xs italic">Belum dipasangkan</span>
        const isOnDuty = v.status === 'ON_DUTY'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="adm-table__cell-main">{v.fullName}</span>
            {isOnDuty && (
              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '99px', background: 'rgba(59,130,246,0.12)', color: '#2563eb' }}>
                On Duty
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
            title={row.primaryDriver ? 'Ganti Driver Utama' : 'Pasangkan Driver'}
            style={{ color: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)' }}
            onClick={(e) => {
              e.stopPropagation()
              handleOpenPairModal(row)
            }}
          >
            <Icon name="person_add" size={16} />
          </button>
          <button
            className="adm-action-btn"
            title="Update Service"
            style={{ color: '#eab308', backgroundColor: 'rgba(234, 179, 8, 0.1)' }}
            onClick={(e) => {
              e.stopPropagation()
              handleOpenService(row)
            }}
          >
            <Icon name="build" size={16} />
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
          <h2 className="text-2xl md:text-3xl font-black text-dash-primary tracking-tight">Daftar Kendaraan</h2>
          <p className="text-sm text-gray-500 font-medium">Kelola kendaraan, status, dan dokumen armada.</p>
        </div>
        <button 
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-dash-secondary hover:brightness-110 text-dash-primary font-bold rounded-xl shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5" 
          onClick={handleOpenCreateModal}
        >
          <Icon name="add" size={18} /> Tambah Kendaraan
        </button>
      </section>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
        {[
          { label: 'Total Kendaraan', value: vehicles.length, icon: 'directions_car', color: 'text-gray-600', bg: 'bg-gray-50' },
          { label: 'Tersedia', value: availableCount, icon: 'check_circle', color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Digunakan', value: inUseCount, icon: 'local_shipping', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Perawatan', value: maintenanceCount, icon: 'build', color: 'text-red-600', bg: 'bg-red-50' },
        ].map((stat, i) => (
          <div key={i} className="adm-kpi-card bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
              <Icon name={stat.icon} size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-dash-primary">{stat.value}</span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

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
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-dash-secondary/20 focus:border-dash-secondary transition-all placeholder:text-gray-400"
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

      {/* Slide-over Detail Panel */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-dash-primary/20 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedVehicle(null)}
          />
          
          {/* Panel */}
          <div className="adm-detail-panel opacity-0 relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-gray-100">
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
                <h3 className="text-2xl font-black text-dash-primary mt-3">
                  {selectedVehicle.licensePlate}
                </h3>
              </div>
              <button 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:text-dash-primary hover:bg-gray-50 transition-colors shadow-sm"
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
                    <span className="text-sm font-bold text-dash-primary">{selectedVehicle.licensePlate}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Jenis</span>
                    <span className="text-sm font-bold text-dash-primary">{selectedVehicle.type}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Nomor Rangka</span>
                    <span className="text-sm font-bold text-dash-primary">{selectedVehicle.chassisNumber}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Nomor Mesin</span>
                    <span className="text-sm font-bold text-dash-primary">{selectedVehicle.engineNumber}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Penugasan</span>
                    <span className="text-sm font-bold text-dash-primary">{selectedVehicle.assignments}</span>
                  </div>
                </div>
              </div>

              {/* Primary Driver */}
              <div className="flex flex-col gap-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                  <Icon name="person" size={18} className="text-gray-400" /> Driver Utama
                </h4>
                {selectedVehicle.primaryDriver ? (
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-dash-primary">{selectedVehicle.primaryDriver.fullName}</span>
                      <span className="text-xs text-gray-500">{selectedVehicle.primaryDriver.phoneNumber || '-'}</span>
                      {selectedVehicle.primaryDriver.status === 'ON_DUTY' && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: 'rgba(59,130,246,0.12)', color: '#2563eb', display: 'inline-block', marginTop: '2px' }}>
                          Sedang Bertugas
                        </span>
                      )}
                    </div>
                    <button
                      className="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                      onClick={() => handleUnpairDriver(selectedVehicle.id)}
                    >
                      Lepas
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center">
                    <span className="text-sm text-gray-400 italic">Belum ada driver utama</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                  <Icon name="description" size={18} className="text-gray-400" /> Dokumen Kendaraan
                </h4>
                <div className="flex flex-col gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Masa Berlaku STNK</span>
                      <span className="text-sm font-bold text-dash-primary">{selectedVehicle.stnkExpiry}</span>
                    </div>
                    <Icon name="event" size={24} className="text-gray-300" />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Masa Berlaku KIR</span>
                      <span className="text-sm font-bold text-dash-primary">{selectedVehicle.kirExpiry}</span>
                    </div>
                    <Icon name="event" size={24} className="text-gray-300" />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tanggal Service</span>
                      <span className="text-sm font-bold text-dash-primary">{selectedVehicle.serviceDate}</span>
                    </div>
                    <Icon name="build" size={24} className="text-gray-300" />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer actions */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-3">
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm"
                onClick={() => {
                  handleOpenPairModal(selectedVehicle)
                  setSelectedVehicle(null)
                }}
              >
                <Icon name="person_add" size={18} />
                {selectedVehicle.primaryDriver ? 'Ganti Driver Utama' : 'Pasangkan Driver'}
              </button>
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#fec330] hover:bg-[#eab308] text-[#002442] font-bold rounded-xl transition-all shadow-sm"
                onClick={() => {
                  handleOpenService(selectedVehicle)
                  setSelectedVehicle(null)
                }}
              >
                <Icon name="build" size={18} /> Perbarui Jadwal Service
              </button>
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
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-dash-secondary/20 focus:border-dash-secondary outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
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
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-dash-secondary/20 focus:border-dash-secondary outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
              />
            </AdminFormField>

            <AdminFormField label="Nomor Rangka">
              <input
                type="text"
                placeholder="MH123..."
                value={chassisNumber}
                onChange={(e) => setChassisNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-dash-secondary/20 focus:border-dash-secondary outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
              />
            </AdminFormField>

            <AdminFormField label="Nomor Mesin">
              <input
                type="text"
                placeholder="4D56..."
                value={engineNumber}
                onChange={(e) => setEngineNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-dash-secondary/20 focus:border-dash-secondary outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
              />
            </AdminFormField>

            <AdminFormField label="Masa Berlaku STNK" required>
              <AdminDatePicker
                value={stnkExpiry}
                onChange={setStnkExpiry}
                placeholder="Pilih Tanggal STNK"
              />
            </AdminFormField>

            <AdminFormField label="Masa Berlaku KIR" required>
              <AdminDatePicker
                value={kirExpiry}
                onChange={setKirExpiry}
                placeholder="Pilih Tanggal KIR"
              />
            </AdminFormField>

            <AdminFormField label="Tanggal Service">
              <AdminDatePicker
                value={serviceDate}
                onChange={setServiceDate}
                placeholder="Pilih Tanggal Service"
              />
            </AdminFormField>

            {isEditMode && (
              <AdminFormField label="Status Kendaraan" required>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-dash-secondary/20 focus:border-dash-secondary outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                >
                  <option value="AVAILABLE">Tersedia</option>
                  <option value="IN_USE">Digunakan</option>
                  <option value="MAINTENANCE">Perawatan</option>
                </select>
              </AdminFormField>
            )}
          </div>

          {/* Pair a primary driver at creation time (required for new vehicles) */}
          {!isEditMode && (
            <div className="mt-5">
              <label className="block text-sm font-bold text-dash-primary mb-1">
                Driver Utama <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Pasangkan driver utama untuk kendaraan ini (wajib). Driver yang sudah dipasangkan ke kendaraan lain atau tidak tersedia tidak ditampilkan.
              </p>
              {loadingDrivers ? (
                <div className="text-center py-4 text-gray-400 text-sm">Memuat daftar driver...</div>
              ) : (() => {
                const opts = availableDrivers.filter(d => !vehicles.some(v => v.primaryDriver?.id === d.id))
                if (opts.length === 0) {
                  return <p className="text-sm text-amber-600 py-2">Tidak ada driver bebas untuk dipasangkan. Tambah driver baru atau lepaskan driver dari kendaraan lain terlebih dahulu.</p>
                }
                return (
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {opts.map((d) => {
                      const isOnDuty = d.status === 'ON_DUTY'
                      return (
                        <label
                          key={d.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                            isOnDuty
                              ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50'
                              : selectedDriverId === d.id
                              ? 'border-dash-secondary bg-dash-secondary/10 cursor-pointer'
                              : 'border-gray-200 hover:border-dash-secondary/50 bg-white cursor-pointer'
                          }`}
                        >
                          <input
                            type="radio"
                            name="createPairDriver"
                            value={d.id}
                            disabled={isOnDuty}
                            checked={selectedDriverId === d.id}
                            onChange={() => setSelectedDriverId(d.id)}
                            className="accent-dash-secondary"
                          />
                          <div className="flex-1 text-sm">
                            <p className="font-bold text-dash-primary">{d.fullName}</p>
                            <p className="text-xs text-gray-500">{d.phoneNumber || '-'} · SIM {d.licenseType || '-'}</p>
                          </div>
                          {isOnDuty && <span className="text-[0.65rem] font-bold text-blue-600">Bertugas</span>}
                        </label>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}
        </AdminModal>
      )}

      {/* Pair Driver Modal */}
      {showPairModal && (
        <AdminModal
          title={pairingVehicle?.primaryDriver ? 'Ganti Driver Utama' : 'Pasangkan Driver Utama'}
          subtitle={`Kendaraan: ${pairingVehicle?.licensePlate} — ${pairingVehicle?.type}`}
          onClose={() => { setShowPairModal(false); setPairingVehicle(null); setSelectedDriverId('') }}
          onSubmit={handlePairDriver}
          submitLabel={pairing ? 'Menyimpan...' : 'Pasangkan Driver'}
        >
          {loadingDrivers ? (
            <div className="text-center py-6 text-gray-400">
              <Icon name="sync" size={24} />
              <p className="mt-2 text-sm">Memuat daftar driver...</p>
            </div>
          ) : availableDrivers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Tidak ada driver tersedia.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-500">Pilih driver untuk dipasangkan sebagai driver utama kendaraan ini. Driver On Duty tidak dapat dipilih.</p>
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {availableDrivers.map((d) => {
                  const isOnDuty = d.status === 'ON_DUTY'
                  const licExpiry = d.licenseExpiry ? getExpiryStatus(d.licenseExpiry) : null
                  return (
                    <label
                      key={d.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isOnDuty
                          ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50'
                          : selectedDriverId === d.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pairDriver"
                        value={d.id}
                        disabled={isOnDuty}
                        checked={selectedDriverId === d.id}
                        onChange={() => setSelectedDriverId(d.id)}
                        className="mt-1 accent-indigo-600"
                      />
                      <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div>
                          <p className="font-bold text-dash-primary">{d.fullName}</p>
                          <p className="text-xs text-gray-500">{d.phoneNumber || '-'}</p>
                          {isOnDuty && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#2563eb' }}>Sedang Bertugas</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          <p>SIM: {d.licenseType || '-'}</p>
                          <p className="flex items-center gap-1">
                            Exp: {d.licenseExpiry ? new Date(d.licenseExpiry).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                            {licExpiry && (
                              <span className={`adm-expiry-badge adm-expiry-badge--${licExpiry.status}`}>
                                <Icon name={licExpiry.status === 'expired' ? 'error' : 'warning'} size={10} />
                                {licExpiry.label}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </AdminModal>
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <AdminModal
          title="Perbarui Jadwal Service"
          subtitle="Tentukan tanggal service berikutnya untuk kendaraan ini."
          onClose={() => {
            setShowServiceModal(false)
            setServiceDate('')
            setServiceNotes('')
          }}
          onSubmit={handleSaveService}
          submitLabel={submitting ? 'Menyimpan...' : 'Simpan Jadwal Service'}
        >
          <div className="flex flex-col gap-4">
            <AdminFormField label="Tanggal Service Berikutnya" required>
              <AdminDatePicker
                value={serviceDate}
                onChange={setServiceDate}
                placeholder="Pilih Tanggal Service"
              />
            </AdminFormField>
            
            <AdminFormField label="Catatan Service (Opsional)">
              <textarea
                placeholder="Cth: Ganti oli mesin, cek rem depan..."
                value={serviceNotes}
                onChange={(e) => setServiceNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-dash-secondary/20 focus:border-dash-secondary outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white resize-none"
              />
            </AdminFormField>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
