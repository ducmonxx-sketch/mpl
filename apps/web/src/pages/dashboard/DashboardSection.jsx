import { useState, useEffect, useMemo, useRef } from 'react'
import Icon from '../../components/Icon'
import KPICard from '../../components/KPICard'
import ShipmentConditionChart from '../../components/charts/ShipmentConditionChart'
import { useToast } from '../../contexts/ToastContext'
import { shipmentsAPI } from '../../lib/api'
import * as XLSX from 'xlsx'
import RecentHistory from './components/RecentHistory'
import { KPISkeletonRow, ChartSkeleton, ListSkeletonRows } from '../../components/Skeleton'

export default function DashboardSection() {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState('monthly')
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false)
  const [stats, setStats] = useState(null)
  const [recentShipments, setRecentShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [conditionRange, setConditionRange] = useState('month')
  const conditionChartRef = useRef(null)

  // Fetch stats from API when period changes
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [statsData, shipmentsData] = await Promise.all([
          shipmentsAPI.getStats(activeTab),
          shipmentsAPI.list(),
        ])
        setStats(statsData)
        // Get the 5 most recent for history
        const recent = (shipmentsData.shipments || []).slice(0, 5)
        setRecentShipments(recent)
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [activeTab])

  // Map recent shipments to display format
  const recentHistory = useMemo(() => {
    const iconMap = {
      PENDING: 'package',
      TRANSIT: 'local_shipping',
      DELIVERED: 'package',
      FAILED: 'inventory_2',
      CANCELLED: 'inventory_2',
    }
    const statusMap = {
      PENDING: { text: 'Menunggu', class: 'transit' },
      TRANSIT: { text: 'Dalam Perjalanan', class: 'transit' },
      DELIVERED: { text: 'Selesai', class: 'completed' },
      FAILED: { text: 'Gagal', class: 'failed' },
      CANCELLED: { text: 'Dibatalkan', class: 'failed' },
    }
    return recentShipments.map(s => ({
      id: s.id,
      icon: iconMap[s.status] || 'package',
      desc: s.packageType,
      dest: s.destinationLocation,
      statusText: statusMap[s.status]?.text || s.status,
      statusClass: statusMap[s.status]?.class || 'transit',
      time: new Date(s.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    }))
  }, [recentShipments])

  const displayedHistory = isHistoryExpanded ? recentHistory : recentHistory.slice(0, 3)

  const transitPercent = stats?.total ? Math.round(((stats.transit || 0) / stats.total) * 100) : 0
  const periodSublabel = activeTab === 'daily' ? 'Hari Ini' : activeTab === 'yearly' ? 'Tahun Ini' : 'Periode Ini'

  const handleDownload = () => {
    try {
      const periodMap = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' }

      const data = recentShipments.map(s => ({
        'ID Pengiriman': s.id,
        'Jenis Paket': s.packageType,
        'Asal': s.originLocation,
        'Tujuan': s.destinationLocation,
        'Status': s.status,
        'Tanggal': new Date(s.createdAt).toLocaleDateString('id-ID'),
      }))

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `Laporan ${periodMap[activeTab]}`)
      
      const dateString = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      const fileName = `MPL - Laporan ${periodMap[activeTab]} PT Mahkota Putra Logistik ${dateString}.xlsx`
      
      XLSX.writeFile(wb, fileName)
      showToast(`Dokumen Laporan ${periodMap[activeTab]} berhasil diunduh.`, 'success')
    } catch(err) {
      showToast('Gagal mengunduh laporan.', 'error')
    }
  }

  if (loading && !stats) {
    return (
      <div className="dash-content flex flex-col gap-6">
        <KPISkeletonRow count={4} />
        <ChartSkeleton />
        <div className="rounded-2xl bg-white border border-gray-200 p-6">
          <ListSkeletonRows count={3} />
        </div>
      </div>
    )
  }

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Analitik Kendaraan</h2>
          <p className="dash-header__subtitle">
            Ikhtisar performa real-time untuk PT Mahkota Putra Logistik.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="dash-header__tabs">
            {[
              { id: 'daily', label: 'Harian' },
              { id: 'monthly', label: 'Bulanan' },
              { id: 'yearly', label: 'Tahunan' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`dash-header__tab${activeTab === tab.id ? ' dash-header__tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button 
            onClick={handleDownload}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--dash-secondary)', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'inherit', color: 'var(--dash-primary)' }}
          >
            <Icon name="download" size={18} />
            Unduh Laporan
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1fr] gap-4 md:gap-6">
        <KPICard hero icon="sync" label="Dalam Perjalanan" sublabel={`${transitPercent}% dari total`} value={String(stats?.transit ?? 0)} delay={0.05} />
        <KPICard icon="inventory_2" label="Total Pengiriman" sublabel={periodSublabel} value={String(stats?.total ?? 0)} color="gold" delay={0.1} />
        <KPICard icon="check_circle" label="Terkirim" sublabel={periodSublabel} value={String(stats?.delivered ?? 0)} color="green" delay={0.15} />
        <KPICard icon="warning" label="Perlu Perhatian" sublabel="Paket Bermasalah" value={String(stats?.failed ?? 0)} color={stats?.failed ? 'red' : 'primary'} delay={0.2} />
      </div>

      <ShipmentConditionChart range={conditionRange} onRangeChange={setConditionRange} chartRef={conditionChartRef} />

      {/* ── Bottom: History only (map removed) ── */}
      <RecentHistory
        displayedHistory={displayedHistory}
        isExpanded={isHistoryExpanded}
        onToggleExpand={() => setIsHistoryExpanded(!isHistoryExpanded)}
      />
    </div>
  )
}
