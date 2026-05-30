import { useState, useEffect } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import { shipmentsAPI, trackingAPI } from '../../lib/api'
import TrackingSearchBar from './components/TrackingSearchBar'
import TrackingListItem from './components/TrackingListItem'

export default function TrackingSection({ initialSearchQuery = '', isAdmin = false }) {
  const { showToast } = useToast()
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [shipments, setShipments] = useState([])
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch shipments with TRANSIT status for tracking
  useEffect(() => {
    async function fetchTrackableShipments() {
      setLoading(true)
      try {
        const data = await shipmentsAPI.list({ status: 'TRANSIT' })
        const raw = data.shipments || []

        // Fetch tracking timeline for each shipment
        const enriched = await Promise.all(
          raw.map(async (s) => {
            let events = []
            try {
              const trackData = await trackingAPI.getTimeline(s.id)
              events = trackData.events || []
            } catch { /* No events yet */ }

            // Map to display format
            const statusMap = { DONE: 'done', ACTIVE: 'active', UPCOMING: 'upcoming' }
            const timeline = events.map(ev => ({
              step: ev.stepName,
              location: ev.location,
              date: new Date(ev.eventTimestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              status: statusMap[ev.status] || 'upcoming',
              note: ev.driverNotes ? `"${ev.driverNotes}"` : undefined,
            }))

            // If no events, generate default placeholder timeline
            if (timeline.length === 0) {
              timeline.push(
                { step: 'Paket Diambil', location: s.originLocation, date: s.pickupDate ? new Date(s.pickupDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-', status: 'done' },
                { step: 'Dalam Perjalanan', location: 'Menuju tujuan', date: '-', status: 'active' },
                { step: 'Pengiriman Akhir', location: s.destinationLocation, date: 'Estimasi', status: 'upcoming' },
              )
            }

            return {
              id: s.id,
              status: 'Dalam Perjalanan',
              package: s.packageType,
              service: s.serviceLevel || 'Logistik Standar - Darat',
              origin: s.originLocation,
              destination: s.destinationLocation,
              progress: s.currentProgressPercent || 0,
              timeline,
              driver: {
                name: s.driver?.fullName || '-',
                vehicle: s.vehicle ? `${s.vehicle.type} • ${s.vehicle.licensePlate}` : '-',
              },
            }
          })
        )

        setShipments(enriched)
        if (enriched.length > 0 && !selectedShipment) {
          setSelectedShipment(enriched[0])
        }
      } catch (err) {
        console.error('Failed to fetch tracking data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTrackableShipments()
  }, [])

  const filteredShipments = searchQuery
    ? shipments.filter(s =>
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.package.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : shipments

  if (loading) {
    return (
      <div className="dash-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #e2e8f0', borderTopColor: '#fec330', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '0.85rem' }}>Memuat data pelacakan...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Pelacakan Pengiriman</h2>
          <p className="dash-header__subtitle">Lacak status dan perjalanan pengiriman Anda secara real-time.</p>
        </div>
      </section>

      {/* Search Bar */}
      <TrackingSearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="track-layout">
        {/* ── Shipment List ── */}
        <div className={`track-list ${filteredShipments.length === 4 ? 'track-list--2x2' : ''}`}>
          {filteredShipments.map((s) => (
            <TrackingListItem
              key={s.id}
              shipment={s}
              isActive={selectedShipment?.id === s.id}
              onSelect={() => setSelectedShipment(selectedShipment?.id === s.id ? null : s)}
              showToast={showToast}
              isAdmin={isAdmin}
            />
          ))}
          
          {filteredShipments.length === 0 && (
            <div className="track-list__empty">
              <Icon name="search" size={32} />
              <p>{searchQuery ? `Tidak ada pengiriman ditemukan untuk "${searchQuery}"` : 'Tidak ada pengiriman dalam perjalanan saat ini.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
