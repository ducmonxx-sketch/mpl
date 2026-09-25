import { useState, useEffect, useMemo } from 'react'
import Icon from '../../components/Icon'
import { shipmentsAPI } from '../../lib/api'
import ShipmentFilters from './components/ShipmentFilters'
import ShipmentCard from './components/ShipmentCard'
import { SHIPMENT_STATUS_CONFIG, getStatusBucket } from './shipmentStatus'
import { CardListSkeleton } from '../../components/Skeleton'

// Labels for the empty-state message — bucket keys from the quick filters plus every
// granular status key (reachable via the "Lainnya" dropdown).
const FILTER_LABELS = {
  all: 'Semua',
  active: 'Aktif',
  done: 'Selesai',
  cancelled: 'Dibatalkan',
  ...Object.fromEntries(Object.entries(SHIPMENT_STATUS_CONFIG).map(([key, cfg]) => [key, cfg.label])),
}

export default function ShipmentsSection({ onCreateShipment, highlightId }) {
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)

  // A search/notification jump lands here with a specific shipment to open — force the
  // "Semua" tab so it's guaranteed to be in view regardless of the previously active
  // filter, then expand + scroll to it once the list has rendered.
  useEffect(() => {
    if (!highlightId) return
    setFilter('all')
    setExpandedId(highlightId)
  }, [highlightId])

  useEffect(() => {
    if (!highlightId || loading) return
    const el = document.getElementById(`ship-card-${highlightId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, loading])

  // Single fetch — filtering by status happens client-side below, so tab switches
  // are instant and filter-tab counts always reflect the full list (previously this
  // fetched twice: once server-filtered for the list, once unfiltered for counts).
  useEffect(() => {
    async function fetchShipments() {
      setLoading(true)
      try {
        const data = await shipmentsAPI.list()
        setShipments(data.shipments || [])
      } catch (err) {
        console.error('Failed to fetch shipments:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchShipments()
  }, [])

  // Map API shipments to display format
  const allDisplayShipments = useMemo(() => shipments.map(s => ({
    id: s.id,
    desc: s.packageType,
    origin: s.originLocation,
    dest: s.destinationLocation,
    status: s.status.toLowerCase(),
    date: new Date(s.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    service: s.serviceLevel || 'Darat',
    weight: `${s.weightKg} kg`,
    progress: s.currentProgressPercent || 0,
  })), [shipments])

  const displayShipments = filter === 'all'
    ? allDisplayShipments
    : ['active', 'done', 'cancelled'].includes(filter)
      ? allDisplayShipments.filter(s => getStatusBucket(s.status) === filter)
      : allDisplayShipments.filter(s => s.status === filter)

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Daftar Pengiriman</h2>
          <p className="dash-header__subtitle">Kelola dan pantau semua pengiriman Anda.</p>
        </div>
        {false && (
          <button className="ship-create-btn" onClick={onCreateShipment}>
            <Icon name="add" size={18} />
            <span>Buat Pengiriman</span>
          </button>
        )}
      </section>

      {/* Filter Tabs */}
      <ShipmentFilters
        filter={filter}
        onFilterChange={setFilter}
        shipments={allDisplayShipments}
      />

      {/* Loading state */}
      {loading ? (
        <CardListSkeleton count={3} />
      ) : (
        /* Shipment Cards */
        <div className="ship-list">
          {displayShipments.length === 0 ? (
            <div className="flex flex-col items-center text-center py-16 px-6 bg-white border border-dashed border-gray-200 rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-300 flex items-center justify-center mb-4">
                <Icon name="inventory_2" size={28} />
              </div>
              <p className="text-sm font-bold text-gray-600">
                {filter === 'all' ? 'Belum ada pengiriman.' : `Tidak ada pengiriman dengan status "${FILTER_LABELS[filter]}".`}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {filter === 'all' ? 'Pengiriman baru akan muncul di sini.' : 'Coba pilih filter status lain.'}
              </p>
            </div>
          ) : (
            displayShipments.map((s) => (
              <ShipmentCard
                key={s.id}
                shipment={s}
                isExpanded={expandedId === s.id}
                onToggleExpand={() => setExpandedId(expandedId === s.id ? null : s.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
