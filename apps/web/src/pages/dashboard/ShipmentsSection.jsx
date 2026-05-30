import { useState, useEffect } from 'react'
import Icon from '../../components/Icon'
import { shipmentsAPI } from '../../lib/api'
import ShipmentFilters from './components/ShipmentFilters'
import ShipmentCard from './components/ShipmentCard'

const STATUS_MAP = {
  all: 'Semua',
  TRANSIT: 'Dalam Perjalanan',
  DELIVERED: 'Terkirim',
  FAILED: 'Gagal',
  PENDING: 'Menunggu',
}

export default function ShipmentsSection({ onCreateShipment, onChangeNav, onTrackFull }) {
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchShipments() {
      setLoading(true)
      try {
        const params = filter !== 'all' ? { status: filter } : {}
        const data = await shipmentsAPI.list(params)
        setShipments(data.shipments || [])
      } catch (err) {
        console.error('Failed to fetch shipments:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchShipments()
  }, [filter])

  // Map API shipments to display format
  const displayShipments = shipments.map(s => ({
    id: s.id,
    desc: s.packageType,
    origin: s.originLocation,
    dest: s.destinationLocation,
    status: s.status.toLowerCase(),
    date: new Date(s.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    service: s.serviceLevel || 'Darat',
    weight: `${s.weightKg} kg`,
    progress: s.currentProgressPercent || 0,
  }))

  // For counting badges on filter tabs, use all shipments
  const [allShipments, setAllShipments] = useState([])
  useEffect(() => {
    async function fetchAll() {
      try {
        const data = await shipmentsAPI.list()
        setAllShipments(data.shipments || [])
      } catch { /* silently fail */ }
    }
    fetchAll()
  }, [])

  const allDisplayShipments = allShipments.map(s => ({
    ...s,
    status: s.status.toLowerCase(),
  }))

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Daftar Pengiriman</h2>
          <p className="dash-header__subtitle">Kelola dan pantau semua pengiriman Anda.</p>
        </div>
        <button className="ship-create-btn" onClick={onCreateShipment}>
          <Icon name="add" size={18} />
          <span>Buat Pengiriman</span>
        </button>
      </section>

      {/* Filter Tabs */}
      <ShipmentFilters
        filter={filter === 'all' ? 'all' : filter.toLowerCase()}
        onFilterChange={(f) => setFilter(f === 'all' ? 'all' : f.toUpperCase())}
        statusMap={{ all: 'Semua', transit: 'Dalam Perjalanan', delivered: 'Terkirim', failed: 'Gagal', pending: 'Menunggu' }}
        shipments={allDisplayShipments}
      />

      {/* Loading state */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: '#64748b' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 28, height: 28, border: '3px solid #e2e8f0', borderTopColor: '#fec330', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
            <p style={{ fontSize: '0.85rem' }}>Memuat pengiriman...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        </div>
      ) : (
        /* Shipment Cards */
        <div className="ship-list">
          {displayShipments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <Icon name="inventory_2" size={48} />
              <p style={{ marginTop: '1rem', fontWeight: 600 }}>Belum ada pengiriman.</p>
            </div>
          ) : (
            displayShipments.map((s) => (
              <ShipmentCard
                key={s.id}
                shipment={s}
                isExpanded={expandedId === s.id}
                onToggleExpand={() => setExpandedId(expandedId === s.id ? null : s.id)}
                onChangeNav={onChangeNav}
                onTrackFull={onTrackFull}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
