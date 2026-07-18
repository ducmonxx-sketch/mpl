import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import { shipmentsAPI, usersAPI, fleetAPI, authAPI } from '../../lib/api'
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

// Table sort: each role prioritises the statuses it acts on first. Rows then sort by
// origin (Asal) then earliest created date within a status. Falls back to DEFAULT.
const STATUS_SORT_RANK = {
  KEPALA_ARMADA: { STANDBY: 0, DITUGASKAN: 1, AT_PLANT: 2, TRANSIT: 3, DITERIMA: 4, DITURUNKAN: 5, DELIVERED: 6, CANCELLED: 7, PENDING: 8 },
  PIC_PABRIK:    { DITUGASKAN: 0, AT_PLANT: 1, STANDBY: 2, TRANSIT: 3, DITERIMA: 4, DITURUNKAN: 5, DELIVERED: 6, CANCELLED: 7, PENDING: 8 },
  PIC_GUDANG:    { TRANSIT: 0, DITERIMA: 1, DITURUNKAN: 2, DELIVERED: 3, STANDBY: 4, DITUGASKAN: 5, AT_PLANT: 6, CANCELLED: 7, PENDING: 8 },
  DEFAULT:       { PENDING: 0, STANDBY: 1, DITUGASKAN: 2, AT_PLANT: 3, TRANSIT: 4, DITERIMA: 5, DITURUNKAN: 6, DELIVERED: 7, CANCELLED: 8 },
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
  const [filterPlant, setFilterPlant]     = useState('all') // PIC Pabrik: Lokasi Plant (defaults to bound plant)
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

  // Plant-check wizard (AT_PLANT → Dalam Perjalanan): 3 pages + confirmation box
  const emptyPengirimanRow = () => ({ tipeMotor: '', noShipping: '', jumlah: '', satuan: '', keterangan: '' })
  const emptyLkuRow = () => ({ tipeMotor: '', noMesin: '', noRangka: '', warna: '', itemDefect: '' })
  const emptyKsuRow = () => ({ tipeMotor: '', helm: '', accu: '', spion: '', toolkit: '', bsBp: '', kKontak: '', fuse: '', platNo: '', sticker: '' })
  const [pabrikPage, setPabrikPage]                   = useState(1)
  const [pcPengiriman, setPcPengiriman]               = useState([emptyPengirimanRow()])
  const [pcLku, setPcLku]                             = useState([emptyLkuRow()])
  const [pcKsu, setPcKsu]                             = useState([emptyKsuRow()])
  const [showPabrikConfirm, setShowPabrikConfirm]     = useState(false)
  // Auto-scroll the wizard body to the newest row when a dynamic row is added.
  const pengirimanEndRef  = useRef(null)
  const prevPengirimanLen = useRef(1)

  const [serahTerimaUrl, setSerahTerimaUrl]           = useState('')
  const [handoverNotes, setHandoverNotes]             = useState('')
  // PIC_GUDANG serah-terima (Diturunkan → Selesai): two catatan columns + confirm box
  const [catatanPlantPengirim, setCatatanPlantPengirim]   = useState('')
  const [catatanGudangPenerima, setCatatanGudangPenerima] = useState('')
  const [showGudangConfirm, setShowGudangConfirm]         = useState(false)

  // ── SUPERADMIN separate assign modal ────────────────────────
  const [showAssignModal, setShowAssignModal]     = useState(false)
  const [assigningShipment, setAssigningShipment] = useState(null)
  const [assignDriverId, setAssignDriverId]       = useState('')
  const [assignVehicleId, setAssignVehicleId]     = useState('')
  const [availableDrivers, setAvailableDrivers]   = useState([])
  const [availableVehicles, setAvailableVehicles] = useState([])

  // ── Create modal ─────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [linkMode, setLinkMode]               = useState(false) // create modal opened via "Hubungkan Pengiriman"
  const [linkTargetId, setLinkTargetId]       = useState('')    // existing trip the new shipment binds to
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
  // Dalam Proses/Selesai views).
  const usesFieldLayout = role === 'KEPALA_ARMADA' || role === 'PIC_PABRIK' || role === 'PIC_GUDANG'

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

  // Existing pre-departure trips a new shipment can be linked into (Hubungkan Pengiriman).
  // One entry per trip (deduped by group) — any member resolves to the same driver+vehicle on the backend.
  const linkableTrips = (() => {
    const seen = new Set()
    return SHIPMENTS.filter(s => {
      if (!s.driverId || (s.rawStatus !== 'STANDBY' && s.rawStatus !== 'DITUGASKAN')) return false
      const key = s.linkGroupId || s.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })()

  // Siblings of the open shipment (same trip, excluding itself)
  const linkedSiblings = selectedShipment?.linkGroupId
    ? SHIPMENTS.filter(s => s.linkGroupId === selectedShipment.linkGroupId && s.id !== selectedShipment.id)
    : []

  // Status options for SUPERADMIN status picker
  const statusOptions = selectedShipment ? availableStatusOptions(user?.role, selectedShipment.rawStatus) : []

  // Whether the Update Status button should be shown
  const canUpdateStatus = selectedShipment && (() => {
    if (isSuperAdmin) return statusOptions.length > 0;
    const rs = selectedShipment.rawStatus;
    if (role === 'KEPALA_ARMADA') return rs === 'STANDBY';
    if (role === 'PIC_PABRIK') return rs === 'DITUGASKAN' || rs === 'AT_PLANT';
    if (role === 'PIC_GUDANG') return ['TRANSIT', 'DITERIMA', 'DITURUNKAN'].includes(rs);
    return ['PENDING', 'STANDBY', 'DITUGASKAN', 'AT_PLANT', 'TRANSIT'].includes(rs);
  })();

  // ── Data fetching ─────────────────────────────────────────────
  // Map a raw API shipment → the display shape used across the table + detail modal.
  const mapShipment = (s) => ({
    id:                    s.id,
    clientId:              s.clientId,
    client:                s.client?.companyName || s.client?.fullName || '-',
    serviceType:           s.serviceLevel || 'Darat',
    shippingCategory:      s.shippingCategory || '-',
    originCity:            s.originLocation,
    pickupPlantId:         s.pickupPlantId || null,
    plantCheck:            s.plantCheck || null,
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
    linkGroupId:           s.linkGroupId || null,
    status:                mapStatus(s.status),
    rawStatus:             s.status,
    notes:                 s.specialNotes || '',
    createdBy:             s.createdByAdmin?.fullName || s.client?.fullName || '-',
  })

  const fetchShipments = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const data = await shipmentsAPI.list()
      setSHIPMENTS((data.shipments || data || []).map(mapShipment))
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

  // PIC Pabrik: load plant list for the filter + default it to the account's bound plant (soft, changeable).
  useEffect(() => {
    if (role !== 'PIC_PABRIK') return
    fetchPickupPlants()
    authAPI.getAdminMe()
      .then(res => { if (res?.admin?.pickupPlantId) setFilterPlant(res.admin.pickupPlantId) })
      .catch(() => {})
  }, [role])

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
    setLinkTargetId('')
  }

  const fetchPickupPlants = async () => {
    try {
      const data = await shipmentsAPI.getPickupPlants()
      setPickupPlants(data.plants || [])
    } catch (err) {
      console.error('Failed to fetch pickup plants:', err)
    }
  }

  const openCreateModal = (link = false) => {
    fetchClients()
    if (role === 'KEPALA_ARMADA') {
      fetchFleet()
      fetchPickupPlants()
    }
    resetCreateForm()
    setLinkMode(link === true)
    setShowCreateModal(true)
  }

  const handleCreateShipment = async () => {
    if (!formClientId) {
      showToast('Pilih Klien terlebih dahulu.', 'error')
      return
    }

    if (role === 'KEPALA_ARMADA') {
      if (linkMode) {
        if (!linkTargetId) {
          showToast('Pilih trip driver untuk dihubungkan.', 'error')
          return
        }
      } else if (!formDriverId) {
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
        // Link mode: driver+armada come from the target trip (backend copies them), so send only linkToShipmentId.
        linkToShipmentId:    linkMode ? linkTargetId : undefined,
        driverId:            linkMode ? undefined : (role === 'KEPALA_ARMADA' ? formDriverId : undefined),
        vehicleId:           linkMode ? undefined : armadaVehicleId,
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

  const handleDeleteShipment = async (scope = 'single') => {
    if (!selectedShipment) return
    const isGroup = scope === 'group'
    const msg = isGroup
      ? `Hapus SEMUA ${(linkedSiblings.length + 1)} pengiriman yang terhubung? Tindakan ini tidak dapat dibatalkan.`
      : `Hapus pengiriman ${selectedShipment.id}? Tindakan ini tidak dapat dibatalkan.`
    if (!window.confirm(msg)) return
    try {
      await shipmentsAPI.remove(selectedShipment.id, isGroup ? 'group' : undefined)
      showToast(isGroup ? 'Pengiriman terhubung dihapus.' : 'Pengiriman dihapus.', 'success')
      setSelectedShipment(null)
      fetchShipments({ silent: true })
    } catch (err) {
      showToast(err.message || 'Gagal menghapus pengiriman.', 'error')
    }
  }

  // ── Update Status modal ───────────────────────────────────────
  // Plant-check wizard draft persistence (per shipment) — survives closing/reopening the modal.
  const PC_DRAFT_PREFIX = 'mpl:plantCheckDraft:'
  const loadPlantCheckDraft = (shipmentId) => {
    try {
      const raw = localStorage.getItem(PC_DRAFT_PREFIX + shipmentId)
      const d = raw ? JSON.parse(raw) : null
      return d && typeof d === 'object' ? d : null
    } catch { return null }
  }
  const savePlantCheckDraft = (shipmentId, draft) => {
    try { localStorage.setItem(PC_DRAFT_PREFIX + shipmentId, JSON.stringify(draft)) } catch { /* quota / disabled storage — draft is best-effort */ }
  }
  const clearPlantCheckDraft = (shipmentId) => {
    try { localStorage.removeItem(PC_DRAFT_PREFIX + shipmentId) } catch { /* ignore */ }
  }

  // Clear All: wipe the wizard back to its 0-state and drop the saved draft.
  const handleClearPlantCheck = () => {
    setPcPengiriman([emptyPengirimanRow()])
    setPcLku([emptyLkuRow()])
    setPcKsu([emptyKsuRow()])
    setPabrikPage(1)
    if (selectedShipment?.id) clearPlantCheckDraft(selectedShipment.id)
    showToast('Form pengecekan dikosongkan.', 'success')
  }

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
    setCatatanPlantPengirim('')
    setCatatanGudangPenerima('')
    setShowGudangConfirm(false)
    setPabrikPage(1)
    setPcPengiriman([emptyPengirimanRow()])
    setPcLku([emptyLkuRow()])
    setPcKsu([emptyKsuRow()])
    setShowPabrikConfirm(false)
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
    // Plant-check wizard: restore a saved draft for this shipment if one exists,
    // otherwise start with one blank Data Pengiriman row (no prefill).
    if (rawStatus === 'AT_PLANT') {
      const draft = loadPlantCheckDraft(selectedShipment.id)
      if (draft) {
        setPcPengiriman(draft.pengiriman?.length ? draft.pengiriman : [emptyPengirimanRow()])
        setPcLku(draft.lku?.length ? draft.lku : [emptyLkuRow()])
        setPcKsu(draft.ksu?.length ? draft.ksu : [emptyKsuRow()])
        setPabrikPage(draft.page || 1)
      } else {
        setPcPengiriman([emptyPengirimanRow()])
      }
    }
  }

  // Plant-check wizard row helpers (Pengiriman / LKU / KSU add·update·remove)
  const addPengiriman    = () => setPcPengiriman(rows => [...rows, emptyPengirimanRow()])
  const removePengiriman = (i) => setPcPengiriman(rows => rows.filter((_, idx) => idx !== i))
  const updatePengiriman = (i, field, val) => setPcPengiriman(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const addLku    = () => setPcLku(rows => [...rows, emptyLkuRow()])
  const removeLku = (i) => setPcLku(rows => rows.filter((_, idx) => idx !== i))
  const updateLku = (i, field, val) => setPcLku(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const addKsu    = () => setPcKsu(rows => [...rows, emptyKsuRow()])
  const removeKsu = (i) => setPcKsu(rows => rows.filter((_, idx) => idx !== i))
  const updateKsu = (i, field, val) => setPcKsu(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r))

  // Scroll the wizard body to the newly added Data Pengiriman row.
  useEffect(() => {
    if (pcPengiriman.length > prevPengirimanLen.current) {
      pengirimanEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    prevPengirimanLen.current = pcPengiriman.length
  }, [pcPengiriman.length])

  // Auto-save the wizard draft while the plant-check modal is open (per shipment).
  // Guarded on the open+AT_PLANT state so closing/resetting never overwrites the draft.
  useEffect(() => {
    if (!showStatusModal || selectedShipment?.rawStatus !== 'AT_PLANT' || !selectedShipment?.id) return
    savePlantCheckDraft(selectedShipment.id, { pengiriman: pcPengiriman, lku: pcLku, ksu: pcKsu, page: pabrikPage })
  }, [showStatusModal, selectedShipment, pcPengiriman, pcLku, pcKsu, pabrikPage])

  // Confirm-box action: submit the whole plant-check payload → Dalam Perjalanan
  const doSubmitPlantCheck = async () => {
    try {
      const dataPengiriman = pcPengiriman
        .filter(r => r.tipeMotor.trim())
        .map(r => ({ ...r, jumlah: Number(r.jumlah) || 0 }))
      const lku = pcLku.filter(r => Object.values(r).some(v => String(v).trim()))
      const ksu = pcKsu.filter(r => Object.values(r).some(v => String(v).trim()))
      await shipmentsAPI.plantCheck(selectedShipment.id, {
        dataPengiriman,
        lku,
        ksu,
      })
      showToast('Pengecekan Pabrik Selesai. Status → Dalam Perjalanan.', 'success')
      clearPlantCheckDraft(selectedShipment.id)
      setShowPabrikConfirm(false)
      setShowStatusModal(false)
      resetModalState()
      fetchShipments({ silent: true })
      // Soft-refresh the still-open detail modal so it shows the saved Pengecekan Pabrik.
      try {
        const fresh = await shipmentsAPI.getById(selectedShipment.id)
        setSelectedShipment(mapShipment(fresh.shipment || fresh))
      } catch {
        setSelectedShipment(prev => prev ? ({ ...prev, rawStatus: 'TRANSIT', status: 'in_transit' }) : null)
      }
    } catch (err) {
      showToast(err.message || 'Gagal memproses pengecekan pabrik.', 'error')
      setShowPabrikConfirm(false)
    }
  }

  // Confirm-box action: PIC_GUDANG serah-terima → Selesai (DELIVERED)
  const doSubmitHandover = async () => {
    try {
      await shipmentsAPI.handover(selectedShipment.id, { catatanPlantPengirim, catatanGudangPenerima })
      showToast('Serah Terima Selesai. Status → Selesai.', 'success')
      setShowGudangConfirm(false)
      setShowStatusModal(false)
      resetModalState()
      fetchShipments({ silent: true })
      // Soft-refresh the still-open detail modal so it shows the completed handover.
      try {
        const fresh = await shipmentsAPI.getById(selectedShipment.id)
        setSelectedShipment(mapShipment(fresh.shipment || fresh))
      } catch {
        setSelectedShipment(prev => prev ? ({ ...prev, rawStatus: 'DELIVERED', status: 'delivered' }) : null)
      }
    } catch (err) {
      showToast(err.message || 'Gagal memproses serah terima.', 'error')
      setShowGudangConfirm(false)
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

      // Di Pabrik → Dalam Perjalanan: 3-page wizard. Submit button = Next (p1/p2) or open confirm (p3).
      if (role === 'PIC_PABRIK' && rawStatus === 'AT_PLANT') {
        if (pabrikPage === 1) {
          const filled = pcPengiriman.filter(r => r.tipeMotor.trim())
          if (filled.length === 0) {
            return showToast('Tambahkan minimal satu Data Pengiriman.', 'error')
          }
          const incomplete = filled.some(r => !r.noShipping.trim() || !String(r.jumlah).trim() || !r.satuan.trim())
          if (incomplete) {
            return showToast('Lengkapi setiap baris Data Pengiriman (Tipe Motor, No. Shipping, Jumlah, Satuan).', 'error')
          }
          setPabrikPage(2)
          return
        }
        if (pabrikPage === 2) {
          // Auto-assign KSU rows from the motor types entered on Data Pengiriman
          // (one row per distinct type). Only seed on first arrival so we don't
          // wipe KSU data if the user steps back and forward again.
          const motorTypes = [...new Set(pcPengiriman.map(r => r.tipeMotor.trim()).filter(Boolean))]
          const ksuUntouched = pcKsu.length <= 1 && pcKsu.every(r => !Object.values(r).some(v => String(v).trim()))
          if (ksuUntouched && motorTypes.length > 0) {
            setPcKsu(motorTypes.map(t => ({ ...emptyKsuRow(), tipeMotor: t })))
          }
          setPabrikPage(3) // LKU optional
          return
        }
        // page 3 (KSU, required)
        const ksuFilled = pcKsu.filter(r => Object.values(r).some(v => String(v).trim()))
        if (ksuFilled.length === 0) {
          return showToast('Isi minimal satu baris Perlengkapan Motor (KSU).', 'error')
        }
        setShowPabrikConfirm(true) // open confirmation box; actual submit on confirm
        return
      }

      // ── PIC_GUDANG gudang leg ──────────────────────────────────
      // Dalam Perjalanan → Diterima → Diturunkan: simple one-tap confirmations.
      if (role === 'PIC_GUDANG' && rawStatus === 'TRANSIT') {
        const ok = await handleStatusUpdate('DITERIMA')
        if (ok) { setShowStatusModal(false); resetModalState() }
        return
      }
      if (role === 'PIC_GUDANG' && rawStatus === 'DITERIMA') {
        const ok = await handleStatusUpdate('DITURUNKAN')
        if (ok) { setShowStatusModal(false); resetModalState() }
        return
      }
      // Diturunkan → Selesai: catatan serah-terima form, then a confirmation box.
      if (role === 'PIC_GUDANG' && rawStatus === 'DITURUNKAN') {
        setShowGudangConfirm(true) // actual submit happens on confirm
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
    if (role === 'PIC_GUDANG' && selectedShipment.rawStatus === 'TRANSIT') return 'Konfirmasi Penerimaan'
    if (role === 'PIC_GUDANG' && selectedShipment.rawStatus === 'DITERIMA') return 'Konfirmasi Penurunan Muatan'
    if (role === 'PIC_GUDANG' && selectedShipment.rawStatus === 'DITURUNKAN') return 'Serah Terima (Gudang)'

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
    if (role === 'PIC_PABRIK' && selectedShipment.rawStatus === 'AT_PLANT') return `${sid} — Langkah ${pabrikPage}/3`
    if (role === 'PIC_GUDANG' && selectedShipment.rawStatus === 'TRANSIT') return `${sid} — konfirmasi barang diterima di gudang`
    if (role === 'PIC_GUDANG' && selectedShipment.rawStatus === 'DITERIMA') return `${sid} — konfirmasi muatan diturunkan`
    if (role === 'PIC_GUDANG' && selectedShipment.rawStatus === 'DITURUNKAN') return `${sid} — catatan serah terima perlengkapan`

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
    if (role === 'PIC_PABRIK' && selectedShipment.rawStatus === 'AT_PLANT') return pabrikPage < 3 ? 'Lanjut' : 'Selesaikan Pengecekan'
    if (role === 'PIC_GUDANG' && selectedShipment.rawStatus === 'TRANSIT') return 'Konfirmasi Diterima'
    if (role === 'PIC_GUDANG' && selectedShipment.rawStatus === 'DITERIMA') return 'Konfirmasi Diturunkan'
    if (role === 'PIC_GUDANG' && selectedShipment.rawStatus === 'DITURUNKAN') return 'Selesaikan Pengiriman'

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

      // ── PIC_PABRIK: plant-check wizard (Di Pabrik → Dalam Perjalanan) ──
      if (role === 'PIC_PABRIK' && rawStatus === 'AT_PLANT') {
        const inp = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-dash-secondary focus:ring-1 focus:ring-dash-secondary outline-none"
        const KSU_FIELDS = [['helm','Helm'],['accu','Accu'],['spion','Spion'],['toolkit','Toolkit'],['bsBp','BS & BP'],['kKontak','K. Kontak'],['fuse','Fuse'],['platNo','Plat No.'],['sticker','Sticker']]
        // Distinct motor types entered on the Data Pengiriman page → feed KSU's auto-assigned Tipe Motor.
        const motorTypes = [...new Set(pcPengiriman.map(r => r.tipeMotor.trim()).filter(Boolean))]
        // Keterangan per motor type (first row wins) → shown beside the KSU Tipe Motor.
        const ketByMotor = pcPengiriman.reduce((acc, r) => {
          const t = r.tipeMotor.trim()
          if (t && !(t in acc)) acc[t] = (r.keterangan || '').trim()
          return acc
        }, {})
        // Red-circle remove button, pinned to the top-left corner of a dynamic row.
        const removeBtn = (onClick) => (
          <button
            type="button"
            onClick={onClick}
            className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md z-10"
            aria-label="Hapus baris"
          >
            <Icon name="close" size={14} />
          </button>
        )
        const step = (n, label) => (
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.65rem] font-bold ${pabrikPage === n ? 'bg-dash-secondary text-dash-primary' : pabrikPage > n ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{n}</span>
            <span className={`text-xs font-bold ${pabrikPage === n ? 'text-dash-primary' : 'text-gray-400'}`}>{label}</span>
          </div>
        )
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Draf tersimpan otomatis</span>
              <button
                type="button"
                onClick={handleClearPlantCheck}
                className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 border border-red-700 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Icon name="delete" size={14} /> Clear All
              </button>
            </div>
            <div className="flex items-center">
              {step(1, 'Pengiriman')}
              <div className="flex-1 h-px bg-gray-200 mx-2" />
              {step(2, 'LKU')}
              <div className="flex-1 h-px bg-gray-200 mx-2" />
              {step(3, 'KSU')}
            </div>

            {pabrikPage === 1 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-bold text-gray-900">Data Pengiriman <span className="text-red-500">*</span></p>
                {pcPengiriman.map((r, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-2 relative">
                    {pcPengiriman.length > 1 && removeBtn(() => removePengiriman(i))}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input className={inp} placeholder="Tipe Motor *" value={r.tipeMotor} onChange={e => updatePengiriman(i, 'tipeMotor', e.target.value)} />
                      <input className={inp} placeholder="No. Shipping *" value={r.noShipping} onChange={e => updatePengiriman(i, 'noShipping', e.target.value)} />
                      <input type="number" min="0" className={inp} placeholder="Jumlah *" value={r.jumlah} onChange={e => updatePengiriman(i, 'jumlah', e.target.value)} />
                      <input className={inp} placeholder="Satuan *" value={r.satuan} onChange={e => updatePengiriman(i, 'satuan', e.target.value)} />
                    </div>
                    <input className={inp} placeholder="Keterangan" value={r.keterangan} onChange={e => updatePengiriman(i, 'keterangan', e.target.value)} />
                  </div>
                ))}
                <button type="button" onClick={addPengiriman} className="w-full text-xs font-bold text-dash-primary bg-dash-secondary/20 hover:bg-dash-secondary/30 border border-dash-secondary/50 px-3 py-2.5 rounded-lg flex items-center justify-center gap-1"><Icon name="add" size={14} /> Tambah Baris</button>
                <div ref={pengirimanEndRef} />
              </div>
            )}

            {pabrikPage === 2 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-bold text-gray-900">Laporan Kondisi Unit (LKU) <span className="text-gray-400 font-normal text-xs">— opsional</span></p>
                {pcLku.length === 0 && <p className="text-xs text-gray-400 italic">Belum ada baris. Tambahkan hanya bila ada catatan kondisi / defect unit.</p>}
                {pcLku.map((r, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-2 relative">
                    {removeBtn(() => removeLku(i))}
                    <div className="grid grid-cols-2 gap-2">
                      <select className={inp} value={r.tipeMotor} onChange={e => updateLku(i, 'tipeMotor', e.target.value)}>
                        <option value="">— Pilih Tipe Motor —</option>
                        {motorTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input className={inp} placeholder="No. Mesin" value={r.noMesin} onChange={e => updateLku(i, 'noMesin', e.target.value)} />
                      <input className={inp} placeholder="No. Rangka" value={r.noRangka} onChange={e => updateLku(i, 'noRangka', e.target.value)} />
                      <input className={inp} placeholder="Warna" value={r.warna} onChange={e => updateLku(i, 'warna', e.target.value)} />
                    </div>
                    <input className={inp} placeholder="Item Defect" value={r.itemDefect} onChange={e => updateLku(i, 'itemDefect', e.target.value)} />
                  </div>
                ))}
                <button type="button" onClick={() => setPcLku(rows => [...rows, { ...emptyLkuRow(), tipeMotor: motorTypes[0] || '' }])} className="w-full text-xs font-bold text-dash-primary bg-dash-secondary/20 hover:bg-dash-secondary/30 border border-dash-secondary/50 px-3 py-2.5 rounded-lg flex items-center justify-center gap-1"><Icon name="add" size={14} /> Tambah Baris</button>
              </div>
            )}

            {pabrikPage === 3 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">Perlengkapan Motor (KSU) <span className="text-red-500">*</span></p>
                </div>
                {pcKsu.map((r, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-2 relative">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.65rem] font-bold text-[#eab308] uppercase tracking-wide">Tipe Motor</span>
                      <span className="text-sm font-bold text-gray-900">{r.tipeMotor || '—'}</span>
                      {ketByMotor[r.tipeMotor] && <span className="text-sm text-dash-primary/70">[{ketByMotor[r.tipeMotor]}]</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {KSU_FIELDS.map(([f, lbl]) => (
                        <div key={f} className="flex flex-col gap-1">
                          <label className="text-[0.65rem] font-bold text-gray-500">{lbl}</label>
                          <input className={inp} value={r[f]} onChange={e => updateKsu(i, f, e.target.value)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      }

      // ── PIC_GUDANG: Dalam Perjalanan → Diterima (simple confirmation) ──
      if (role === 'PIC_GUDANG' && rawStatus === 'TRANSIT') {
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500">Status saat ini:</span>
              <AdminStatusBadge status="in_transit" type="shipment" />
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              Konfirmasi bahwa pengiriman <b>{selectedShipment.id}</b> telah <b>diterima</b> di gudang. Status akan berubah menjadi <b>Diterima</b>.
            </div>
          </div>
        )
      }

      // ── PIC_GUDANG: Diterima → Diturunkan (simple confirmation) ──
      if (role === 'PIC_GUDANG' && rawStatus === 'DITERIMA') {
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500">Status saat ini:</span>
              <AdminStatusBadge status={mapStatus('DITERIMA')} type="shipment" />
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              Konfirmasi bahwa muatan pengiriman <b>{selectedShipment.id}</b> telah <b>diturunkan</b>. Status akan berubah menjadi <b>Diturunkan</b>.
            </div>
          </div>
        )
      }

      // ── PIC_GUDANG: Diturunkan → Selesai (catatan serah terima) ──
      if (role === 'PIC_GUDANG' && rawStatus === 'DITURUNKAN') {
        const ta = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-dash-secondary focus:ring-1 focus:ring-dash-secondary outline-none transition-shadow custom-scrollbar"
        return (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500">Status saat ini:</span>
              <AdminStatusBadge status={mapStatus('DITURUNKAN')} type="shipment" />
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-sm font-bold text-gray-900 text-center border-b border-gray-100 pb-2">Catatan Serah Terima Perlengkapan Motor</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Plant Pengirim</label>
                  <textarea className={ta} rows={5} placeholder="Catatan dari plant pengirim..." value={catatanPlantPengirim} onChange={e => setCatatanPlantPengirim(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Gudang Penerima</label>
                  <textarea className={ta} rows={5} placeholder="Catatan dari gudang penerima..." value={catatanGudangPenerima} onChange={e => setCatatanGudangPenerima(e.target.value)} />
                </div>
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

  // Plant check (Pengurus Pabrik) — read-only, shown in the detail panel once the check is done
  const renderPlantCheck = () => {
    const pc = selectedShipment?.plantCheck
    if (!pc) return null
    return (
      <div className="flex flex-col gap-3">
        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
          <Icon name="fact_check" size={18} className="text-gray-400" /> Pengecekan Pabrik
        </h4>

        {pc.pengiriman?.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Data Pengiriman ({pc.pengiriman.length})</span>
            {pc.pengiriman.map((r, i) => (
              <div key={i} className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <span className="font-bold">{r.tipeMotor || '-'}</span> · {r.noShipping || '-'} · Jumlah: {r.jumlah ?? '-'} · Satuan: {r.satuan || '-'}
                {r.keterangan ? <span className="text-gray-500"> · {r.keterangan}</span> : null}
              </div>
            ))}
          </div>
        )}

        {pc.lku?.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">LKU — Kondisi Unit ({pc.lku.length})</span>
            {pc.lku.map((r, i) => (
              <div key={i} className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <span className="font-bold">{r.tipeMotor || '-'}</span> · Mesin {r.noMesin || '-'} · Rangka {r.noRangka || '-'} · {r.warna || '-'}
                {r.itemDefect ? <span className="text-red-600"> · Defect: {r.itemDefect}</span> : null}
              </div>
            ))}
          </div>
        )}

        {pc.ksu?.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">KSU — Perlengkapan ({pc.ksu.length})</span>
            {pc.ksu.map((r, i) => (
              <div key={i} className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 flex flex-col gap-0.5">
                <span className="font-bold">{r.tipeMotor || '-'}</span>
                <span>
                  {[['Helm', r.helm], ['Accu', r.accu], ['Spion', r.spion], ['Toolkit', r.toolkit], ['BS&BP', r.bsBp], ['K.Kontak', r.kKontak], ['Fuse', r.fuse], ['Plat', r.platNo], ['Sticker', r.sticker]].map(([lbl, val], j) => (
                    <span key={lbl}>{j > 0 ? ' | ' : ''}{lbl}: <span className="font-bold text-gray-900">{val || '-'}</span></span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Plant-check confirmation summary — segmented review of what was entered in the wizard.
  const renderPabrikSummary = () => {
    const pengirimanRows = pcPengiriman.filter(r => r.tipeMotor.trim())
    const lkuRows = pcLku.filter(r => Object.values(r).some(v => String(v).trim()))
    const ksuRows = pcKsu.filter(r => Object.values(r).some(v => String(v).trim()))
    const KSU_FIELDS = [['helm','Helm'],['accu','Accu'],['spion','Spion'],['toolkit','Toolkit'],['bsBp','BS & BP'],['kKontak','K. Kontak'],['fuse','Fuse'],['platNo','Plat No.'],['sticker','Sticker']]
    const th = "text-left text-[0.6rem] font-bold text-gray-500 uppercase tracking-wide px-2.5 py-1.5"
    const td = "text-sm text-gray-800 px-2.5 py-1.5 align-top"
    return (
      <div className="flex flex-col gap-4">
        {/* Data Pengiriman */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-dash-primary uppercase tracking-wide">Data Pengiriman ({pengirimanRows.length})</span>
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full min-w-[480px]">
              <thead className="bg-gray-50"><tr>
                <th className={th}>Tipe Motor</th><th className={th}>No. Shipping</th><th className={th}>Jumlah</th><th className={th}>Satuan</th><th className={th}>Keterangan</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {pengirimanRows.map((r, i) => (
                  <tr key={i}>
                    <td className={`${td} font-bold`}>{r.tipeMotor || '-'}</td>
                    <td className={td}>{r.noShipping || '-'}</td>
                    <td className={td}>{r.jumlah || '-'}</td>
                    <td className={td}>{r.satuan || '-'}</td>
                    <td className={td}>{r.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* LKU */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-dash-primary uppercase tracking-wide">LKU — Kondisi Unit ({lkuRows.length})</span>
          {lkuRows.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Tidak ada catatan kondisi unit.</p>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full min-w-[520px]">
                <thead className="bg-gray-50"><tr>
                  <th className={th}>Tipe Motor</th><th className={th}>No. Mesin</th><th className={th}>No. Rangka</th><th className={th}>Warna</th><th className={th}>Item Defect</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {lkuRows.map((r, i) => (
                    <tr key={i}>
                      <td className={`${td} font-bold`}>{r.tipeMotor || '-'}</td>
                      <td className={td}>{r.noMesin || '-'}</td>
                      <td className={td}>{r.noRangka || '-'}</td>
                      <td className={td}>{r.warna || '-'}</td>
                      <td className={td}>{r.itemDefect || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* KSU — segmented per motor */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-dash-primary uppercase tracking-wide">KSU — Perlengkapan ({ksuRows.length})</span>
          <div className="flex flex-col gap-2">
            {ksuRows.map((r, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
                <span className="text-sm font-bold text-gray-900">{r.tipeMotor || '-'}</span>
                <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                  {KSU_FIELDS.map(([f, lbl]) => (
                    <div key={f} className="flex flex-col">
                      <span className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-wide">{lbl}</span>
                      <span className="text-sm text-gray-800">{r[f] || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

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

    // PIC Pabrik: Lokasi Plant filter (soft default = bound plant; 'all' = every plant).
    const matchPlant = filterPlant === 'all' || s.pickupPlantId === filterPlant

    // Kepala Armada sees the full lifecycle of their shipments, split by the
    // Dalam Proses / Selesai view mode above (no status restriction).
    return matchStatus && matchClient && matchService && matchSearch && matchViewMode && matchPlant
  })

  // All roles: sort by status (order unique per role) → origin (Asal) → earliest date.
  {
    const RANK = STATUS_SORT_RANK[role] || STATUS_SORT_RANK.DEFAULT
    filtered.sort((a, b) => {
      const ra = RANK[a.rawStatus] ?? 99
      const rb = RANK[b.rawStatus] ?? 99
      if (ra !== rb) return ra - rb
      const byAsal = (a.originCity || '').localeCompare(b.originCity || '')
      if (byAsal !== 0) return byAsal
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
    // PIC Pabrik: Unit-only + always "Gudang MPL" → show the varying Lokasi Plant (Asal) instead of Tipe/Tujuan.
    ...(role === 'PIC_PABRIK'
      ? [{ key: 'originCity', label: 'Lokasi Plant', render: (v) => v || '-' }]
      : [
          { key: 'shippingCategory', label: 'Tipe Pengiriman', render: (v) => v || '-' },
          { key: 'destinationCity', label: 'Tujuan' },
        ]),
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
            <>
              <button
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-dash-primary font-bold rounded-xl border border-gray-300 shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => openCreateModal(true)}
                disabled={linkableTrips.length === 0}
                title={linkableTrips.length === 0 ? 'Belum ada pengiriman aktif untuk dihubungkan' : 'Buat pengiriman pada trip driver yang sudah ada'}
              >
                <Icon name="route" size={20} /> Hubungkan Pengiriman
              </button>
              <button
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-dash-secondary hover:brightness-110 text-dash-primary font-bold rounded-xl shadow-sm transition-all hover:shadow-md"
                onClick={() => openCreateModal(false)}
              >
                <Icon name="add" size={20} /> Buat Pengiriman Baru
              </button>
            </>
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
          {role === 'PIC_PABRIK' && (
            <SearchableSelect
              options={pickupPlants.map(p => ({ value: p.id, label: `${p.manufacturer} - ${p.name}${p.code ? ` (${p.code})` : ''}` }))}
              value={filterPlant}
              onChange={v => { setFilterPlant(v); setCurrentPage(1) }}
              placeholder="Semua Lokasi Plant"
              searchPlaceholder="Cari plant..."
              allLabel="Semua Lokasi Plant"
              className="w-full sm:w-64"
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
                <div className="flex items-center gap-2 flex-wrap">
                  <AdminStatusBadge status={selectedShipment.status} type="shipment" />
                  {linkedSiblings.length > 0 && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-full text-[0.6rem] font-bold uppercase tracking-wide flex items-center gap-1">
                      <Icon name="route" size={12} /> Tertaut
                    </span>
                  )}
                </div>
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
                {canDeleteShipment && (
                  <button
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    onClick={() => handleDeleteShipment('single')}
                    title={linkedSiblings.length > 0 ? 'Hapus hanya pengiriman ini' : 'Hapus pengiriman'}
                  >
                    <Icon name="delete" size={14} /> {linkedSiblings.length > 0 ? 'Hapus Pengiriman Ini' : 'Hapus'}
                  </button>
                )}
                {canDeleteShipment && linkedSiblings.length > 0 && (
                  <button
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white border border-red-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    onClick={() => handleDeleteShipment('group')}
                    title="Hapus semua pengiriman yang terhubung"
                  >
                    <Icon name="delete" size={14} /> Hapus Semua Terhubung
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

                {linkedSiblings.length > 0 && (
                  <div className="mt-1 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-indigo-800 flex items-center gap-1">
                      <Icon name="route" size={14} /> Trip yang sama ({linkedSiblings.length + 1} pengiriman)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {linkedSiblings.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedShipment(s)}
                          className="px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                          title={`${s.client} — ${s.destinationCity}`}
                        >
                          {s.id}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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

              {/* Pengecekan Pabrik — read-only, once the plant check has been completed */}
              {renderPlantCheck()}

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
          title={linkMode ? 'Hubungkan Pengiriman' : 'Buat Pengiriman Baru'}
          subtitle={linkMode
            ? 'Buat pengiriman baru pada trip driver yang sudah berjalan (satu driver & armada mengangkut beberapa pengiriman).'
            : 'Isi detail pengiriman baru di bawah ini.'}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateShipment}
          submitLabel={linkMode ? 'Hubungkan Pengiriman' : 'Simpan Pengiriman'}
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

                {/* Common Driver field — in link mode the driver+armada come from the chosen trip */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {linkMode ? (
                    <AdminFormField label="Hubungkan ke Trip Driver" required>
                      <select
                        value={linkTargetId}
                        onChange={e => setLinkTargetId(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-white"
                      >
                        <option value="">-- Pilih Trip --</option>
                        {linkableTrips.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.driverName || 'Driver'} — {t.vehicleName || 'Armada'} ({t.status === 'standby' ? 'Standby' : 'Ditugaskan'})
                          </option>
                        ))}
                      </select>
                    </AdminFormField>
                  ) : (
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
                  )}
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
          footerLeft={
            role === 'PIC_PABRIK' && selectedShipment.rawStatus === 'AT_PLANT' && pabrikPage > 1 ? (
              <button
                type="button"
                onClick={() => setPabrikPage(p => p - 1)}
                className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors flex items-center gap-2"
              >
                <Icon name="arrow_back" size={18} /> Kembali
              </button>
            ) : null
          }
        >
          {renderModalContent()}
        </AdminModal>
      )}

      {/* Plant-check confirmation box — sits above the wizard modal (z-[300]) */}
      {showPabrikConfirm && selectedShipment && createPortal(
        <div className="fixed inset-0 z-[300] bg-[#002442]/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPabrikConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 p-6 border-b border-gray-100">
              <span className="w-10 h-10 rounded-full bg-dash-secondary/20 text-dash-primary flex items-center justify-center shrink-0"><Icon name="fact_check" size={22} /></span>
              <div>
                <h3 className="text-lg font-bold text-dash-primary">Selesaikan Pengecekan?</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Ringkasan pengecekan <b>{selectedShipment.id}</b>. Setelah disimpan, status menjadi <b>Dalam Perjalanan</b>.
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {renderPabrikSummary()}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <button type="button" onClick={() => setShowPabrikConfirm(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors">Batal</button>
              <button type="button" onClick={doSubmitPlantCheck} className="px-5 py-2.5 text-sm font-bold text-[#002442] bg-[#fec330] hover:bg-[#eab308] rounded-xl shadow-sm transition-colors flex items-center gap-2"><Icon name="check" size={18} /> Ya, Selesaikan</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Serah-terima confirmation box (PIC_GUDANG: Diturunkan → Selesai) — z-[300] */}
      {showGudangConfirm && selectedShipment && createPortal(
        <div className="fixed inset-0 z-[300] bg-[#002442]/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowGudangConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 p-6 border-b border-gray-100">
              <span className="w-10 h-10 rounded-full bg-dash-secondary/20 text-dash-primary flex items-center justify-center shrink-0"><Icon name="fact_check" size={22} /></span>
              <div>
                <h3 className="text-lg font-bold text-dash-primary">Selesaikan Pengiriman?</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Catatan serah terima <b>{selectedShipment.id}</b> akan disimpan dan status berubah menjadi <b>Selesai</b>.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 p-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Plant Pengirim</span>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{catatanPlantPengirim.trim() || '-'}</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Gudang Penerima</span>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{catatanGudangPenerima.trim() || '-'}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <button type="button" onClick={() => setShowGudangConfirm(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors">Batal</button>
              <button type="button" onClick={doSubmitHandover} className="px-5 py-2.5 text-sm font-bold text-[#002442] bg-[#fec330] hover:bg-[#eab308] rounded-xl shadow-sm transition-colors flex items-center gap-2"><Icon name="check" size={18} /> Ya, Selesaikan</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
