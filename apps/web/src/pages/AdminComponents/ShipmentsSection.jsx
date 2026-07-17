import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
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

export const STATUS_OPTIONS = ['pending', 'assigned', 'in_transit', 'delivered', 'cancelled']

// Statuses offered as targets in the SUPERADMIN picker (FAILED omitted — legacy only).
const RAW_STATUS_OPTIONS = [
  { value: 'PENDING',     label: 'Menunggu' },
  { value: 'STANDBY',     label: 'Standby' },
  { value: 'DITUGASKAN',  label: 'Ditugaskan' },
  { value: 'AT_PLANT',    label: 'Di Pabrik' },
  { value: 'TRANSIT',     label: 'Dalam Perjalanan' },
  { value: 'DITERIMA',    label: 'Diterima' },
  { value: 'DITURUNKAN',  label: 'Diturunkan' },
  { value: 'DELIVERED',   label: 'Selesai' },
  { value: 'CANCELLED',   label: 'Dibatalkan' },
]

// Forward transitions for regular admins — mirrors statusFlow.ts.
const FORWARD_STATUS = {
  PENDING:    ['STANDBY'],
  STANDBY:    ['DITUGASKAN'],
  DITUGASKAN: ['AT_PLANT'],
  AT_PLANT:   ['TRANSIT'],
  TRANSIT:    ['DITERIMA', 'DELIVERED', 'CANCELLED'],
  DITERIMA:   ['DITURUNKAN', 'CANCELLED'],
  DITURUNKAN: ['DELIVERED'],
  DELIVERED:  [],
  FAILED:     [],
  CANCELLED:  [],
}

// SUPERADMIN: all statuses except current; regular admin: forward-only.
const availableStatusOptions = (role, from) =>
  role === 'SUPERADMIN'
    ? RAW_STATUS_OPTIONS.filter(opt => opt.value !== from)
    : RAW_STATUS_OPTIONS.filter(opt => (FORWARD_STATUS[from] ?? []).includes(opt.value))

const mapStatus = (s) => {
  const map = {
    PENDING:    'pending',
    STANDBY:    'standby',
    DITUGASKAN: 'assigned',
    AT_PLANT:   'at_plant',
    TRANSIT:    'in_transit',
    DITERIMA:   'diterima',
    DITURUNKAN: 'diturunkan',
    DELIVERED:  'delivered',
    FAILED:     'cancelled',
    CANCELLED:  'cancelled',
  }
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

// ── Expiry helpers ────────────────────────────────────────────
const expiryStatus = (dateStr) => {
  if (!dateStr) return 'none'
  const diff = new Date(dateStr) - new Date()
  if (diff < 0) return 'overdue'
  if (diff < 30 * 24 * 60 * 60 * 1000) return 'near'
  return 'ok'
}

const ExpiryLabel = ({ date, label }) => {
  const st = expiryStatus(date)
  const cls = st === 'overdue' ? 'text-red-600 font-bold' : st === 'near' ? 'text-amber-600 font-bold' : 'text-gray-500'
  return (
    <span className={`text-xs ${cls}`}>
      {label}: {formatDate(date)}
      {st === 'overdue' && ' ⚠'}
      {st === 'near' && ' ⚡'}
    </span>
  )
}

// ── 2-column Driver + Vehicle card ────────────────────────────
const DriverVehicleCard = ({ vehicle, selected, onClick }) => {
  const driver = vehicle.primaryDriver
  if (!driver) return null
  return (
    <div
      onClick={onClick}
      className={`p-4 border-2 rounded-xl cursor-pointer transition-all select-none ${
        selected
          ? 'border-dash-secondary bg-dash-secondary/5 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="grid grid-cols-2 gap-3 min-w-0">
        {/* Col 1: Driver */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-wide">Driver</span>
          <span className="text-sm font-bold text-gray-900 truncate">{driver.fullName}</span>
          {driver.phoneNumber && <span className="text-xs text-gray-500">{driver.phoneNumber}</span>}
          <ExpiryLabel date={driver.licenseExpiry} label="SIM" />
        </div>
        {/* Col 2: Vehicle */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-wide">Kendaraan</span>
          <span className="text-sm font-bold text-gray-900 truncate">{vehicle.type}</span>
          <span className="text-xs text-gray-500">{vehicle.licensePlate}</span>
          <ExpiryLabel date={vehicle.stnkExpiry} label="STNK" />
          <ExpiryLabel date={vehicle.kirExpiry} label="KIR" />
          {vehicle.serviceDate && <ExpiryLabel date={vehicle.serviceDate} label="Service" />}
        </div>
      </div>
    </div>
  )
}

export default function ShipmentsSection({ onTrackFull, highlightShipmentId, userRole }) {
  const { showToast } = useToast()
  const { user } = useAuth()

  // ── List / filter state ──────────────────────────────────────
  const [filter, setFilter]               = useState('all')
  const [filterClient, setFilterClient]   = useState('all')
  const [filterService, setFilterService] = useState('all')
  const [searchQuery, setSearchQuery]     = useState('')
  const [currentPage, setCurrentPage]     = useState(1)
  const [viewMode, setViewMode]           = useState('today') // 'today' | 'history'
  const [SHIPMENTS, setSHIPMENTS]         = useState([])
  const [loading, setLoading]             = useState(true)

  // ── Detail panel ─────────────────────────────────────────────
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [notifyingId, setNotifyingId] = useState(null)
  const [notifiedIds, setNotifiedIds] = useState(() => new Set())

  // ── Update Status modal (all roles) ─────────────────────────
  const [showStatusModal, setShowStatusModal]       = useState(false)
  const [pendingStatus, setPendingStatus]           = useState(null)
  const [modalLoading, setModalLoading]             = useState(false)
  // Fleet data for the modal
  const [fleetVehicles, setFleetVehicles]           = useState([])
  // PENDING assign UI
  const [selectedVehicleId, setSelectedVehicleId]   = useState('')
  const [linkShipmentChecked, setLinkShipmentChecked] = useState(false)
  const [linkedShipmentId, setLinkedShipmentId]     = useState('')
  // DITUGASKAN reconfirm UI
  const [gantiDriverChecked, setGantiDriverChecked] = useState(false)
  const [newDriverVehicleId, setNewDriverVehicleId] = useState('')
  const [newDriverId, setNewDriverId]               = useState('') // STANDBY reconfirm: substitute driver (keeps vehicle)
  const [tandaiTidakTersedia, setTandaiTidakTersedia] = useState(true)

  // ── Role-specific UI states ─────────────────────────────────
  const [assignPickupPlantId, setAssignPickupPlantId] = useState('')
  const [assignPickupDate, setAssignPickupDate]       = useState('')

  const [vehicleCondition, setVehicleCondition]       = useState('Baik')
  const [lkuNumber, setLkuNumber]                     = useState('')
  const [pabrikNotes, setPabrikNotes]                 = useState('')

  const [serahTerimaUrl, setSerahTerimaUrl]           = useState('')
  const [handoverNotes, setHandoverNotes]             = useState('')

  // ── SUPERADMIN separate assign modal ────────────────────────
  const [showAssignModal, setShowAssignModal]     = useState(false)
  const [assigningShipment, setAssigningShipment] = useState(null)
  const [assignDriverId, setAssignDriverId]       = useState('')
  const [assignVehicleId, setAssignVehicleId]     = useState('')
  const [availableDrivers, setAvailableDrivers]   = useState([])
  const [availableVehicles, setAvailableVehicles] = useState([])

  // ── Create modal ─────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [clientOptions, setClientOptions]     = useState([])
  const [formClientId, setFormClientId]               = useState('')
  const [formService, setFormService]                 = useState('Darat')
  const [formShippingCategory, setFormShippingCategory] = useState('Unit') // KEPALA_ARMADA
  const [formOrigin, setFormOrigin]                   = useState('')
  const [formOriginPoint, setFormOriginPoint]         = useState('')
  const [formDestination, setFormDestination]         = useState('')
  const [formDestinationPoint, setFormDestinationPoint] = useState('')
  const [formPickupDate, setFormPickupDate]           = useState('')
  const [formPackageType, setFormPackageType]         = useState('')
  const [formUnits, setFormUnits]                     = useState('')
  const [formWeight, setFormWeight]                   = useState('')
  const [formNotes, setFormNotes]                     = useState('')
  
  // Extra fields for KEPALA_ARMADA
  const [formDriverId, setFormDriverId]               = useState('')
  const [formPickupPlantId, setFormPickupPlantId]     = useState('')
  const [formDimensions, setFormDimensions]           = useState('')
  const [formContainerType, setFormContainerType]     = useState('20 Feet')
  const [pickupPlants, setPickupPlants]               = useState([])

  // ── Derived ───────────────────────────────────────────────────
  const role = user?.role || 'SUPERADMIN'
  const isSuperAdmin = role === 'SUPERADMIN'
  const isRegularAdmin = !isSuperAdmin
  // Field roles that use the compact page layout (status dropdown, no tabs, centered detail modal,
  // Dalam Proses/Selesai views). KEPALA_ARMADA + PIC_PABRIK for now (add PIC_GUDANG when its flow lands).
  const usesFieldLayout = role === 'KEPALA_ARMADA' || role === 'PIC_PABRIK'

  // Calculate restricted minDate for specific roles
  let restrictedMinDate = null
  if (['KEPALA_ARMADA', 'PIC_PABRIK', 'PIC_GUDANG'].includes(role)) {
    restrictedMinDate = new Date()
    restrictedMinDate.setDate(restrictedMinDate.getDate() - 3) // D-3
  }

  // Vehicles that have an ACTIVE primary driver (available for assignment)
  const assignableVehicles = fleetVehicles.filter(v => v.primaryDriver && v.primaryDriver.status === 'ACTIVE')

  // Drivers paired 1:1 with a vehicle (getDrivers includes primaryVehicle) — only these are selectable in the Armada form
  const pairedDrivers = availableDrivers.filter(d => d.primaryVehicle)

  // A driver+armada pair is selectable only while its armada is Tersedia (AVAILABLE).
  // Once engaged (Standby/Ditugaskan/Transit) the vehicle leaves AVAILABLE, so the pair drops
  // out of the list until the shipment completes and the armada returns to Tersedia.
  const selectableCreateDrivers = pairedDrivers.filter(d => d.primaryVehicle?.status === 'AVAILABLE')

  // Current vehicle of the open shipment (for DITUGASKAN read-only card)
  const currentShipmentVehicle = selectedShipment
    ? fleetVehicles.find(v => v.id === selectedShipment.vehicleId)
    : null

  // Other PENDING shipments for the Link Shipment option
  const menungguShipments = selectedShipment
    ? SHIPMENTS.filter(s => s.rawStatus === 'PENDING' && s.id !== selectedShipment.id)
    : []

  // Status options for SUPERADMIN status picker
  const statusOptions = selectedShipment ? availableStatusOptions(user?.role, selectedShipment.rawStatus) : []

  // Whether the Update Status button should be shown
  const canUpdateStatus = selectedShipment && (() => {
    if (isSuperAdmin) return statusOptions.length > 0;
    const rs = selectedShipment.rawStatus;
    if (role === 'KEPALA_ARMADA') return rs === 'STANDBY';
    if (role === 'PIC_PABRIK') return rs === 'DITUGASKAN' || rs === 'AT_PLANT';
    if (role === 'PIC_GUDANG') return rs === 'TRANSIT';
    return ['PENDING', 'STANDBY', 'DITUGASKAN', 'AT_PLANT', 'TRANSIT'].includes(rs);
  })();

  // ── Data fetching ─────────────────────────────────────────────
  const fetchShipments = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const data = await shipmentsAPI.list()
      const mapped = (data.shipments || data || []).map(s => ({
        id:                    s.id,
        clientId:              s.clientId,
        client:                s.client?.companyName || s.client?.fullName || '-',
        serviceType:           s.serviceLevel || 'Darat',
        shippingCategory:      s.shippingCategory || '-',
        originCity:            s.originLocation,
        destinationCity:       s.destinationLocation,
        pickupDate:            formatDate(s.pickupDate || s.createdAt),
        rawPickupDate:         s.pickupDate || s.createdAt,
        cargoDescription:      s.packageType,
        weightKg:              s.weightKg,
        units:                 s.units || '-',
        dimensions:            s.dimensions || '-',
        containerType:         s.containerType || '-',
        pickupPlantName:       s.pickupPlant ? `${s.pickupPlant.manufacturer} - ${s.pickupPlant.name}${s.pickupPlant.code ? ` (${s.pickupPlant.code})` : ''}` : '-',
        driverId:              s.driverId,
        driverName:            s.driver?.fullName || null,
        vehicleId:             s.vehicleId,
        vehicleName:           s.vehicle ? `${s.vehicle.type} • ${s.vehicle.licensePlate}` : null,
        vehiclePrimaryDriverId: s.vehicle?.primaryDriverId || null,
        status:                mapStatus(s.status),
        rawStatus:             s.status,
        notes:                 s.specialNotes || '',
        createdBy:             s.createdByAdmin?.fullName || s.client?.fullName || '-',
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
          translateX: usesFieldLayout ? [0, 0] : [50, 0],
          translateY: usesFieldLayout ? [20, 0] : [0, 0],
          opacity: [0, 1],
          easing: 'easeOutExpo',
          duration: 400
        })
      })
    }
  }, [selectedShipment, role])

  // ── Fleet fetch helpers ───────────────────────────────────────
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

  const fetchFleetVehicles = async () => {
    setModalLoading(true)
    try {
      const data = await fleetAPI.getVehicles()
      setFleetVehicles(data.vehicles || data || [])
    } catch (err) {
      showToast('Gagal memuat data armada.', 'error')
    } finally {
      setModalLoading(false)
    }
  }

  // ── Clients fetch ─────────────────────────────────────────────
  const fetchClients = async () => {
    try {
      const data = await usersAPI.listAll()
      const users = data.users || data || []
      setClientOptions(users.map(u => ({ id: u.id, label: u.companyName || u.fullName || u.email })))
    } catch (err) {
      console.error('Failed to fetch clients:', err)
    }
  }

  // ── Create form helpers ───────────────────────────────────────
  const resetCreateForm = () => {
    setFormClientId('')
    setFormService('Darat')
    setFormShippingCategory('Unit')
    setFormOrigin('')
    setFormOriginPoint('')
    setFormDestination('')
    setFormDestinationPoint('')
    setFormPickupDate('')
    setFormPackageType('')
    setFormUnits('')
    setFormWeight('')
    setFormNotes('')
    setFormDriverId('')
    setFormPickupPlantId('')
    setFormDimensions('')
    setFormContainerType('20 Feet')
  }

  const fetchPickupPlants = async () => {
    try {
      const data = await shipmentsAPI.getPickupPlants()
      setPickupPlants(data.plants || [])
    } catch (err) {
      console.error('Failed to fetch pickup plants:', err)
    }
  }

  const openCreateModal = () => {
    fetchClients()
    if (role === 'KEPALA_ARMADA') {
      fetchFleet()
      fetchPickupPlants()
    }
    resetCreateForm()
    setShowCreateModal(true)
  }

  const handleCreateShipment = async () => {
    if (!formClientId) {
      showToast('Pilih Klien terlebih dahulu.', 'error')
      return
    }

    if (role === 'KEPALA_ARMADA') {
      if (!formDriverId) {
        showToast('Pilih Driver terlebih dahulu.', 'error')
        return
      }
      if (!formPickupDate) {
        showToast('Pilih Tanggal Pickup terlebih dahulu.', 'error')
        return
      }
      if (formShippingCategory === 'Unit') {
        if (!formPickupPlantId) return showToast('Pilih Pickup Plant.', 'error')
      } else if (formShippingCategory === 'Cargo') {
        if (!formDimensions && !formWeight) return showToast('Dimensi atau Berat harus diisi.', 'error')
        if (!formOrigin.trim() || !formDestination.trim()) return showToast('Alamat Penjemputan dan Pengiriman harus diisi.', 'error')
      } else if (formShippingCategory === 'Container') {
        if (!formContainerType) return showToast('Pilih Tipe Container.', 'error')
        if (!formOrigin.trim() || !formDestination.trim()) return showToast('Alamat Penjemputan dan Pengiriman harus diisi.', 'error')
      }
    } else {
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
    }

    const finalOrigin      = formOriginPoint.trim()      ? `${formOriginPoint.trim()} - ${formOrigin.trim()}`      : formOrigin.trim()
    const finalDestination = formDestinationPoint.trim() ? `${formDestinationPoint.trim()} - ${formDestination.trim()}` : formDestination.trim()
    
    // Auto map packageType and serviceLevel for KEPALA_ARMADA if empty
    const pType = role === 'KEPALA_ARMADA' ? (formShippingCategory === 'Unit' ? 'Kendaraan' : (formShippingCategory === 'Cargo' ? 'Kargo' : 'Kontainer')) : formPackageType;

    // Armada shipments carry the paired driver's vehicle from creation (→ backend starts them at STANDBY).
    const armadaVehicleId = role === 'KEPALA_ARMADA'
      ? availableDrivers.find(d => d.id === formDriverId)?.primaryVehicle?.id
      : undefined

    // Per-type fields. Non-applicable string fields are persisted as "-".
    let originLocation      = finalOrigin || '-'
    let destinationLocation = finalDestination || '-'
    let dimensions          = '-'
    let containerType       = '-'
    let pickupPlantId        // FK — stays undefined (null) when not a Unit shipment

    if (role === 'KEPALA_ARMADA') {
      if (formShippingCategory === 'Unit') {
        const plant = pickupPlants.find(p => p.id === formPickupPlantId)
        originLocation      = plant ? `${plant.manufacturer} - ${plant.name}${plant.code ? ` (${plant.code})` : ''}` : '-'
        destinationLocation = 'Gudang MPL'
        pickupPlantId       = formPickupPlantId
      } else if (formShippingCategory === 'Cargo') {
        dimensions = formDimensions || '-'
      } else if (formShippingCategory === 'Container') {
        containerType = formContainerType || '-'
      }
    }

    try {
      await shipmentsAPI.create({
        clientId:            formClientId,
        packageType:         pType,
        weightKg:            Number(formWeight) || 0,
        units:               formUnits ? Number(formUnits) : null,
        serviceLevel:        formService,
        originLocation,
        destinationLocation,
        specialNotes:        formNotes || null,
        pickupDate:          formPickupDate ? new Date(formPickupDate).toISOString() : null,
        shippingCategory:    role === 'KEPALA_ARMADA' ? formShippingCategory : null,
        driverId:            role === 'KEPALA_ARMADA' ? formDriverId : undefined,
        vehicleId:           armadaVehicleId,
        pickupPlantId,
        dimensions:          role === 'KEPALA_ARMADA' ? dimensions : undefined,
        containerType:       role === 'KEPALA_ARMADA' ? containerType : undefined,
      })
      showToast('Pengiriman baru berhasil dibuat!', 'success')
      setShowCreateModal(false)
      resetCreateForm()
      fetchShipments()
    } catch (err) {
      showToast(err.message || 'Gagal membuat pengiriman.', 'error')
    }
  }

  // ── SUPERADMIN assign modal ───────────────────────────────────
  const openAssignModal = (row) => {
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
      fetchShipments({ silent: true })
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // ── Status update ─────────────────────────────────────────────
  const handleStatusUpdate = async (newRawStatus) => {
    try {
      await shipmentsAPI.updateStatus(selectedShipment.id, { status: newRawStatus })
      showToast('Status diperbarui!', 'success')
      fetchShipments({ silent: true })
      setSelectedShipment(prev => ({
        ...prev,
        rawStatus: newRawStatus,
        status:    mapStatus(newRawStatus),
      }))
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
      return true
    } catch (err) {
      showToast(err.message, 'error')
      return false
    }
  }

  // ── Delete shipment ───────────────────────────────────────────
  // Regular admins may delete only Standby shipments; SUPERADMIN may delete any status.
  const canDeleteShipment = selectedShipment && (isSuperAdmin || selectedShipment.rawStatus === 'STANDBY')

  const handleDeleteShipment = async () => {
    if (!selectedShipment) return
    if (!window.confirm(`Hapus pengiriman ${selectedShipment.id}? Tindakan ini tidak dapat dibatalkan.`)) return
    try {
      await shipmentsAPI.remove(selectedShipment.id)
      showToast('Pengiriman dihapus.', 'success')
      setSelectedShipment(null)
      fetchShipments({ silent: true })
    } catch (err) {
      showToast(err.message || 'Gagal menghapus pengiriman.', 'error')
    }
  }

  // ── Update Status modal ───────────────────────────────────────
  const resetModalState = () => {
    setPendingStatus(null)
    setSelectedVehicleId('')
    setLinkShipmentChecked(false)
    setLinkedShipmentId('')
    setGantiDriverChecked(false)
    setNewDriverVehicleId('')
    setNewDriverId('')
    setTandaiTidakTersedia(true)
    setAssignPickupPlantId('')
    setAssignPickupDate('')
    setVehicleCondition('Baik')
    setLkuNumber('')
    setPabrikNotes('')
    setSerahTerimaUrl('')
    setHandoverNotes('')
  }

  const openStatusModal = async () => {
    resetModalState()
    setShowStatusModal(true)
    const rawStatus = selectedShipment?.rawStatus
    if (rawStatus === 'PENDING' || rawStatus === 'DITUGASKAN') {
      await fetchFleetVehicles()
    }
    // STANDBY reconfirm needs the current vehicle card (fleetVehicles) + the substitute driver list (availableDrivers)
    if (rawStatus === 'STANDBY') {
      await Promise.all([fetchFleetVehicles(), fetchFleet()])
    }
  }

  const handleConfirmStatus = async () => {
    if (!selectedShipment) return
    const { rawStatus, id, driverId, vehicleId } = selectedShipment

    if (isRegularAdmin) {
      // ── KEPALA_ARMADA reconfirm driver availability (STANDBY → DITUGASKAN) ──
      if (role === 'KEPALA_ARMADA' && rawStatus === 'STANDBY') {
        try {
          if (gantiDriverChecked) {
            if (!newDriverId) {
              showToast('Pilih driver pengganti terlebih dahulu.', 'error')
              return
            }
            // Substitute: swap the driver only, keep the vehicle (new driver ≠ vehicle primary → Pengganti)
            await shipmentsAPI.assign(id, { driverId: newDriverId, vehicleId })
            if (tandaiTidakTersedia && driverId) {
              await fleetAPI.updateDriver(driverId, { status: 'UNAVAILABLE' })
            }
          }
          const ok = await handleStatusUpdate('DITUGASKAN')
          if (ok) {
            showToast('Driver dikonfirmasi! Status → Ditugaskan.', 'success')
            setShowStatusModal(false)
            resetModalState()
            fetchShipments({ silent: true })
          }
        } catch (err) {
          showToast(err.message || 'Gagal mengonfirmasi driver.', 'error')
        }
        return
      }

      if (role === 'KEPALA_ARMADA' && rawStatus === 'PENDING') {
        if (!selectedVehicleId) {
          showToast('Pilih driver & kendaraan terlebih dahulu.', 'error')
          return
        }
        const vehicle = fleetVehicles.find(v => v.id === selectedVehicleId)
        if (!vehicle) return
        try {
          await shipmentsAPI.assign(id, {
            driverId:  vehicle.primaryDriver.id,
            vehicleId: vehicle.id,
            pickupPlantId: assignPickupPlantId,
            pickupDate: assignPickupDate
          })
          if (linkShipmentChecked && linkedShipmentId) {
            await shipmentsAPI.assign(linkedShipmentId, {
              driverId:  vehicle.primaryDriver.id,
              vehicleId: vehicle.id,
              pickupPlantId: assignPickupPlantId,
              pickupDate: assignPickupDate
            })
          }
          showToast('Driver ditugaskan! Status → Ditugaskan.', 'success')
          setShowStatusModal(false)
          resetModalState()
          fetchShipments({ silent: true })
          setSelectedShipment(prev => prev ? ({ ...prev, rawStatus: 'DITUGASKAN', status: 'assigned' }) : null)
        } catch (err) {
          showToast(err.message || 'Gagal menugaskan driver.', 'error')
        }
        return
      }

      // Ditugaskan → Di Pabrik: confirm the driver+armada have arrived at the plant.
      if (role === 'PIC_PABRIK' && rawStatus === 'DITUGASKAN') {
        const ok = await handleStatusUpdate('AT_PLANT')
        if (ok) { setShowStatusModal(false); resetModalState() }
        return
      }

      // Di Pabrik → Dalam Perjalanan: plant check + LKU (fuller data form is a later step).
      if (role === 'PIC_PABRIK' && rawStatus === 'AT_PLANT') {
        try {
          await shipmentsAPI.plantCheck(id, {
            vehicleCondition,
            lkuNumber,
            pabrikNotes
          })
          showToast('Pengecekan Pabrik Selesai. Status → Dalam Perjalanan.', 'success')
          setShowStatusModal(false)
          resetModalState()
          fetchShipments({ silent: true })
          setSelectedShipment(prev => prev ? ({ ...prev, rawStatus: 'TRANSIT', status: 'in_transit' }) : null)
        } catch (err) {
          showToast(err.message || 'Gagal memproses pengecekan pabrik.', 'error')
        }
        return
      }

      if (role === 'PIC_GUDANG' && rawStatus === 'TRANSIT') {
        try {
          await shipmentsAPI.handover(id, {
            serahTerimaUrl,
            handoverNotes
          })
          showToast('Serah Terima Selesai. Status → Terkirim.', 'success')
          setShowStatusModal(false)
          resetModalState()
          fetchShipments({ silent: true })
          setSelectedShipment(prev => prev ? ({ ...prev, rawStatus: 'DELIVERED', status: 'delivered' }) : null)
        } catch (err) {
          showToast(err.message || 'Gagal memproses serah terima.', 'error')
        }
        return
      }

      // ── Fallback for OPERATIONS / SUPPORT role ────────────────
      if (rawStatus === 'PENDING') {
        // Old assign logic here...
        if (!selectedVehicleId) return showToast('Pilih driver & kendaraan.', 'error')
        const vehicle = fleetVehicles.find(v => v.id === selectedVehicleId)
        try {
          await shipmentsAPI.assign(id, { driverId: vehicle.primaryDriver.id, vehicleId: vehicle.id })
          showToast('Driver ditugaskan.', 'success')
          setShowStatusModal(false)
          resetModalState()
          fetchShipments({ silent: true })
          setSelectedShipment(prev => prev ? ({ ...prev, rawStatus: 'DITUGASKAN', status: 'assigned' }) : null)
        } catch(err) {}
        return
      }

      if (rawStatus === 'DITUGASKAN') {
        const ok = await handleStatusUpdate('TRANSIT')
        if (ok) { setShowStatusModal(false); resetModalState() }
        return
      }

      if (rawStatus === 'TRANSIT') {
        if (!pendingStatus) return showToast('Pilih status baru.', 'error')
        const ok = await handleStatusUpdate(pendingStatus)
        if (ok) { setShowStatusModal(false); resetModalState() }
        return
      }
    }

    // ── SUPERADMIN: generic status picker ────────────────────
    if (!pendingStatus) {
      showToast('Pilih status baru terlebih dahulu.', 'error')
      return
    }
    const ok = await handleStatusUpdate(pendingStatus)
    if (ok) { setShowStatusModal(false); resetModalState() }
  }

  // Modal title / subtitle / submit label
  const getModalTitle = () => {
    if (!selectedShipment || isSuperAdmin) return 'Update Status Pengiriman'
    if (role === 'KEPALA_ARMADA' && selectedShipment.rawStatus === 'STANDBY') return 'Konfirmasi Ketersediaan Driver'
    if (role === 'KEPALA_ARMADA' && selectedShipment.rawStatus === 'PENDING') return 'Tugaskan Driver & Kendaraan'
    if (role === 'PIC_PABRIK' && selectedShipment.rawStatus === 'DITUGASKAN') return 'Konfirmasi Kedatangan di Pabrik'
    if (role === 'PIC_PABRIK' && selectedShipment.rawStatus === 'AT_PLANT') return 'Pengecekan Kendaraan (Pabrik)'
    if (role === 'PIC_GUDANG' && selectedShipment.rawStatus === 'TRANSIT') return 'Serah Terima (Gudang)'
    
    // Fallback for OPERATIONS
    if (selectedShipment.rawStatus === 'PENDING') return 'Tugaskan Driver & Kendaraan'
    if (selectedShipment.rawStatus === 'DITUGASKAN') return 'Konfirmasi Keberangkatan'
    return 'Update Status Pengiriman'
  }

  const getModalSubtitle = () => {
    if (!selectedShipment) return ''
    const sid = selectedShipment.id.startsWith('#') ? selectedShipment.id : `#${selectedShipment.id}`
    if (isSuperAdmin) return `${sid} — pilih status baru`

    if (role === 'KEPALA_ARMADA' && selectedShipment.rawStatus === 'STANDBY') return `${sid} — konfirmasi driver & armada sebelum ditugaskan`
    if (role === 'KEPALA_ARMADA' && selectedShipment.rawStatus === 'PENDING') return `${sid} — pilih driver, armada & pabrik`
    if (role === 'PIC_PABRIK' && selectedShipment.rawStatus === 'DITUGASKAN') return `${sid} — konfirmasi driver & armada tiba di Pabrik`
    if (role === 'PIC_PABRIK' && selectedShipment.rawStatus === 'AT_PLANT') return `${sid} — lengkapi LKU dan cek kondisi`
    if (role === 'PIC_GUDANG' && selectedShipment.rawStatus === 'TRANSIT') return `${sid} — upload bukti serah terima`

    // Fallback for OPERATIONS
    if (selectedShipment.rawStatus === 'PENDING') return `${sid} — pilih driver & armada`
    if (selectedShipment.rawStatus === 'DITUGASKAN') return `${sid} — konfirmasi sebelum berangkat`
    if (selectedShipment.rawStatus === 'TRANSIT') return `${sid} — selesaikan atau batalkan`
    return sid
  }

  const getSubmitLabel = () => {
    if (!selectedShipment || isSuperAdmin) return 'Konfirmasi'
    if (role === 'KEPALA_ARMADA' && selectedShipment.rawStatus === 'STANDBY') return 'Konfirmasi & Tugaskan'
    if (role === 'KEPALA_ARMADA' && selectedShipment.rawStatus === 'PENDING') return 'Tugaskan & Simpan'
    if (role === 'PIC_PABRIK' && selectedShipment.rawStatus === 'DITUGASKAN') return 'Konfirmasi Tiba di Pabrik'
    if (role === 'PIC_PABRIK' && selectedShipment.rawStatus === 'AT_PLANT') return 'Selesaikan Pengecekan'
    if (role === 'PIC_GUDANG' && selectedShipment.rawStatus === 'TRANSIT') return 'Konfirmasi Serah Terima'

    // Fallback
    if (selectedShipment.rawStatus === 'PENDING') return 'Tugaskan'
    if (selectedShipment.rawStatus === 'DITUGASKAN') return 'Konfirmasi Berangkat'
    return 'Konfirmasi'
  }

  // Modal body content
  const renderModalContent = () => {
    if (!selectedShipment) return null
    const { rawStatus } = selectedShipment

    if (isRegularAdmin) {
      // ── KEPALA_ARMADA reconfirm driver availability (STANDBY) ──
      if (role === 'KEPALA_ARMADA' && rawStatus === 'STANDBY') {
        const substituteDrivers = availableDrivers.filter(d => d.status === 'ACTIVE' && d.id !== selectedShipment.driverId)
        const isSubstitute = gantiDriverChecked && !!newDriverId && newDriverId !== selectedShipment.driverId
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500">Status saat ini:</span>
              <AdminStatusBadge status="standby" type="shipment" />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold text-gray-900">Driver &amp; Armada Saat Ini</span>
              {modalLoading ? (
                <div className="flex items-center gap-2 p-4 text-gray-400">
                  <Icon name="sync" size={18} className="animate-spin" />
                  <span className="text-xs">Memuat...</span>
                </div>
              ) : currentShipmentVehicle ? (
                <DriverVehicleCard vehicle={currentShipmentVehicle} selected={false} onClick={undefined} />
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
                  {selectedShipment.driverName || 'Driver'} — {selectedShipment.vehicleName || 'Kendaraan'}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-3 border-t border-gray-100">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gantiDriverChecked}
                  onChange={e => { setGantiDriverChecked(e.target.checked); setNewDriverId('') }}
                  className="w-4 h-4 rounded accent-[#fec330]"
                />
                <span className="text-sm font-bold text-gray-700">Ganti Driver (driver utama tidak tersedia)</span>
              </label>

              {gantiDriverChecked && (
                <div className="flex flex-col gap-3 ml-2">
                  <p className="text-xs text-gray-500">Driver pengganti tetap memakai armada yang sama. Driver akan ditandai sebagai <span className="font-bold">Pengganti</span>.</p>
                  {substituteDrivers.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                      Tidak ada driver aktif lain yang tersedia.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                      {substituteDrivers.map(d => {
                        const chosen = newDriverId === d.id
                        return (
                          <label
                            key={d.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              chosen ? 'border-dash-secondary bg-dash-secondary/10' : 'border-gray-200 hover:border-dash-secondary/50 bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="substituteDriver"
                              value={d.id}
                              checked={chosen}
                              onChange={() => setNewDriverId(d.id)}
                              className="accent-dash-secondary"
                            />
                            <div className="flex-1 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-dash-primary">{d.fullName}</span>
                                {chosen && (
                                  <span className="px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">Pengganti</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">{d.phoneNumber || '-'} · SIM {d.licenseType || '-'}</p>
                              <ExpiryLabel date={d.licenseExpiry} label="SIM" />
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  <label className="flex items-center gap-2.5 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={tandaiTidakTersedia}
                      onChange={e => setTandaiTidakTersedia(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#fec330]"
                    />
                    <span className="text-sm text-gray-700">Tandai driver lama tidak tersedia</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )
      }

      // ── KEPALA_ARMADA (or Fallback PENDING) ─────────────────
      if (rawStatus === 'PENDING') {
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500">Status saat ini:</span>
              <AdminStatusBadge status="pending" type="shipment" />
            </div>

            {modalLoading ? (
              <div className="flex items-center justify-center p-8 text-gray-400 gap-2">
                <Icon name="sync" size={20} className="animate-spin" />
                <span className="text-sm">Memuat data armada...</span>
              </div>
            ) : assignableVehicles.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                Tidak ada driver aktif yang sudah dipasangkan dengan kendaraan. Pasangkan driver di menu Armada terlebih dahulu.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-gray-900">Pilih Driver &amp; Kendaraan</span>
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {assignableVehicles.map(v => (
                      <DriverVehicleCard
                        key={v.id}
                        vehicle={v}
                        selected={selectedVehicleId === v.id}
                        onClick={() => setSelectedVehicleId(v.id)}
                      />
                    ))}
                  </div>
                </div>

                {role === 'KEPALA_ARMADA' && (
                  <div className="flex flex-col gap-4 mt-2 p-4 bg-gray-50 border border-gray-100 rounded-xl">
                    <AdminFormField
                      label="Pabrik Pickup (Optional)"
                      type="text"
                      placeholder="Misal: Cikarang Plant A"
                      value={assignPickupPlantId}
                      onChange={e => setAssignPickupPlantId(e.target.value)}
                    />
                    <AdminDatePicker
                      label="Tanggal Keberangkatan (Optional)"
                      value={assignPickupDate}
                      onChange={setAssignPickupDate}
                      required={false}
                    />
                  </div>
                )}

                {menungguShipments.length > 0 && (
                  <div className="flex flex-col gap-3 pt-3 border-t border-gray-100">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={linkShipmentChecked}
                        onChange={e => { setLinkShipmentChecked(e.target.checked); setLinkedShipmentId('') }}
                        className="w-4 h-4 rounded accent-[#fec330]"
                      />
                      <span className="text-sm font-bold text-gray-700">Hubungkan dengan Pengiriman Lain</span>
                    </label>
                    {linkShipmentChecked && (
                      <div className="flex flex-col gap-2 ml-6">
                        {menungguShipments.map(s => (
                          <label
                            key={s.id}
                            className={`flex items-start gap-2.5 p-3 border rounded-xl cursor-pointer transition-colors ${
                              linkedShipmentId === s.id
                                ? 'border-dash-secondary bg-dash-secondary/5'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="linkedShipment"
                              value={s.id}
                              checked={linkedShipmentId === s.id}
                              onChange={() => setLinkedShipmentId(s.id)}
                              className="mt-0.5 accent-[#fec330]"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-gray-900">{s.id}</span>
                              <span className="text-xs text-gray-500 truncate">{s.client} — {s.destinationCity}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )
      }

      // ── PIC_PABRIK: confirm arrival (Ditugaskan → Di Pabrik) ──
      if (role === 'PIC_PABRIK' && rawStatus === 'DITUGASKAN') {
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500">Status saat ini:</span>
              <AdminStatusBadge status="assigned" type="shipment" />
            </div>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
              Konfirmasi bahwa driver &amp; armada untuk pengiriman <b>{selectedShipment.id}</b> telah tiba di Pabrik. Status akan berubah menjadi <b>Di Pabrik</b>.
            </div>
            <div className="flex flex-col gap-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-gray-500 font-medium">Driver</span>
                <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.driverName || '-'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-gray-500 font-medium">Armada</span>
                <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.vehicleName || '-'}</span>
              </div>
            </div>
          </div>
        )
      }

      // ── PIC_PABRIK: plant check (Di Pabrik → Dalam Perjalanan) ──
      if (role === 'PIC_PABRIK' && rawStatus === 'AT_PLANT') {
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500">Status saat ini:</span>
              <AdminStatusBadge status="at_plant" type="shipment" />
            </div>

            <div className="flex flex-col gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold text-gray-700">Kondisi Kendaraan</span>
                <SearchableSelect 
                   options={[{value: 'Baik', label: 'Baik'}, {value: 'Perlu Perhatian', label: 'Perlu Perhatian'}, {value: 'Rusak Ringan', label: 'Rusak Ringan'}]}
                   value={vehicleCondition}
                   onChange={setVehicleCondition}
                   placeholder="Pilih Kondisi"
                />
              </div>
              
              <AdminFormField
                label="Nomor LKU"
                type="text"
                placeholder="Masukkan Nomor LKU"
                value={lkuNumber}
                onChange={e => setLkuNumber(e.target.value)}
              />
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-700">Catatan Pengecekan</label>
                <textarea
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:border-dash-secondary focus:ring-1 focus:ring-dash-secondary outline-none transition-shadow"
                  rows={3}
                  placeholder="Tambahkan catatan jika ada..."
                  value={pabrikNotes}
                  onChange={e => setPabrikNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        )
      }

      // ── PIC_GUDANG Handover ───────────────────────────────────
      if (role === 'PIC_GUDANG' && rawStatus === 'TRANSIT') {
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500">Status saat ini:</span>
              <AdminStatusBadge status="in_transit" type="shipment" />
            </div>
            
            <div className="flex flex-col gap-4 bg-gray-50 p-5 rounded-xl border border-gray-200">
              <AdminFormField
                label="URL Bukti Serah Terima"
                type="text"
                placeholder="https://... (Link Foto/Dokumen)"
                value={serahTerimaUrl}
                onChange={e => setSerahTerimaUrl(e.target.value)}
              />
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-700">Catatan Penerimaan</label>
                <textarea
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:border-dash-secondary focus:ring-1 focus:ring-dash-secondary outline-none transition-shadow"
                  rows={3}
                  placeholder="Tambahkan catatan kondisi barang..."
                  value={handoverNotes}
                  onChange={e => setHandoverNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        )
      }

      // ── Fallback (OPERATIONS/SUPPORT) DITUGASKAN ──────────────
      if (rawStatus === 'DITUGASKAN') {
        const gantiDriverOptions = assignableVehicles.filter(v => v.primaryDriver?.id !== selectedShipment.driverId)
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500">Status saat ini:</span>
              <AdminStatusBadge status="assigned" type="shipment" />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold text-gray-900">Driver &amp; Kendaraan Saat Ini</span>
              {modalLoading ? (
                <div className="flex items-center gap-2 p-4 text-gray-400">
                  <Icon name="sync" size={18} className="animate-spin" />
                  <span className="text-xs">Memuat...</span>
                </div>
              ) : currentShipmentVehicle ? (
                <DriverVehicleCard vehicle={currentShipmentVehicle} selected={false} onClick={undefined} />
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
                  {selectedShipment.driverName || 'Driver'} — {selectedShipment.vehicleName || 'Kendaraan'}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-3 border-t border-gray-100">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gantiDriverChecked}
                  onChange={e => { setGantiDriverChecked(e.target.checked); setNewDriverVehicleId('') }}
                  className="w-4 h-4 rounded accent-[#fec330]"
                />
                <span className="text-sm font-bold text-gray-700">Ganti Driver</span>
              </label>

              {gantiDriverChecked && (
                <div className="flex flex-col gap-3 ml-2">
                  {gantiDriverOptions.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                      Tidak ada driver aktif lain yang tersedia.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {gantiDriverOptions.map(v => (
                        <DriverVehicleCard
                          key={v.id}
                          vehicle={v}
                          selected={newDriverVehicleId === v.id}
                          onClick={() => setNewDriverVehicleId(v.id)}
                        />
                      ))}
                    </div>
                  )}

                  <label className="flex items-center gap-2.5 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={tandaiTidakTersedia}
                      onChange={e => setTandaiTidakTersedia(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#fec330]"
                    />
                    <span className="text-sm text-gray-700">Tandai driver lama tidak tersedia</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )
      }

      // ── TRANSIT: status buttons ─────────────────────────────
      if (rawStatus === 'TRANSIT') {
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500">Status saat ini:</span>
              <AdminStatusBadge status="in_transit" type="shipment" />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold text-gray-900">Pilih status baru</span>
              <div className="grid grid-cols-2 gap-3">
                {[{ value: 'DELIVERED', label: 'Terkirim' }, { value: 'CANCELLED', label: 'Dibatalkan' }].map(opt => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setPendingStatus(opt.value)}
                    className={`px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${
                      pendingStatus === opt.value
                        ? 'border-dash-secondary bg-dash-secondary/15 text-dash-primary'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      }
    }

    // ── SUPERADMIN: generic status picker ──────────────────────
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-500">Status saat ini:</span>
          <AdminStatusBadge status={selectedShipment.status} type="shipment" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-gray-900">Pilih status baru</span>
          <div className="grid grid-cols-2 gap-3">
            {statusOptions.map(opt => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setPendingStatus(opt.value)}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${
                  pendingStatus === opt.value
                    ? 'border-dash-secondary bg-dash-secondary/15 text-dash-primary'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Detail Muatan section (reused in the detail panel — position depends on role/status)
  const renderDetailMuatan = () => (
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
  )

  // ── WhatsApp notify ───────────────────────────────────────────
  const handleNotifyDriver = async () => {
    const id = selectedShipment.id
    setNotifyingId(id)
    try {
      await shipmentsAPI.notifyDriver(id)
      showToast('Notifikasi WhatsApp berhasil dikirim ke driver!', 'success')
      setNotifiedIds(prev => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
    } catch (err) {
      showToast(err.message || 'Gagal mengirim notifikasi WhatsApp.', 'error')
    } finally {
      setNotifyingId(null)
    }
  }

  const notifyInFlight = !!selectedShipment && notifyingId === selectedShipment.id
  const notifySent     = !!selectedShipment && notifiedIds.has(selectedShipment.id)

  // ── Filtering & pagination ────────────────────────────────────
  const ITEMS_PER_PAGE = 20

  let filtered = SHIPMENTS.filter(s => {
    const matchStatus  = filter === 'all' || s.status === filter
    const matchClient  = filterClient === 'all' || s.client === filterClient
    const matchService = filterService === 'all' || s.serviceType === filterService
    const matchSearch  = !searchQuery ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.client.toLowerCase().includes(searchQuery.toLowerCase())
    
    let matchViewMode = true
    if (['KEPALA_ARMADA', 'PIC_PABRIK', 'PIC_GUDANG'].includes(role)) {
      if (usesFieldLayout) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const pDate = new Date(s.rawPickupDate);

        if (viewMode === 'today') {
          // "Dalam Proses": today or future dates
          matchViewMode = pDate >= today;
        } else if (viewMode === 'history') {
          // "Selesai": past shipments
          matchViewMode = pDate < today;
        }
      } else if (viewMode === 'today') {
        matchViewMode = s.pickupDate === formatDate(new Date())
      }
    }

    // Kepala Armada sees the full lifecycle of their shipments, split by the
    // Dalam Proses / Selesai view mode above (no status restriction).
    return matchStatus && matchClient && matchService && matchSearch && matchViewMode
  })

  // Field roles: sort by status progression (Standby → Ditugaskan → Di Pabrik → Dalam
  // Perjalanan → Diterima → Diturunkan → Selesai), then by earliest pickup date within each.
  if (usesFieldLayout) {
    const RANK = { STANDBY: 0, DITUGASKAN: 1, AT_PLANT: 2, TRANSIT: 3, DITERIMA: 4, DITURUNKAN: 5, DELIVERED: 6, CANCELLED: 7, PENDING: 8, FAILED: 9 }
    filtered.sort((a, b) => {
      const ra = RANK[a.rawStatus] ?? 99
      const rb = RANK[b.rawStatus] ?? 99
      if (ra !== rb) return ra - rb
      return new Date(a.rawPickupDate).getTime() - new Date(b.rawPickupDate).getTime() // earliest first
    });
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const filters = [
    { id: 'all',        label: 'Semua' },
    { id: 'pending',    label: 'Menunggu' },
    { id: 'standby',    label: 'Standby' },
    { id: 'assigned',   label: 'Ditugaskan' },
    { id: 'at_plant',   label: 'Di Pabrik' },
    { id: 'in_transit', label: 'Dalam Perjalanan' },
    { id: 'diterima',   label: 'Diterima' },
    { id: 'diturunkan', label: 'Diturunkan' },
    { id: 'delivered',  label: 'Selesai' },
    { id: 'cancelled',  label: 'Dibatalkan' },
  ]

  // ── Table columns ─────────────────────────────────────────────
  const columns = [
    {
      key: 'id',
      label: 'ID Order',
      render: (v) => <span className="adm-table__cell-main">{v}</span>,
    },
    { key: 'client', label: 'Klien' },
    { key: 'shippingCategory', label: 'Tipe Pengiriman', render: (v) => v || '-' },
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
          {/* SUPERADMIN retains the direct-assign row button; regular admins use the status modal */}
          {user?.role === 'SUPERADMIN' && (
            <button
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 bg-gray-100 hover:bg-dash-secondary hover:text-dash-primary transition-colors"
              title="Tugaskan Driver (SUPERADMIN)"
              onClick={(e) => { e.stopPropagation(); openAssignModal(row) }}
            >
              <Icon name="person_add" size={16} />
            </button>
          )}
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
        <div className="flex flex-col sm:flex-row gap-3">
          {['KEPALA_ARMADA', 'PIC_PABRIK', 'PIC_GUDANG'].includes(role) && (
            <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
              <button
                onClick={() => { setViewMode('today'); setCurrentPage(1); }}
                className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                  viewMode === 'today'
                    ? 'bg-white text-dash-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {usesFieldLayout ? 'Dalam Proses' : 'Hari Ini'}
              </button>
              <button
                onClick={() => { setViewMode('history'); setCurrentPage(1); }}
                className={`flex-1 sm:flex-none px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                  viewMode === 'history'
                    ? 'bg-white text-dash-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {usesFieldLayout ? 'Selesai' : 'Semua Riwayat'}
              </button>
            </div>
          )}
          {/* Creating shipments is Kepala Armada's job only */}
          {role === 'KEPALA_ARMADA' && (
            <button
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-dash-secondary hover:brightness-110 text-dash-primary font-bold rounded-xl shadow-sm transition-all hover:shadow-md"
              onClick={openCreateModal}
            >
              <Icon name="add" size={20} /> Buat Pengiriman Baru
            </button>
          )}
        </div>
      </section>

      {/* Toolbar */}
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
          {!usesFieldLayout ? (
            <SearchableSelect
              options={[
                { value: 'Darat',       label: 'Darat' },
                { value: 'Laut',        label: 'Laut' },
                { value: 'Udara',       label: 'Udara' },
                { value: 'inter_island', label: 'Antar Pulau' },
                { value: 'last_mile',   label: 'Lokal' },
                { value: 'warehousing', label: 'Gudang' },
              ]}
              value={filterService}
              onChange={v => { setFilterService(v); setCurrentPage(1) }}
              placeholder="Semua Layanan"
              searchPlaceholder="Cari layanan..."
              allLabel="Semua Layanan"
              className="w-full sm:w-48"
            />
          ) : (
            <SearchableSelect
              options={[
                { value: 'pending',    label: 'Menunggu' },
                { value: 'standby',    label: 'Standby' },
                { value: 'assigned',   label: 'Ditugaskan' },
                { value: 'at_plant',   label: 'Di Pabrik' },
                { value: 'in_transit', label: 'Dalam Perjalanan' },
                { value: 'diterima',   label: 'Diterima' },
                { value: 'diturunkan', label: 'Diturunkan' },
                { value: 'delivered',  label: 'Selesai' },
              ]}
              value={filter}
              onChange={v => { setFilter(v); setCurrentPage(1) }}
              placeholder="Semua Status"
              searchPlaceholder="Cari status..."
              allLabel="Semua Status"
              className="w-full sm:w-48"
            />
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      {!usesFieldLayout && (
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
      )}

      {/* Table / Card View */}
      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-3 border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
            <Icon name="sync" size={32} className="animate-spin" />
            <p className="text-sm font-medium">Memuat data pengiriman...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <AdminDataTable columns={columns} data={paginated} onRowClick={setSelectedShipment} />
            </div>

            {/* Mobile Card View (Always visible on mobile) */}
            <div className="block md:hidden flex flex-col gap-4">
              {paginated.length > 0 ? (
                paginated.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedShipment(s)}
                    className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3 cursor-pointer hover:border-dash-secondary transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{s.id}</span>
                        <span className="text-sm font-black text-gray-900">{s.client}</span>
                      </div>
                      <AdminStatusBadge status={s.status} type="shipment" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                        <Icon name="route" size={16} className="text-gray-400" />
                        <span className="truncate">{s.originCity} &rarr; {s.destinationCity}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                        <Icon name="person" size={16} className="text-gray-400" />
                        <span className="truncate">{s.driverName || 'Belum ditugaskan'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-3 border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                  <Icon name="search" size={32} />
                  <p className="text-sm font-medium">Tidak ada data ditemukan.</p>
                </div>
              )}
            </div>

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

      {/* ── Detail Panel ── */}
      {selectedShipment && createPortal(
        <>
          <div className="fixed inset-0 bg-dash-primary/20 backdrop-blur-sm z-[100]" onClick={() => setSelectedShipment(null)} />
          <div className={`fixed inset-0 z-[101] pointer-events-none ${usesFieldLayout ? 'flex items-center justify-center p-4' : ''}`}>
            <div className={`adm-detail-panel opacity-0 bg-white shadow-2xl flex flex-col pointer-events-auto ${
              usesFieldLayout
                ? 'w-[90vw] aspect-[9/16] md:w-[700px] md:aspect-auto md:h-fit max-h-[90vh] rounded-2xl overflow-hidden relative'
                : 'absolute right-0 top-0 h-screen w-full sm:w-[500px] border-l border-gray-200'
            }`}>
              {/* Panel Header */}
              <div className={`p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4 ${usesFieldLayout ? 'shrink-0' : ''}`}>
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
                {canUpdateStatus && (
                  <button
                    className="px-3 py-1.5 bg-dash-secondary hover:opacity-90 text-dash-primary rounded-lg text-xs font-bold transition-opacity"
                    onClick={openStatusModal}
                    title="Update status pengiriman"
                  >
                    Update Status
                  </button>
                )}
                {onTrackFull && (
                  <button
                    className="px-3 py-1.5 bg-dash-secondary/15 hover:bg-dash-secondary/25 text-[#795900] rounded-lg text-xs font-bold transition-colors"
                    onClick={() => onTrackFull(selectedShipment.id)}
                  >
                    Lacak Penuh
                  </button>
                )}
                {canDeleteShipment && (
                  <button
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    onClick={handleDeleteShipment}
                    title="Hapus pengiriman"
                  >
                    <Icon name="delete" size={14} /> Hapus
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
                  <span className="text-sm text-gray-500 font-medium">Tipe Pengiriman</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.shippingCategory}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Asal</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.originCity}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Tujuan</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.destinationCity}</span>
                </div>
                {selectedShipment.shippingCategory === 'Cargo' && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-gray-500 font-medium">Dimensi</span>
                    <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.dimensions}</span>
                  </div>
                )}
                {selectedShipment.shippingCategory === 'Container' && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-gray-500 font-medium">Tipe Container</span>
                    <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.containerType}</span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Pickup</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.pickupDate}</span>
                </div>
              </div>

              {/* Driver & Kendaraan */}
              <div className="flex flex-col gap-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                  <Icon name="directions_car" size={18} className="text-gray-400" /> Driver &amp; Kendaraan
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Driver</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2 flex items-center gap-2">
                    {selectedShipment.driverName || 'Belum ditugaskan'}
                    {/* Pengganti badge: shown when assigned driver differs from the vehicle's primary driver */}
                    {selectedShipment.driverId &&
                     selectedShipment.vehiclePrimaryDriverId &&
                     selectedShipment.driverId !== selectedShipment.vehiclePrimaryDriverId && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded-full text-[0.6rem] font-bold uppercase tracking-wide">
                        Pengganti
                      </span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-gray-500 font-medium">Kendaraan</span>
                  <span className="text-sm font-bold text-gray-900 col-span-2">{selectedShipment.vehicleName || 'Belum ditugaskan'}</span>
                </div>

                {(selectedShipment.status === 'PENDING' || selectedShipment.status === 'DITUGASKAN') && (
                  <div className="mt-2">
                    {selectedShipment.driverName ? (
                      <button
                        disabled={notifyInFlight || notifySent}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 font-bold rounded-xl shadow-sm transition-all ${
                          notifyInFlight || notifySent
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-[#25D366] hover:bg-[#20bd5a] text-white'
                        }`}
                        onClick={handleNotifyDriver}
                      >
                        <Icon name={notifySent ? 'check_circle' : 'chat'} size={18} />
                        {notifyInFlight
                          ? 'Mengirim…'
                          : notifySent
                            ? 'Notifikasi Terkirim'
                            : 'Kirim Notifikasi WhatsApp Driver'}
                      </button>
                    ) : (
                      <p className="text-xs text-center text-gray-400 italic">
                        Tugaskan driver terlebih dahulu untuk mengirim notifikasi.
                      </p>
                    )}
                  </div>
                )}

                {selectedShipment.notes && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-800 italic">
                      &ldquo;{selectedShipment.notes}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              {/* Detail Muatan — shown at the bottom once departed (hidden at Standby/Ditugaskan/Di Pabrik). All roles. */}
              {!['STANDBY', 'DITUGASKAN', 'AT_PLANT'].includes(selectedShipment.rawStatus) && renderDetailMuatan()}

            </div>
          </div>
          </div>
        </>,
        document.body
      )}

      {/* ── SUPERADMIN Assign Driver Modal ── */}
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
            {role === 'KEPALA_ARMADA' ? (
              <div className="flex flex-col gap-4 bg-gray-50/50 p-5 border border-gray-200 rounded-2xl">
                <h4 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
                  <Icon name="info" size={18} className="text-gray-400" /> Form Pengiriman Armada
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AdminFormField label="Klien" required fullWidth>
                    <select
                      value={formClientId}
                      onChange={e => setFormClientId(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white"
                    >
                      <option value="">-- Pilih Klien --</option>
                      {clientOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </AdminFormField>
                  <AdminFormField label="Tipe Pengiriman" required>
                    <select
                      value={formShippingCategory}
                      onChange={e => setFormShippingCategory(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white"
                    >
                      <option value="Unit">Unit</option>
                      <option value="Cargo">Cargo</option>
                      <option value="Container">Container</option>
                    </select>
                  </AdminFormField>
                </div>

                {/* Common Driver field */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AdminFormField label="Pilih Driver" required>
                    <select
                      value={formDriverId}
                      onChange={e => setFormDriverId(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white"
                    >
                      <option value="">-- Pilih Driver --</option>
                      {selectableCreateDrivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.fullName}{d.primaryVehicle ? ` — ${d.primaryVehicle.type} • ${d.primaryVehicle.licensePlate}` : ''}
                        </option>
                      ))}
                    </select>
                  </AdminFormField>
                  <AdminFormField label="Tanggal Pickup" required>
                    <AdminDatePicker value={formPickupDate} onChange={setFormPickupDate} placeholder="Pilih Tanggal Pickup" minDate={restrictedMinDate} />
                  </AdminFormField>
                </div>

                {/* Unit Fields */}
                {formShippingCategory === 'Unit' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AdminFormField label="Pickup Plant" required>
                      <select
                        value={formPickupPlantId}
                        onChange={e => setFormPickupPlantId(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white"
                      >
                        <option value="">-- Pilih Pabrik --</option>
                        {pickupPlants.map(p => (
                          <option key={p.id} value={p.id}>{p.manufacturer} - {p.name} {p.code ? `(${p.code})` : ''}</option>
                        ))}
                      </select>
                    </AdminFormField>
                  </div>
                )}

                {/* Cargo Fields */}
                {formShippingCategory === 'Cargo' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AdminFormField label="Alamat Penjemputan" required>
                        <input type="text" placeholder="Cth: Jl. Sudirman No 12" value={formOrigin} onChange={e => setFormOrigin(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white" />
                      </AdminFormField>
                      <AdminFormField label="Alamat Pengiriman" required>
                        <input type="text" placeholder="Cth: Jl. Pahlawan No 8" value={formDestination} onChange={e => setFormDestination(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white" />
                      </AdminFormField>
                      <AdminFormField label="Dimensi (PxLxT)">
                        <input type="text" placeholder="Cth: 200x100x50" value={formDimensions} onChange={e => setFormDimensions(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white" />
                      </AdminFormField>
                      <AdminFormField label="Berat (kg)">
                        <input type="number" min="0" placeholder="0" value={formWeight} onChange={e => setFormWeight(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white" />
                      </AdminFormField>
                    </div>
                  </>
                )}

                {/* Container Fields */}
                {formShippingCategory === 'Container' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AdminFormField label="Tipe Container" required>
                        <select
                          value={formContainerType}
                          onChange={e => setFormContainerType(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white"
                        >
                          <option value="20 Feet">20 Feet</option>
                          <option value="40 Feet">40 Feet</option>
                        </select>
                      </AdminFormField>
                      <div className="hidden md:block"></div>
                      <AdminFormField label="Alamat Penjemputan" required>
                        <input type="text" placeholder="Cth: Jl. Sudirman No 12" value={formOrigin} onChange={e => setFormOrigin(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white" />
                      </AdminFormField>
                      <AdminFormField label="Alamat Pengiriman" required>
                        <input type="text" placeholder="Cth: Jl. Pahlawan No 8" value={formDestination} onChange={e => setFormDestination(e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white" />
                      </AdminFormField>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
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

                <div className="bg-gray-50/50 p-5 border border-gray-200 rounded-2xl flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
                    <Icon name="route" size={18} className="text-gray-400" /> Rute &amp; Lokasi
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AdminFormField label="Alamat Penjemputan" required>
                      <input type="text" placeholder="Cth: Jl. Sudirman No 12" value={formOrigin} onChange={e => setFormOrigin(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white" />
                    </AdminFormField>
                    <AdminFormField label="Peta Titik Penjemputan">
                      <input type="text" placeholder="Cth: https://maps.app.goo.gl/..." value={formOriginPoint} onChange={e => setFormOriginPoint(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white" />
                    </AdminFormField>
                    <AdminFormField label="Alamat Pengiriman" required>
                      <input type="text" placeholder="Cth: Jl. Pahlawan No 8" value={formDestination} onChange={e => setFormDestination(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white" />
                    </AdminFormField>
                    <AdminFormField label="Peta Titik Pengiriman">
                      <input type="text" placeholder="Cth: https://maps.app.goo.gl/..." value={formDestinationPoint} onChange={e => setFormDestinationPoint(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white" />
                    </AdminFormField>
                    <AdminFormField label="Tanggal Pickup" required>
                      <AdminDatePicker value={formPickupDate} onChange={setFormPickupDate} placeholder="Pilih Tanggal Pickup" minDate={restrictedMinDate} />
                    </AdminFormField>
                  </div>
                </div>

                <div className="bg-gray-50/50 p-5 border border-gray-200 rounded-2xl flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
                    <Icon name="inventory_2" size={18} className="text-gray-400" /> Detail Muatan
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AdminFormField label="Deskripsi Barang" required fullWidth>
                      <input type="text" placeholder="Cth: Elektronik, Suku Cadang" value={formPackageType} onChange={e => setFormPackageType(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white" />
                    </AdminFormField>
                    <AdminFormField label="Units / Pcs" required>
                      <input type="number" min="1" placeholder="0" value={formUnits} onChange={e => setFormUnits(e.target.value)} required
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white" />
                    </AdminFormField>
                    <AdminFormField label="Berat (kg)">
                      <input type="number" min="0" placeholder="0" value={formWeight} onChange={e => setFormWeight(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white" />
                    </AdminFormField>
                  </div>
                  <AdminFormField label="Catatan Tambahan" fullWidth>
                    <textarea placeholder="Catatan khusus untuk pengiriman ini..." value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white custom-scrollbar" />
                  </AdminFormField>
                </div>
              </>
            )}
          </div>
        </AdminModal>
      )}

      {/* ── Update Status Modal ── */}
      {showStatusModal && selectedShipment && (
        <AdminModal
          title={getModalTitle()}
          subtitle={getModalSubtitle()}
          onClose={() => { setShowStatusModal(false); resetModalState() }}
          onSubmit={handleConfirmStatus}
          submitLabel={getSubmitLabel()}
        >
          {renderModalContent()}
        </AdminModal>
      )}
    </div>
  )
}
