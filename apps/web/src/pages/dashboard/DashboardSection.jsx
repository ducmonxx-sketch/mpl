import { useState, useEffect, useMemo } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import { shipmentsAPI } from '../../lib/api'
import * as XLSX from 'xlsx'
import ShipmentChart from './components/ShipmentChart'
import StatusCards from './components/StatusCards'
import RecentHistory from './components/RecentHistory'

export default function DashboardSection() {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState('monthly')
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false)
  const [stats, setStats] = useState(null)
  const [allShipments, setAllShipments] = useState([])
  const [recentShipments, setRecentShipments] = useState([])
  const [loading, setLoading] = useState(true)

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
        setAllShipments(shipmentsData.shipments || [])
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

  // Map API period to chart display format
  const chart = useMemo(() => {
    if (!stats || !allShipments) return null

    const periodLabels = {
      daily: { labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] },
      weekly: { labels: ['Mg 1', 'Mg 2', 'Mg 3', 'Mg 4'] },
      monthly: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'] },
      yearly: { labels: ['2021', '2022', '2023', '2024', '2025', '2026'] },
    }

    const config = periodLabels[activeTab] || periodLabels.monthly
    
    // Aggregation logic
    const counts = new Array(config.labels.length).fill(0)
    const now = new Date()

    allShipments.forEach(s => {
      const d = new Date(s.createdAt)
      if (activeTab === 'monthly' && d.getFullYear() === now.getFullYear()) {
        counts[d.getMonth()]++
      } else if (activeTab === 'yearly') {
        const idx = config.labels.indexOf(d.getFullYear().toString())
        if (idx !== -1) counts[idx]++
      } else if (activeTab === 'daily') {
        let dayIdx = d.getDay() - 1
        if (dayIdx === -1) dayIdx = 6
        const diffTime = Math.abs(now - d)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays <= 7) counts[dayIdx]++
      } else if (activeTab === 'weekly') {
        const dateDate = d.getDate()
        const week = Math.min(Math.floor((dateDate - 1) / 7), 3)
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          counts[week]++
        }
      }
    })

    const maxCount = Math.max(...counts, 1)
    const dataPoints = counts.map((count) => ({
      value: count,
      heightPercent: Math.max(5, (count / maxCount) * 100)
    }))

    return {
      labels: config.labels,
      dataPoints,
      highlightIndex: config.labels.length - 1,
      metric: `${stats.total}`,
      change: `${stats.delivered} terkirim, ${stats.transit} transit`,
    }
  }, [stats, activeTab, allShipments])

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

  // Status cards from stats
  const statusCardsData = stats ? {
    total: stats.total,
    delivered: stats.delivered,
    transit: stats.transit,
    failed: stats.failed,
    pending: stats.pending,
    cancelled: stats.cancelled,
  } : null

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

  if (loading && !chart) {
    return (
      <div className="dash-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#fec330', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '0.9rem' }}>Memuat data dasbor...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
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

      <div className="dash-bento">
        {chart && <ShipmentChart chart={chart} activeTab={activeTab} />}
        <StatusCards apiStats={statusCardsData} />
      </div>

      {/* ── Bottom: History only (map removed) ── */}
      <RecentHistory
        displayedHistory={displayedHistory}
        isExpanded={isHistoryExpanded}
        onToggleExpand={() => setIsHistoryExpanded(!isHistoryExpanded)}
      />
    </div>
  )
}
