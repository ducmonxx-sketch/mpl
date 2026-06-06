import { useState, useEffect } from 'react'
import AdminKPICard from './components/AdminKPICard'
import AdminDataTable from './components/AdminDataTable'
import AdminStatusBadge from './components/AdminStatusBadge'
import Icon from '../../components/Icon'
import { shipmentsAPI, usersAPI, fleetAPI } from '../../lib/api'

export default function OverviewSection({ onChangeNav }) {
  const [recentShipments, setRecentShipments] = useState([])
  const [kpiData, setKpiData] = useState({ activeShipments: 0, totalClients: 0, availableDrivers: 0, unassignedDrivers: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [shipmentsData, statsData] = await Promise.all([
          shipmentsAPI.list(),
          shipmentsAPI.getStats('monthly'),
        ])

        const shipments = shipmentsData.shipments || []
        setRecentShipments(shipments.slice(0, 5).map(s => ({
          id: s.id,
          client: s.client?.companyName || s.client?.fullName || '-',
          serviceType: s.serviceLevel || 'Darat',
          destinationCity: s.destinationLocation,
          status: s.status.toLowerCase() === 'transit' ? 'in_transit' : s.status.toLowerCase(),
          pickupDate: s.pickupDate ? new Date(s.pickupDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(s.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        })))

        setKpiData({
          activeShipments: statsData.transit || 0,
          totalClients: 0,
          availableDrivers: 0,
          unassignedDrivers: 0,
          pending: statsData.pending || 0,
          total: statsData.total || 0,
        })

        // Fetch users and drivers counts
        try {
          const [usersData, driversData] = await Promise.all([
            usersAPI.listAll(),
            fleetAPI.getDrivers(),
          ])
          const driversList = driversData.drivers || []
          // Driver is assigned if shipment is pending or transit
          const assignedDriverIds = new Set(
            shipments
              .filter(s => s.status === 'PENDING' || s.status === 'TRANSIT')
              .map(s => s.driverId)
              .filter(Boolean)
          )
          const unassignedCount = driversList.filter(
            d => d.status === 'ACTIVE' && !assignedDriverIds.has(d.id)
          ).length

          setKpiData(prev => ({
            ...prev,
            totalClients: (usersData.users || []).length,
            availableDrivers: driversList.filter(d => d.status === 'ACTIVE').length,
            unassignedDrivers: unassignedCount,
          }))
        } catch { /* Non-critical */ }
      } catch (err) {
        console.error('Failed to fetch overview data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const SERVICE_LABELS = { 'Darat': 'Darat', 'Laut': 'Laut', 'Udara': 'Udara' }

  const columns = [
    { key: 'id', label: 'ID Order', render: (v) => <span className="adm-table__cell-main">{v}</span> },
    { key: 'client', label: 'Klien' },
    { key: 'serviceType', label: 'Layanan', render: (v) => SERVICE_LABELS[v] || v },
    { key: 'destinationCity', label: 'Tujuan' },
    { key: 'status', label: 'Status', render: (v) => <AdminStatusBadge status={v} type="shipment" /> },
    { key: 'pickupDate', label: 'Tanggal' },
  ]

  if (loading) {
    return (
      <div className="dash-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#fec330', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '0.9rem' }}>Memuat data beranda...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Selamat Datang, Admin</h2>
          <p className="dash-header__subtitle">Ikhtisar operasional PT Mahkota Putra Logistik hari ini.</p>
        </div>
      </section>

      {/* KPI Cards */}
      <div className="adm-kpi-grid">
        <AdminKPICard icon="local_shipping" label="Pengiriman Aktif Container" sublabel="Active Container Shipments" value={String(kpiData.activeShipments)} trend={`${kpiData.unassignedDrivers} menunggu`} color="primary" delay={0.05} />
        <AdminKPICard icon="receipt" label="Total Pengiriman" sublabel="All Shipments" value={String(kpiData.total || 0)} color="gold" delay={0.1} />
        <AdminKPICard icon="people" label="Total Klien" sublabel="Total Clients" value={String(kpiData.totalClients)} color="green" delay={0.15} />
        <AdminKPICard icon="directions_car" label="Driver Tersedia" sublabel="Available Drivers" value={String(kpiData.availableDrivers)} color="primary" delay={0.2} />
      </div>

      {/* Recent Shipments */}
      <div className="adm-recent-card glass-card">
        <div className="adm-recent-header">
          <h3>Pengiriman Terbaru / Recent Shipments</h3>
          <button className="adm-view-all-btn" onClick={() => onChangeNav?.('shipments')}>
            Lihat Semua <Icon name="chevron_right" size={14} />
          </button>
        </div>
        <AdminDataTable columns={columns} data={recentShipments} />
      </div>
    </div>
  )
}
