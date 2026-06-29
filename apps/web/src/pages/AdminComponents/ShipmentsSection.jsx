import { useState, useEffect, useCallback } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import { shipmentsAPI, usersAPI, fleetAPI } from '../../lib/api'
import AdminDataTable from './components/AdminDataTable'
import AdminStatusBadge from './components/AdminStatusBadge'
import AdminPagination from './components/AdminPagination'
import AdminModal from './components/AdminModal'
import AdminFormField from './components/AdminFormField'
import SearchableSelect from './components/SearchableSelect'
import AdminDatePicker from './components/AdminDatePicker'

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

const formatRupiahInput = (value) => {
  const num = String(value).replace(/\D/g, '')
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const parseRupiahInput = (formatted) => {
  return formatted.replace(/\D/g, '')
}

export default function ShipmentsSection({ onTrackFull, highlightShipmentId }) {
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
  const [formOriginPoint, setFormOriginPoint]         = useState('')
  const [formDestination, setFormDestination]         = useState('')
  const [formDestinationPoint, setFormDestinationPoint] = useState('')
  const [formPickupDate, setFormPickupDate]           = useState('')
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

  useEffect(() => {
    if (highlightShipmentId && SHIPMENTS.length > 0) {
      const found = SHIPMENTS.find(s => s.id === highlightShipmentId)
      if (found) setSelectedShipment(found)
    }
  }, [highlightShipmentId, SHIPMENTS])

  useEffect(() => {
    if (!loading) {
      import('animejs').then(animeModule => {
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
    if (selectedShipment) {
      import('animejs').then(animeModule => {
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
  }, [selectedShipment])

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
    setFormOriginPoint('')
    setFormDestination('')
    setFormDestinationPoint('')
    setFormPickupDate('')
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
      showToast('Harap isi Alamat Penjemputan.', 'error')
      return
    }
    if (!formDestination.trim()) {
      showToast('Harap isi Alamat Pengiriman.', 'error')
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

    const finalOrigin = formOriginPoint.trim() ? `${formOriginPoint.trim()} - ${formOrigin.trim()}` : formOrigin.trim()
    const finalDestination = formDestinationPoint.trim() ? `${formDestinationPoint.trim()} - ${formDestination.trim()}` : formDestination.trim()

    try {
      await shipmentsAPI.create({
        clientId:            formClientId,
        packageType:         formPackageType,
        weightKg:            Number(formWeight) || 0,
        units:               formUnits ? Number(formUnits) : null,
        serviceLevel:        formService,
        originLocation:      finalOrigin,
        destinationLocation: finalDestination,
        specialNotes:        formNotes || null,
        pickupDate:          formPickupDate ? new Date(formPickupDate).toISOString() : null,
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

      // Hardcoded tracking animation when status updates
      import('animejs').then(animeModule => {
        const anime = animeModule.default
        anime({
          targets: '.adm-status-badge',
          scale: [0.8, 1.1, 1],
          opacity: [0.5, 1],
          easing: 'easeOutElastic(1, .5)',
          duration: 800,
        })
      })
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleNotifyDriver = async () => {
    try {
      showToast('Mengirim notifikasi WhatsApp ke driver...', 'success')
      await shipmentsAPI.notifyDriver(selectedShipment.id)
      showToast('Notifikasi WhatsApp berhasil dikirim ke driver!', 'success')
    } catch (err) {
      showToast(err.message || 'Gagal mengirim notifikasi WhatsApp.', 'error')
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
        <div className="flex items-center justify-end gap-2">
          <button
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 bg-gray-100 hover:bg-dash-primary hover:text-white transition-colors"
            title="Lihat Detail"
            onClick={(e) => { e.stopPropagation(); setSelectedShipment(row) }}
          >
            <Icon name="visibility" size={16} />
          </button>
          <button
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${row.status === 'delivered' ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-gray-500 bg-gray-100 hover:bg-dash-secondary hover:text-dash-primary'}`}
            title={row.status === 'delivered' ? 'Pengiriman Selesai (Terkunci)' : 'Tugaskan Driver'}
            onClick={(e) => { e.stopPropagation(); openAssignModal(row) }}
            disabled={row.status === 'delivered'}
          >
            <Icon name="person_add" size={16} />
          </button>
        </div>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto w-full pb-10">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl md:text-3xl font-black text-dash-primary tracking-tight">Manajemen Pengiriman</h2>
          <p className="text-sm text-gray-500 font-medium">Kelola semua pengiriman dari pickup hingga delivery.</p>
        </div>
        <button 
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-dash-secondary hover:brightness-110 text-dash-primary font-bold rounded-xl shadow-sm transition-all hover:shadow-md" 
          onClick={openCreateModal}
        >
          <Icon name="add" size={20} /> Buat Pengiriman Baru
        </button>
      </section>

      {/* Toolbar: Search & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mt-2 relative z-20">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-72">
            <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari ID order atau nama klien..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-dash-secondary/20 focus:border-dash-secondary transition-all"
            />
          </div>
          <SearchableSelect
            options={Array.from(new Set(SHIPMENTS.map(s => s.client))).sort().map(c => ({ value: c, label: c }))}
            value={filterClient}
            onChange={v => { setFilterClient(v); setCurrentPage(1) }}
            placeholder="Semua Klien (A-Z)"
            searchPlaceholder="Cari klien..."
            allLabel="Semua Klien (A-Z)"
            className="w-full sm:w-56"
          />
          <SearchableSelect
            options={[
              { value: 'Darat', label: 'Darat' },
              { value: 'Laut', label: 'Laut' },
              { value: 'Udara', label: 'Udara' },
              { value: 'inter_island', label: 'Antar Pulau' },
              { value: 'last_mile', label: 'Lokal' },
              { value: 'warehousing', label: 'Gudang' },
            ]}
            value={filterService}
            onChange={v => { setFilterService(v); setCurrentPage(1) }}
            placeholder="Semua Layanan"
            searchPlaceholder="Cari layanan..."
            allLabel="Semua Layanan"
            className="w-full sm:w-48"
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-px">
        {filters.map(f => {
          const baseSet = SHIPMENTS.filter(s =>
            (filterClient  === 'all' || s.client      === filterClient) &&
            (filterService === 'all' || s.serviceType === filterService)
          )
          const count = f.id === 'all'
            ? baseSet.length
            : baseSet.filter(s => s.status === f.id).length
          const isActive = filter === f.id
          
          return (
            <button
              key={f.id}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${isActive ? 'border-dash-primary text-dash-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => { setFilter(f.id); setCurrentPage(1) }}
            >
              {f.label} 
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-dash-primary/10 text-dash-primary' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-3 border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
             <Icon name="sync" size={32} className="animate-spin" />
             <p className="text-sm font-medium">Memuat data pengiriman...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <AdminDataTable columns={columns} data={paginated} onRowClick={setSelectedShipment} />
            <AdminPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* ── Slide-over Detail Panel ── */}
      {selectedShipment && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-dash-primary/20 backdrop-blur-sm z-[100]" onClick={() => setSelectedShipment(null)} />
          {/* Panel */}
          <div className="adm-detail-panel opacity-0 fixed right-0 top-0 h-screen w-full sm:w-[500px] bg-white shadow-2xl z-[101] flex flex-col border-l border-gray-200">
            {/* Panel Header */}
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <AdminStatusBadge status={selectedShipment.status} type="shipment" />
                <button 
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
                  onClick={() => setSelectedShipment(null)}
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
              <h3 className="text-2xl font-black text-dash-primary">
                Detail {selectedShipment.id.startsWith('#') ? selectedShipment.id : `#${selectedShipment.id}`}
              </h3>
              <div className="flex gap-2">
                <select
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:border-dash-secondary"
                  value={selectedShipment.rawStatus}
                  onChange={(e) => handleStatusUpdate(e.target.value)}
                >
                  {RAW_STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {onTrackFull && (
                  <button
                    className="px-3 py-1.5 bg-dash-secondary/15 hover:bg-dash-secondary/25 text-[#795900] rounded-lg text-xs font-bold transition-colors"
                    onClick={() => onTrackFull(selectedShipment.id)}
                  >
                    Lacak Penuh
                  </button>
                )}
              </div>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
              {/* Info Klien */}
              <div className="flex flex-col gap-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                  <Icon name="people" size={18} className="text-gray-400" /> Informasi Klien
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Perusahaan</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.client}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Dibuat oleh</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.createdBy}</span>
                </div>
              </div>

              {/* Rute Pengiriman */}
              <div className="flex flex-col gap-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                  <Icon name="route" size={18} className="text-gray-400" /> Rute Pengiriman
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Asal</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.originCity}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Tujuan</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.destinationCity}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Pickup</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.pickupDate}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Est. Tiba</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.estimatedArrival}</span>
                </div>
              </div>

              {/* Detail Muatan */}
              <div className="flex flex-col gap-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                  <Icon name="inventory_2" size={18} className="text-gray-400" /> Detail Muatan
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Deskripsi</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.cargoDescription}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Berat</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.weightKg} kg</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Units / Pcs</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.units}</span>
                </div>
              </div>

              {/* Driver & Kendaraan */}
              <div className="flex flex-col gap-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                  <Icon name="directions_car" size={18} className="text-gray-400" /> Driver &amp; Kendaraan
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Driver</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.driverName || 'Belum ditugaskan'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Kendaraan</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.vehicleName || 'Belum ditugaskan'}</span>
                </div>
                
                <div className="mt-2">
                  {selectedShipment.driverName ? (
                    <button
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl shadow-sm transition-all"
                      onClick={handleNotifyDriver}
                    >
                      <Icon name="chat" size={18} /> Kirim Notifikasi WhatsApp Driver
                    </button>
                  ) : (
                    <p className="text-xs text-center text-gray-400 italic">
                      Tugaskan driver terlebih dahulu untuk mengirim notifikasi.
                    </p>
                  )}
                </div>

                {selectedShipment.notes && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-800 italic">
                      &ldquo;{selectedShipment.notes}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              {/* Harga */}
              <div className="flex flex-col gap-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                  <Icon name="payments" size={18} className="text-gray-400" /> Harga
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Invoice</span>
                  <span className="text-sm font-black text-green-700 col-span-2">
                    {selectedShipment.price !== null && selectedShipment.price !== undefined
                      ? 'Rp ' + Number(selectedShipment.price).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
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
          <div className="flex flex-col gap-5">
            <AdminFormField label="Pilih Driver" required>
              <select
                value={assignDriverId}
                onChange={e => setAssignDriverId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white"
              >
                <option value="">-- Pilih Driver --</option>
                {availableDrivers.map(d => (
                  <option key={d.id} value={d.id}>{d.fullName}</option>
                ))}
              </select>
            </AdminFormField>
            <AdminFormField label="Pilih Kendaraan" required>
              <select
                value={assignVehicleId}
                onChange={e => setAssignVehicleId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white"
              >
                <option value="">-- Pilih Kendaraan --</option>
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
          <div className="flex flex-col gap-6">
            {/* Grup 1: Informasi Dasar */}
            <div className="bg-gray-50/50 p-5 border border-gray-200 rounded-2xl flex flex-col gap-4">
              <h4 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
                <Icon name="info" size={18} className="text-gray-400" /> Informasi Dasar
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AdminFormField label="Klien" required fullWidth>
                  <select 
                    value={formClientId} 
                    onChange={e => setFormClientId(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                  >
                    <option value="">-- Pilih Klien --</option>
                    {clientOptions.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </AdminFormField>
                <AdminFormField label="Jenis Layanan" required>
                  <select 
                    value={formService} 
                    onChange={e => setFormService(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                  >
                    <option value="Darat">Darat</option>
                    <option value="Laut">Laut</option>
                    <option value="Udara">Udara</option>
                  </select>
                </AdminFormField>
              </div>
            </div>

            {/* Grup 2: Rute & Lokasi */}
            <div className="bg-gray-50/50 p-5 border border-gray-200 rounded-2xl flex flex-col gap-4">
              <h4 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
                <Icon name="route" size={18} className="text-gray-400" /> Rute & Lokasi
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Penjemputan */}
                <AdminFormField label="Alamat Penjemputan" required>
                  <input
                    type="text"
                    placeholder="Cth: Jl. Sudirman No 12"
                    value={formOrigin}
                    onChange={e => setFormOrigin(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                  />
                </AdminFormField>
                <AdminFormField label="Peta Titik Penjemputan">
                  <input
                    type="text"
                    placeholder="Cth: https://maps.app.goo.gl/..."
                    value={formOriginPoint}
                    onChange={e => setFormOriginPoint(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                  />
                </AdminFormField>

                {/* Pengiriman */}
                <AdminFormField label="Alamat Pengiriman" required>
                  <input
                    type="text"
                    placeholder="Cth: Jl. Pahlawan No 8"
                    value={formDestination}
                    onChange={e => setFormDestination(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                  />
                </AdminFormField>
                <AdminFormField label="Peta Titik Pengiriman">
                  <input
                    type="text"
                    placeholder="Cth: https://maps.app.goo.gl/..."
                    value={formDestinationPoint}
                    onChange={e => setFormDestinationPoint(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                  />
                </AdminFormField>

                <AdminFormField label="Tanggal Pickup" required>
                  <AdminDatePicker
                    value={formPickupDate}
                    onChange={setFormPickupDate}
                    placeholder="Pilih Tanggal Pickup"
                  />
                </AdminFormField>
              </div>
            </div>

            {/* Grup 3: Detail Muatan & Harga */}
            <div className="bg-gray-50/50 p-5 border border-gray-200 rounded-2xl flex flex-col gap-4">
              <h4 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
                <Icon name="inventory_2" size={18} className="text-gray-400" /> Detail Muatan & Harga
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AdminFormField label="Deskripsi Barang" required fullWidth>
                  <input
                    type="text"
                    placeholder="Cth: Elektronik, Suku Cadang"
                    value={formPackageType}
                    onChange={e => setFormPackageType(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                  />
                </AdminFormField>

                <AdminFormField label="Units / Pcs" required>
                  <input
                    type="number"
                    min="1"
                    placeholder="0"
                    value={formUnits}
                    onChange={e => setFormUnits(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                  />
                </AdminFormField>

                <AdminFormField label="Berat (kg)">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formWeight}
                    onChange={e => setFormWeight(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                  />
                </AdminFormField>
              </div>

              {/* Invoice Box */}
              <div className="p-5 bg-amber-50/50 border-2 border-amber-200 rounded-2xl my-2">
                <AdminFormField label="Total Invoice Price (Jumlah Harga Invoice)" required>
                  <input
                    type="text"
                    placeholder="Masukkan total harga invoice (Cth: 5,000,000)"
                    value={formPrice ? 'Rp. ' + formatRupiahInput(formPrice) : ''}
                    onChange={e => setFormPrice(parseRupiahInput(e.target.value))}
                    required
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold text-[#002442] focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white"
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
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white custom-scrollbar"
                />
              </AdminFormField>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  )
}

