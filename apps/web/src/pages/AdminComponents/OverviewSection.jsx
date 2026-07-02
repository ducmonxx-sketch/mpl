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

  useEffect(() => {
    if (!loading) {
      import('animejs').then((animeModule) => {
        const anime = animeModule.default;
        
        // Main timeline
        const tl = anime.timeline({
          easing: 'easeOutExpo'
        });

        tl.add({
          targets: '.adm-overview-header',
          translateY: [20, 0],
          opacity: [0, 1],
          duration: 800,
        })
        .add({
          targets: '.adm-recent-shipments',
          translateY: [30, 0],
          opacity: [0, 1],
          duration: 800,
        }, '-=400')
        .add({
          targets: '.adm-activity-log-card',
          translateX: [40, 0],
          opacity: [0, 1],
          duration: 800,
        }, '-=600');

        // Staggered activity log items
        anime({
          targets: '.adm-activity-log-item',
          translateY: [15, 0],
          opacity: [0, 1],
          duration: 600,
          delay: anime.stagger(150, { start: 600 }),
          easing: 'easeOutQuad'
        });
      });
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] text-gray-500">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-[#fec330] rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Memuat data beranda...</p>
      </div>
    )
  }

  const MOCK_ACTIVITIES = [
    { id: 1, admin: 'Budi Santoso', action: 'menambahkan armada baru', entity: 'Truk Tronton Hino (B 1234 CD)', time: '5 menit yang lalu', type: 'create', icon: 'add', color: 'text-green-600', bg: 'bg-green-50' },
    { id: 2, admin: 'Ani Rahmawati', action: 'mengubah status pengiriman', entity: 'INV-2023-001', time: '12 menit yang lalu', type: 'update', icon: 'edit', color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 3, admin: 'Sistem', action: 'menerbitkan invoice otomatis', entity: 'INV-2023-002', time: '45 menit yang lalu', type: 'system', icon: 'receipt_long', color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 4, admin: 'Budi Santoso', action: 'menghapus driver', entity: 'Joko Widodo', time: '2 jam yang lalu', type: 'delete', icon: 'delete', color: 'text-red-500', bg: 'bg-red-50' },
    { id: 5, admin: 'Andi Pratama', action: 'memverifikasi klien', entity: 'PT Sinar Jaya', time: 'Kemarin', type: 'verify', icon: 'verified', color: 'text-[#d49811]', bg: 'bg-[#fec330]/20' },
  ];

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto w-full pb-10">
      
      {/* Command Center Header */}
      <section className="adm-overview-header opacity-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-200 pb-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-black text-[#002442] tracking-tight">Command Center</h2>
          </div>
          <p className="text-sm text-gray-500 font-medium">Ikhtisar operasional & log aktivitas PT Mahkota Putra Logistik.</p>
        </div>
      </section>

      {/* Grid Layout: 70/30 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Pane: Vitals & Shipments (70%) */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <AdminKPICard icon="local_shipping" label="Pengiriman Aktif" sublabel="Dalam Perjalanan" value={String(kpiData.activeShipments)} trend={`${kpiData.unassignedDrivers} menunggu`} color="primary" delay={0.05} onClick={() => onChangeNav?.('tracking')} />
            <AdminKPICard icon="receipt" label="Total Pengiriman" sublabel="Semua Transaksi" value={String(kpiData.total || 0)} color="gold" delay={0.1} onClick={() => onChangeNav?.('shipments')} />
            <AdminKPICard icon="people" label="Total Klien" sublabel="Perusahaan Terdaftar" value={String(kpiData.totalClients)} color="green" delay={0.15} onClick={() => onChangeNav?.('clients')} />
            <AdminKPICard icon="directions_car" label="Driver Tersedia" sublabel="Standby" value={String(kpiData.availableDrivers)} color="primary" delay={0.2} onClick={() => onChangeNav?.('drivers')} />
          </div>

          {/* Recent Shipments */}
          <div className="adm-recent-shipments opacity-0 bg-white border border-gray-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 md:p-8 flex flex-col gap-6">
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

        {/* Right Pane: Activity Feed (30%) */}
        <div className="lg:col-span-1">
          <div className="adm-activity-log-card opacity-0 bg-white border border-gray-200 rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] p-6 md:p-8 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-[#002442] flex items-center gap-2">
                <Icon name="history" size={20} className="text-[#fec330]" />
                Log Aktivitas
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Live</span>
              </div>
            </div>

            <div className="flex flex-col gap-6 relative">
              {/* Vertical Timeline Line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-[2px] bg-gray-100 rounded-full" />
              
              {MOCK_ACTIVITIES.map((log, i) => (
                <div key={log.id} className="adm-activity-log-item opacity-0 relative z-10 flex gap-4">
                  <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${log.bg} ${log.color}`}>
                    <Icon name={log.icon} size={18} />
                  </div>
                  <div className="flex flex-col pt-1">
                    <p className="text-sm text-gray-700 leading-snug">
                      <span className="font-bold text-[#002442]">{log.admin}</span> {log.action} <span className="font-bold text-[#002442]">{log.entity}</span>
                    </p>
                    <span className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-wider">{log.time}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="mt-8 w-full py-3 border border-dashed border-gray-300 rounded-xl text-sm font-bold text-gray-500 hover:text-[#002442] hover:bg-gray-50 hover:border-gray-400 transition-all">
              Muat Lebih Banyak
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
