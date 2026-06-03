import { useState, useEffect, useCallback } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import { shipmentsAPI, trackingAPI } from '../../lib/api'
import TrackingSearchBar from './components/TrackingSearchBar'
import TrackingListItem from './components/TrackingListItem'

const statusDisplayMap = {
  PENDING: 'Menunggu',
  TRANSIT: 'Dalam Perjalanan',
  DELIVERED: 'Terkirim',
  FAILED: 'Gagal',
  CANCELLED: 'Dibatalkan',
}

const statusColorMap = {
  PENDING: { background: '#fff8e1', color: '#f59e0b', border: '1px solid #fcd34d' },
  TRANSIT: { background: '#eff6ff', color: '#3b82f6', border: '1px solid #93c5fd' },
  DELIVERED: { background: '#f0fdf4', color: '#22c55e', border: '1px solid #86efac' },
  FAILED: { background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5' },
  CANCELLED: { background: '#f9fafb', color: '#6b7280', border: '1px solid #d1d5db' },
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

  const fetchShipments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await shipmentsAPI.list()
      const raw = Array.isArray(res) ? res : (res?.data || res?.shipments || [])

      const mapped = await Promise.all(
        raw.map(async (s) => {
          let timeline = []
          try {
            const tRes = await trackingAPI.getTimeline(s.id)
            const events = Array.isArray(tRes) ? tRes : (tRes?.data || tRes?.events || [])
            timeline = events.map((e) => ({
              id: e.id,
              stepName: e.stepName || e.step_name || '',
              location: e.location || '',
              eventTimestamp: e.eventTimestamp || e.event_timestamp || e.timestamp || '',
              status: e.status || '',
              driverNotes: e.driverNotes || e.driver_notes || '',
            }))
          } catch {
            // timeline stays empty if fetch fails
          }

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
            rawStatus: s.status,
            status: statusDisplayMap[s.status] || s.status,
            package: s.packageType || s.package_type || '-',
            service: s.serviceLevel || s.service_level || 'Logistik Standar',
            origin: s.originLocation || s.origin_location || '-',
            destination: s.destinationLocation || s.destination_location || '-',
            progress: s.currentProgressPercent ?? s.current_progress_percent ?? 0,
            estimatedArrival,
            timeline,
            driver: {
              name: s.driver?.fullName || s.driver?.full_name || '-',
              vehicle: s.vehicle
                ? `${s.vehicle.type || ''} • ${s.vehicle.licensePlate || s.vehicle.license_plate || ''}`.trim()
                : '-',
            },
          }
        })
      )

      setShipments(mapped)

      if (initialSearchQuery) {
        const match = mapped.find(
          (sh) =>
            sh.id?.toString().toLowerCase().includes(initialSearchQuery.toLowerCase()) ||
            (sh.package || '').toLowerCase().includes(initialSearchQuery.toLowerCase())
        )
        if (match) setSelectedShipment(match)
      }
    } catch (err) {
      showToast(err.message || 'Gagal memuat data pengiriman', 'error')
    } finally {
      setLoading(false)
    }
  }, [initialSearchQuery, showToast])

  useEffect(() => {
    fetchShipments()
  }, [fetchShipments])

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

  const badgeStyle = selectedShipment
    ? {
        ...(statusColorMap[selectedShipment.rawStatus] || {}),
        padding: '2px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 600,
        display: 'inline-block',
      }
    : {}

  return (
    <div className="dash-content">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h2 className="dash-header__title">Pelacakan Pengiriman</h2>
          <p className="dash-header__subtitle">
            Pantau status dan posisi semua pengiriman secara real-time
          </p>
        </div>
      </div>

      {/* Admin Filter Tabs */}
      {isAdmin && (
        <div className="adm-filters">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              className={`adm-filter-tab${statusFilter === tab.value ? ' adm-filter-tab--active' : ''}`}
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
              <span className="adm-filter-count">{countForTab(tab.value)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <TrackingSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
      />

      {/* Loading State */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Shipment List */}
          <div className="track-layout">
            {filteredShipments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted, #6b7280)' }}>
                <Icon name="package" size={40} />
                <p style={{ marginTop: '12px', fontSize: '15px' }}>Tidak ada pengiriman ditemukan</p>
              </div>
            ) : (
              filteredShipments.map((sh) => (
                <TrackingListItem
                  key={sh.id}
                  shipment={sh}
                  isSelected={selectedShipment?.id === sh.id}
                  onClick={() => handleSelectShipment(sh)}
                />
              ))
            )}
          </div>

          {/* Detail Panel */}
          {selectedShipment && (
            <div className="adm-detail-panel glass-card" style={{ marginTop: '24px' }}>
              {/* Panel Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                    #{selectedShipment.id}
                  </h3>
                  <span style={badgeStyle}>{selectedShipment.status}</span>
                </div>
                <button
                  className="adm-action-btn"
                  onClick={handleCloseDetail}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                  title="Tutup"
                >
                  <Icon name="x" size={18} />
                </button>
              </div>

              {/* Detail Grid */}
              <div className="adm-detail-grid">
                <div className="adm-detail-row">
                  <span className="adm-detail-label">Estimasi Tiba</span>
                  <span className="adm-detail-value">{selectedShipment.estimatedArrival}</span>
                </div>
                <div className="adm-detail-row">
                  <span className="adm-detail-label">Asal</span>
                  <span className="adm-detail-value">{selectedShipment.origin}</span>
                </div>
                <div className="adm-detail-row">
                  <span className="adm-detail-label">Tujuan</span>
                  <span className="adm-detail-value">{selectedShipment.destination}</span>
                </div>
                <div className="adm-detail-row">
                  <span className="adm-detail-label">Driver</span>
                  <span className="adm-detail-value">{selectedShipment.driver.name}</span>
                </div>
                <div className="adm-detail-row">
                  <span className="adm-detail-label">Kendaraan</span>
                  <span className="adm-detail-value">{selectedShipment.driver.vehicle}</span>
                </div>
                <div className="adm-detail-row">
                  <span className="adm-detail-label">Progress</span>
                  <span className="adm-detail-value">{selectedShipment.progress}%</span>
                </div>
              </div>

              {/* Timeline */}
              {selectedShipment.timeline && selectedShipment.timeline.length > 0 && (
                <div className="adm-detail-section" style={{ marginTop: '20px' }}>
                  <div className="adm-detail-section__title">Riwayat Perjalanan</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {selectedShipment.timeline.map((ev, idx) => (
                      <li
                        key={ev.id || idx}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          padding: '10px 0',
                          borderBottom: idx < selectedShipment.timeline.length - 1 ? '1px solid var(--border-color, #e5e7eb)' : 'none',
                        }}
                      >
                        <div style={{ marginTop: '3px' }}>
                          <Icon
                            name={ev.status === 'DONE' ? 'check-circle' : ev.status === 'ACTIVE' ? 'loader' : 'circle'}
                            size={16}
                          />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{ev.stepName}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted, #6b7280)' }}>
                            {ev.location}
                            {ev.eventTimestamp
                              ? ` · ${new Date(ev.eventTimestamp).toLocaleString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}`
                              : ''}
                          </div>
                          {ev.driverNotes && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted, #6b7280)', fontStyle: 'italic', marginTop: '2px' }}>
                              {ev.driverNotes}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Admin Controls */}
              {isAdmin && (
                <div className="adm-detail-section" style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted, #6b7280)' }}>
                      Ubah Status:
                    </label>
                    <select
                      value={selectedShipment.rawStatus}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      disabled={updatingStatus}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color, #d1d5db)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        background: 'var(--bg-card, #fff)',
                      }}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {updatingStatus && <Icon name="loader" size={16} />}
                  </div>

                  <button
                    className="adm-create-btn"
                    onClick={() => setShowAddEventModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Icon name="plus" size={16} />
                    Tambah Checkpoint
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Add Event Modal */}
          {isAdmin && showAddEventModal && (
            <div className="adm-modal-overlay">
              <div className="adm-modal">
                <div className="adm-modal__header">
                  <h3 className="adm-modal__title">Tambah Checkpoint</h3>
                </div>
                <form onSubmit={handleAddEvent}>
                  <div className="adm-modal__body">
                    <div className="adm-form-grid">
                      {/* Nama Step */}
                      <div className="adm-form-field adm-form-field--full">
                        <label className="adm-form-field__label">
                          Nama Step <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Paket diterima di gudang"
                          value={addEventForm.stepName}
                          onChange={(e) => handleEventFormChange('stepName', e.target.value)}
                        />
                      </div>

                      {/* Lokasi */}
                      <div className="adm-form-field">
                        <label className="adm-form-field__label">
                          Lokasi <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Jakarta Selatan"
                          value={addEventForm.location}
                          onChange={(e) => handleEventFormChange('location', e.target.value)}
                        />
                      </div>

                      {/* Waktu Event */}
                      <div className="adm-form-field">
                        <label className="adm-form-field__label">
                          Waktu Event <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={addEventForm.eventTimestamp}
                          onChange={(e) => handleEventFormChange('eventTimestamp', e.target.value)}
                        />
                      </div>

                      {/* Status */}
                      <div className="adm-form-field">
                        <label className="adm-form-field__label">Status</label>
                        <select
                          value={addEventForm.status}
                          onChange={(e) => handleEventFormChange('status', e.target.value)}
                        >
                          {EVENT_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Catatan Driver */}
                      <div className="adm-form-field adm-form-field--full">
                        <label className="adm-form-field__label">Catatan Driver</label>
                        <textarea
                          rows={3}
                          placeholder="Opsional — catatan tambahan dari driver"
                          value={addEventForm.driverNotes}
                          onChange={(e) => handleEventFormChange('driverNotes', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="adm-modal__footer">
                    <button
                      type="button"
                      className="adm-modal__btn adm-modal__btn--cancel"
                      onClick={() => {
                        setShowAddEventModal(false)
                        setAddEventForm(EMPTY_ADD_EVENT_FORM)
                      }}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="adm-modal__btn adm-modal__btn--submit"
                    >
                      Simpan Checkpoint
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
