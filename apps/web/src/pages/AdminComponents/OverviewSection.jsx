import { useState, useEffect } from 'react'
import AdminKPICard from './components/AdminKPICard'
import AdminDataTable from './components/AdminDataTable'
import AdminStatusBadge from './components/AdminStatusBadge'
import Icon from '../../components/Icon'
import { shipmentsAPI, usersAPI, fleetAPI } from '../../lib/api'

export default function OverviewSection({ onChangeNav, onNavigateToShipment }) {
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
    {
      key: 'id',
      label: 'ID Order',
      render: (v) => (
        <span
          className="adm-table__cell-main adm-clickable-id"
          onClick={(e) => { e.stopPropagation(); onNavigateToShipment?.(v) }}
          style={{ cursor: 'pointer', color: 'var(--dash-primary)', textDecoration: 'underline' }}
          title="Klik untuk melihat detail pengiriman"
        >
          {v}
        </span>
      ),
    },
    { key: 'client', label: 'Klien' },
    { key: 'serviceType', label: 'Layanan', render: (v) => SERVICE_LABELS[v] || v },
    { key: 'destinationCity', label: 'Tujuan' },
    { key: 'status', label: 'Status', render: (v) => <AdminStatusBadge status={v} type="shipment" /> },
    { key: 'pickupDate', label: 'Tanggal' },
  ]

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] text-gray-500">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#fec330] rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Memuat data beranda...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto w-full pb-10">
      <section className="flex flex-col gap-1">
        <h2 className="text-2xl md:text-3xl font-black text-[#002442] tracking-tight">Selamat Datang, Admin</h2>
        <p className="text-sm text-gray-500 font-medium">Ikhtisar operasional PT Mahkota Putra Logistik hari ini.</p>
      </section>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        <AdminKPICard icon="local_shipping" label="Pengiriman Aktif Container" sublabel="Active Container Shipments" value={String(kpiData.activeShipments)} trend={`${kpiData.unassignedDrivers} menunggu`} color="primary" delay={0.05} />
        <AdminKPICard icon="receipt" label="Total Pengiriman" sublabel="All Shipments" value={String(kpiData.total || 0)} color="gold" delay={0.1} />
        <AdminKPICard icon="people" label="Total Klien" sublabel="Total Clients" value={String(kpiData.totalClients)} color="green" delay={0.15} />
        <AdminKPICard icon="directions_car" label="Driver Tersedia" sublabel="Available Drivers" value={String(kpiData.availableDrivers)} color="primary" delay={0.2} />
      </div>

      {/* Recent Shipments */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 md:p-8 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-[#002442]">Pengiriman Terbaru / Recent Shipments</h3>
          <button 
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-[#002442] bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
            onClick={() => onChangeNav?.('shipments')}
          >
            Lihat Semua <Icon name="chevron_right" size={16} />
          </button>
        </div>
        <AdminDataTable columns={columns} data={recentShipments} />
      </div>
    </div>
  )
}
