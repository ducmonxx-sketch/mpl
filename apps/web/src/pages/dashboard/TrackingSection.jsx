import { useState, useEffect, useCallback } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import { shipmentsAPI, trackingAPI } from '../../lib/api'
import TrackingSearchBar from './components/TrackingSearchBar'
import TrackingListItem from './components/TrackingListItem'
import { compressImage } from '../../lib/imageCompressor'

const statusDisplayMap = {
  PENDING: 'Menunggu',
  TRANSIT: 'Dalam Perjalanan',
  DELIVERED: 'Terkirim',
  FAILED: 'Gagal',
  CANCELLED: 'Dibatalkan',
}

const statusColorClasses = {
  PENDING: 'bg-amber-50 text-amber-600 border-amber-200',
  TRANSIT: 'bg-blue-50 text-blue-600 border-blue-200',
  DELIVERED: 'bg-green-50 text-green-600 border-green-200',
  FAILED: 'bg-red-50 text-red-600 border-red-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
}

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'TRANSIT', label: 'Dalam Perjalanan' },
  { value: 'DELIVERED', label: 'Terkirim' },
  { value: 'FAILED', label: 'Gagal' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
]

const FILTER_TABS = [
  { value: 'all', label: 'Semua' },
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'TRANSIT', label: 'Dalam Perjalanan' },
  { value: 'DELIVERED', label: 'Terkirim' },
  { value: 'FAILED', label: 'Gagal' },
]

const EVENT_STATUS_OPTIONS = [
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DONE', label: 'Done' },
]

const EMPTY_ADD_EVENT_FORM = {
  stepName: '',
  location: '',
  eventTimestamp: '',
  driverNotes: '',
  status: 'ACTIVE',
}

export default function TrackingSection({ initialSearchQuery = '', isAdmin = false }) {
  const { showToast } = useToast()

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [shipments, setShipments] = useState([])
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [addEventForm, setAddEventForm] = useState(EMPTY_ADD_EVENT_FORM)
  const [showAddEventModal, setShowAddEventModal] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const [tempStatus, setTempStatus] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [compressing, setCompressing] = useState(false)
  const [tempEta, setTempEta] = useState('')

  const [timelineData, setTimelineData] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  useEffect(() => {
    if (selectedShipment) {
      setTempStatus(selectedShipment.rawStatus)
      setPhotoPreview(selectedShipment.proofPhoto)
      // Initialize ETA picker from raw shipment data
      setTempEta(selectedShipment.rawEstimatedArrival || '')

      const fetchTimeline = async () => {
        setTimelineLoading(true)
        try {
          const tRes = await trackingAPI.getTimeline(selectedShipment.id)
          const events = Array.isArray(tRes) ? tRes : (tRes?.data || tRes?.events || [])
          setTimelineData(
            events.map((e) => ({
              id: e.id,
              stepName: e.stepName || e.step_name || '',
              location: e.location || '',
              eventTimestamp: e.eventTimestamp || e.event_timestamp || e.timestamp || '',
              status: e.status || '',
              driverNotes: e.driverNotes || e.driver_notes || '',
            }))
          )
        } catch {
          setTimelineData([])
        } finally {
          setTimelineLoading(false)
        }
      }
      fetchTimeline()
    } else {
      setTempStatus('')
      setPhotoPreview(null)
      setTempEta('')
      setTimelineData([])
    }
  }, [selectedShipment])

  const fetchShipments = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const res = await shipmentsAPI.list()
      const raw = Array.isArray(res) ? res : (res?.data || res?.shipments || [])

      const mapped = raw.map((s) => {
        const estimatedArrivalRaw = s.estimatedArrival || s.estimated_arrival
        const estimatedArrival = estimatedArrivalRaw
          ? new Date(estimatedArrivalRaw).toLocaleString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '-'

        return {
          id: s.id,
          client: s.client?.companyName || s.client?.fullName || '-',
          rawStatus: s.status,
          status: statusDisplayMap[s.status] || s.status,
          package: s.packageType || s.package_type || '-',
          service: s.serviceLevel || s.service_level || 'Logistik Standar',
          origin: s.originLocation || s.origin_location || '-',
          destination: s.destinationLocation || s.destination_location || '-',
          progress: s.currentProgressPercent ?? s.current_progress_percent ?? 0,
          estimatedArrival,
          rawEstimatedArrival: estimatedArrivalRaw ? new Date(estimatedArrivalRaw).toISOString().slice(0, 16) : '',
          weightKg: s.weightKg || null,
          units: s.units || null,
          price: s.price ? Number(s.price) : null,
          notes: s.specialNotes || s.special_notes || null,
          proofPhoto: s.proofPhoto || null,
          driver: {
            name: s.driver?.fullName || s.driver?.full_name || '-',
            vehicle: s.vehicle
              ? `${s.vehicle.type || ''} • ${s.vehicle.licensePlate || s.vehicle.license_plate || ''}`.trim()
              : '-',
          },
        }
      })

      setShipments(mapped)

      if (initialSearchQuery) {
        const match = mapped.find(
          (sh) =>
            sh.id?.toString().toLowerCase().includes(initialSearchQuery.toLowerCase()) ||
            (sh.package || '').toLowerCase().includes(initialSearchQuery.toLowerCase())
        )
        // Set without timeline; another useEffect will fetch it
        if (match) setSelectedShipment(match)
      }
    } catch (err) {
      showToast(err.message || 'Gagal memuat data pengiriman', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [initialSearchQuery, showToast])

  useEffect(() => {
    fetchShipments()
    const interval = setInterval(() => fetchShipments({ silent: true }), 8000)
    return () => clearInterval(interval)
  }, [fetchShipments])

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



  const handleUpdateStatus = async (newStatus) => {
    if (!selectedShipment) return
    setUpdatingStatus(true)
    try {
      await shipmentsAPI.updateStatus(selectedShipment.id, { status: newStatus })
      showToast('Status diperbarui!', 'success')
      await fetchShipments()
      // Re-select updated shipment
      setSelectedShipment((prev) =>
        prev ? { ...prev, rawStatus: newStatus, status: statusDisplayMap[newStatus] || newStatus } : prev
      )
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui status', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleStatusSelectChange = async (newStatus) => {
    if (!selectedShipment) return
    setTempStatus(newStatus)
    if (newStatus !== 'DELIVERED') {
      setUpdatingStatus(true)
      try {
        await shipmentsAPI.updateStatus(selectedShipment.id, {
          status: newStatus,
          proofPhoto: null
        })
        showToast('Status diperbarui!', 'success')
        await fetchShipments()
        setSelectedShipment((prev) =>
          prev ? { ...prev, rawStatus: newStatus, status: statusDisplayMap[newStatus] || newStatus, proofPhoto: null } : prev
        )
      } catch (err) {
        showToast(err.message || 'Gagal memperbarui status', 'error')
        setTempStatus(selectedShipment.rawStatus)
      } finally {
        setUpdatingStatus(false)
      }
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCompressing(true)
    try {
      const compressedBase64 = await compressImage(file, 2)
      setPhotoPreview(compressedBase64)
      showToast('Gambar berhasil dikompresi!', 'success')
    } catch (err) {
      showToast('Gagal mengompresi gambar', 'error')
      console.error(err)
    } finally {
      setCompressing(false)
    }
  }

  const handleSaveDeliveredStatus = async () => {
    if (!selectedShipment) return
    setUpdatingStatus(true)
    try {
      await shipmentsAPI.updateStatus(selectedShipment.id, {
        status: 'DELIVERED',
        currentProgressPercent: 100,
        proofPhoto: photoPreview,
      })
      showToast('Status diperbarui menjadi Terkirim!', 'success')
      await fetchShipments()
      setSelectedShipment((prev) =>
        prev
          ? {
              ...prev,
              rawStatus: 'DELIVERED',
              status: statusDisplayMap['DELIVERED'],
              progress: 100,
              proofPhoto: photoPreview,
            }
          : prev
      )
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui status', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleUpdateEta = async () => {
    if (!selectedShipment || !tempEta) return
    setUpdatingStatus(true)
    try {
      await shipmentsAPI.updateStatus(selectedShipment.id, {
        status: selectedShipment.rawStatus,
        estimatedArrival: new Date(tempEta).toISOString(),
      })
      showToast('Estimasi tiba diperbarui!', 'success')
      await fetchShipments()
      setSelectedShipment((prev) =>
        prev ? { ...prev, estimatedArrival: new Date(tempEta).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), rawEstimatedArrival: tempEta } : prev
      )
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui ETA', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleAddEvent = async (e) => {
    e.preventDefault()
    if (!selectedShipment) return
    try {
      await trackingAPI.addEvent(selectedShipment.id, {
        ...addEventForm,
        eventTimestamp: addEventForm.eventTimestamp || new Date().toISOString(),
      })
      showToast('Checkpoint ditambahkan!', 'success')
      setShowAddEventModal(false)
      setAddEventForm(EMPTY_ADD_EVENT_FORM)
      await fetchShipments()
    } catch (err) {
      showToast(err.message || 'Gagal menambahkan checkpoint', 'error')
    }
  }

  const handleEventFormChange = (field, value) => {
    setAddEventForm((prev) => ({ ...prev, [field]: value }))
  }

  const filteredShipments = shipments.filter((sh) => {
    const matchesStatus = statusFilter === 'all' || sh.rawStatus === statusFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q ||
      (sh.id?.toString().toLowerCase().includes(q)) ||
      (sh.package?.toLowerCase().includes(q))
    return matchesStatus && matchesSearch
  })

  const countForTab = (tabValue) => {
    if (tabValue === 'all') return shipments.length
    return shipments.filter((sh) => sh.rawStatus === tabValue).length
  }

  const handleSelectShipment = (sh) => {
    setSelectedShipment((prev) => (prev?.id === sh.id ? null : sh))
    setShowAddEventModal(false)
    setAddEventForm(EMPTY_ADD_EVENT_FORM)
  }

  const handleCloseDetail = () => {
    setSelectedShipment(null)
    setShowAddEventModal(false)
    setAddEventForm(EMPTY_ADD_EVENT_FORM)
  }

  const badgeClasses = selectedShipment
    ? (statusColorClasses[selectedShipment.rawStatus] || 'bg-gray-100 text-gray-700 border-gray-200')
    : ''

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl md:text-3xl font-black text-[#002442] tracking-tight">Pelacakan Pengiriman</h2>
          <p className="text-sm text-gray-500 font-medium">Pantau status dan posisi semua pengiriman secara real-time</p>
        </div>
      </section>

      {/* Admin Filter Tabs */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-px mt-2">
          {FILTER_TABS.map((tab) => {
            const isActive = statusFilter === tab.value
            return (
              <button
                key={tab.value}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${isActive ? 'border-[#002442] text-[#002442]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-[#002442]/10 text-[#002442]' : 'bg-gray-100 text-gray-500'}`}>
                  {countForTab(tab.value)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Search Bar */}
      <TrackingSearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-3 border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
           <Icon name="sync" size={32} className="animate-spin" />
           <p className="text-sm font-medium">Memuat data pelacakan...</p>
        </div>
      ) : (
        <>
          {/* Shipment List */}
          <div className="flex flex-col gap-3">
            {filteredShipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-3 border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                <Icon name="package" size={40} />
                <p className="text-sm font-medium">Tidak ada pengiriman ditemukan</p>
              </div>
            ) : (
              filteredShipments.map((sh, idx) => (
                <TrackingListItem
                  key={sh.id}
                  index={idx}
                  shipment={sh}
                  isSelected={selectedShipment?.id === sh.id}
                  onClick={() => handleSelectShipment(sh)}
                />
              ))
            )}
          </div>

          {/* ── Slide-over Detail Panel ── */}
          {selectedShipment && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-[#002442]/30 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-300" 
                onClick={handleCloseDetail}
              />
              
              {/* Panel */}
              <div className="adm-detail-panel opacity-0 fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-100">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-black text-[#002442]">
                        {selectedShipment.id.startsWith('#') ? selectedShipment.id : `#${selectedShipment.id}`}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeClasses}`}>
                        {selectedShipment.status}
                      </span>
                    </div>
                  </div>
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm"
                    onClick={handleCloseDetail}
                    title="Tutup"
                  >
                    <Icon name="close" size={18} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-8">
                  
                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Klien</span>
                      <span className="text-sm font-bold text-gray-900">{selectedShipment.client}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Estimasi Tiba</span>
                      <span className="text-sm font-bold text-gray-900">{selectedShipment.estimatedArrival}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Asal</span>
                      <span className="text-sm font-medium text-gray-900">{selectedShipment.origin}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Tujuan</span>
                      <span className="text-sm font-medium text-gray-900">{selectedShipment.destination}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Muatan</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedShipment.package}
                        {selectedShipment.weightKg ? ` (${selectedShipment.weightKg} kg)` : ''}
                        {selectedShipment.units ? ` • ${selectedShipment.units} units` : ''}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Kendaraan</span>
                      <span className="text-sm font-medium text-gray-900">{selectedShipment.driver.vehicle}</span>
                    </div>
                  </div>

                  {selectedShipment.notes && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs font-bold text-amber-800 italic">
                        Catatan: &ldquo;{selectedShipment.notes}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Timeline (Stepped Progress) */}
                  <div className="flex flex-col gap-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                      <Icon name="route" size={18} className="text-gray-400" /> Riwayat Perjalanan
                    </h4>
                    
                    {timelineLoading ? (
                      <div className="flex justify-center p-4">
                        <Icon name="sync" size={24} className="animate-spin text-gray-400" />
                      </div>
                    ) : timelineData.length === 0 ? (
                      <p className="text-sm text-gray-500 italic text-center p-4">Belum ada riwayat perjalanan.</p>
                    ) : (
                      <div className="relative pl-4 mt-2 border-l-2 border-gray-100 flex flex-col gap-6">
                        {timelineData.map((ev, idx) => {
                          const isDone = ev.status === 'DONE'
                          const isActive = ev.status === 'ACTIVE'
                          
                          return (
                            <div 
                              key={ev.id || idx} 
                              className="relative animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                              style={{ animationDelay: `${idx * 100}ms` }}
                            >
                              {/* Timeline Dot */}
                              <div className={`absolute -left-[25px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 ${
                                isDone ? 'bg-green-500 border-green-500' : 
                                isActive ? 'bg-amber-400 border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 
                                'bg-white border-gray-300'
                              }`} />
                              
                              <div className={`flex flex-col ${!isDone && !isActive ? 'opacity-50' : ''}`}>
                                <span className={`text-sm font-bold ${isDone ? 'text-gray-900' : isActive ? 'text-amber-600' : 'text-gray-500'}`}>
                                  {ev.stepName}
                                </span>
                                <span className="text-xs text-gray-500">{ev.location}</span>
                                {ev.eventTimestamp && (
                                  <span className="text-xs text-gray-400 mt-1">
                                    {new Date(ev.eventTimestamp).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                                {ev.driverNotes && (
                                  <p className="text-xs italic text-gray-500 mt-1 bg-gray-50 p-2 rounded-md">
                                    {ev.driverNotes}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Bukti Pengiriman */}
                  {selectedShipment.proofPhoto && (
                    <div className="flex flex-col gap-3">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                        <Icon name="image" size={18} className="text-gray-400" /> Bukti Pengiriman
                      </h4>
                      <img
                        src={selectedShipment.proofPhoto}
                        alt="Bukti"
                        className="w-full max-h-64 object-contain bg-gray-100 rounded-xl border border-gray-200"
                      />
                    </div>
                  )}
                  
                  {/* Admin Controls */}
                  {isAdmin && (
                    <div className="mt-auto pt-6 border-t border-gray-100 flex flex-col gap-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Admin Controls</h4>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {/* Ubah Status */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-gray-700">Ubah Status</label>
                          <select
                            value={tempStatus}
                            onChange={(e) => handleStatusSelectChange(e.target.value)}
                            disabled={updatingStatus}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Update ETA */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-gray-700">Estimasi Tiba (ETA)</label>
                          <div className="flex gap-2">
                            <input
                              type="datetime-local"
                              value={tempEta}
                              onChange={(e) => setTempEta(e.target.value)}
                              disabled={updatingStatus}
                              className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-xs focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none"
                            />
                            <button
                              className="px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                              onClick={handleUpdateEta}
                              disabled={updatingStatus || !tempEta}
                              title="Simpan ETA"
                            >
                              <Icon name="save" size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border-2 border-[#002442] hover:bg-[#002442] hover:text-white text-[#002442] font-bold rounded-xl transition-all"
                        onClick={() => setShowAddEventModal(true)}
                      >
                        <Icon name="add_location" size={18} /> Tambah Checkpoint Baru
                      </button>

                      {/* Delivered Status Input */}
                      {tempStatus === 'DELIVERED' && (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-col gap-3">
                          <label className="text-xs font-bold text-gray-700">Upload Bukti Foto Pengiriman</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            disabled={updatingStatus || compressing}
                            className="text-xs"
                          />
                          {compressing && <span className="text-xs text-amber-600">Mengompresi gambar...</span>}
                          {photoPreview && (
                            <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setPhotoPreview(null)}
                                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                              >
                                ×
                              </button>
                            </div>
                          )}
                          <button
                            onClick={handleSaveDeliveredStatus}
                            disabled={updatingStatus || compressing}
                            className="w-full mt-2 flex items-center justify-center px-4 py-2 bg-[#fec330] hover:bg-[#eab308] text-[#002442] font-bold rounded-xl transition-all shadow-sm"
                          >
                            {updatingStatus ? 'Menyimpan...' : 'Simpan & Selesaikan Pengiriman'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </>
          )}

          {/* Add Event Modal (Overlay) */}
          {isAdmin && showAddEventModal && (
            <div className="fixed inset-0 bg-[#002442]/30 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                  <h3 className="font-black text-[#002442] text-lg">Tambah Checkpoint</h3>
                  <button onClick={() => setShowAddEventModal(false)} className="text-gray-400 hover:text-red-500">
                    <Icon name="close" size={20} />
                  </button>
                </div>
                
                <form onSubmit={handleAddEvent} className="p-6 flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Nama Step <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Paket diterima di gudang"
                      value={addEventForm.stepName}
                      onChange={(e) => handleEventFormChange('stepName', e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Lokasi <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Jakarta Selatan"
                      value={addEventForm.location}
                      onChange={(e) => handleEventFormChange('location', e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Waktu Event <span className="text-red-500">*</span></label>
                    <input
                      type="datetime-local"
                      required
                      value={addEventForm.eventTimestamp}
                      onChange={(e) => handleEventFormChange('eventTimestamp', e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Status</label>
                    <select
                      value={addEventForm.status}
                      onChange={(e) => handleEventFormChange('status', e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white"
                    >
                      {EVENT_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Catatan Driver</label>
                    <textarea
                      rows={2}
                      placeholder="Catatan tambahan (opsional)"
                      value={addEventForm.driverNotes}
                      onChange={(e) => handleEventFormChange('driverNotes', e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] outline-none transition-all bg-gray-50 hover:bg-white focus:bg-white custom-scrollbar"
                    />
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2">
                    <button
                      type="button"
                      className="flex-1 px-4 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                      onClick={() => {
                        setShowAddEventModal(false)
                        setAddEventForm(EMPTY_ADD_EVENT_FORM)
                      }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-[#002442] hover:bg-[#003057] shadow-sm transition-all hover:shadow"
                    >
                      Simpan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
