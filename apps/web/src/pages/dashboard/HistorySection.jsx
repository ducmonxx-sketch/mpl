import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import { shipmentsAPI } from '../../lib/api'
import HistoryTabs from './components/HistoryTabs'
import HistoryTable from './components/HistoryTable'
import ReceiptModal from './components/ReceiptModal'
import { HISTORY_STATUS_CONFIG } from './shipmentStatus'
import { ListSkeletonRows } from '../../components/Skeleton'

const TABS = {
  all: 'Semua',
  ...Object.fromEntries(Object.entries(HISTORY_STATUS_CONFIG).map(([key, cfg]) => [key, cfg.label])),
}

export default function HistorySection() {
  const { showToast } = useToast()
  const [tab, setTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeReceiptId, setActiveReceiptId] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch completed shipments — one comma-separated status filter (backend supports it,
  // shipments.ts:102-106) instead of three parallel requests merged client-side.
  useEffect(() => {
    async function fetchHistory() {
      setLoading(true)
      try {
        const data = await shipmentsAPI.list({ status: 'DELIVERED,FAILED,CANCELLED' })
        setHistory(data.shipments || [])
      } catch (err) {
        console.error('Failed to fetch history:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [])

  // Map to display format
  const displayHistory = history.map(s => {
    const createdAt = new Date(s.createdAt)
    const completedAt = s.completionDate ? new Date(s.completionDate) : null
    const duration = completedAt
      ? `${Math.round((completedAt - createdAt) / (1000 * 60 * 60))} jam`
      : '-'

    return {
      id: s.id,
      desc: s.packageType,
      origin: s.originLocation,
      dest: s.destinationLocation,
      status: s.status.toLowerCase(),
      date: createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
      completedAt: completedAt
        ? completedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '-',
      duration,
      proofUrl: s.serahTerimaUrl || null,
      handoverNotes: s.handoverNotes || null,
    }
  })

  const filteredByTab = tab === 'all' ? displayHistory : displayHistory.filter(h => h.status === tab)
  const filtered = filteredByTab.filter(h => 
    h.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    h.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.dest.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const exportToExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(filtered.map(h => ({
        'ID Pengiriman': h.id,
        'Deskripsi': h.desc,
        'Asal': h.origin,
        'Tujuan': h.dest,
        'Status': HISTORY_STATUS_CONFIG[h.status]?.label || h.status,
        'Tanggal': h.date,
        'Selesai': h.completedAt,
        'Durasi': h.duration
      })))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Riwayat")
      XLSX.writeFile(wb, "riwayat_pengiriman_mpl.xlsx")
      showToast('Data riwayat berhasil di ekspor ke Excel.', 'success')
    } catch(err) {
      showToast('Terjadi kesalahan saat mengekspor data.', 'error')
    }
  }

  const activeReceiptItem = activeReceiptId ? displayHistory.find(x => x.id === activeReceiptId) : null

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div>
          <h2 className="text-3xl font-extrabold text-[var(--dash-primary)] tracking-tight mb-1">Riwayat Pengiriman</h2>
          <p className="text-slate-600 text-sm font-medium">Catatan lengkap semua pengiriman yang telah selesai.</p>
        </div>
        <button 
          onClick={exportToExcel}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--dash-secondary)] text-[var(--dash-primary)] rounded-xl font-bold shadow-[0_4px_20px_rgba(254,195,48,0.25)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(254,195,48,0.35)] active:scale-95 transition-all duration-300"
        >
          <Icon name="download" size={18} />
          <span>Ekspor Data</span>
        </button>
      </section>

      {/* Controls: Tabs & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-6">
        <div className="relative w-full md:w-80">
          <Icon name="search" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari ID, paket, atau tujuan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--dash-secondary)] focus:border-transparent transition-all placeholder:text-gray-400"
          />
        </div>
        
        <HistoryTabs tabs={TABS} activeTab={tab} onTabChange={setTab} history={displayHistory} />
      </div>

      {/* History Table */}
      <div>
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <ListSkeletonRows count={5} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-6 bg-white border border-dashed border-gray-200 rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-300 flex items-center justify-center mb-4">
              <Icon name="history" size={28} />
            </div>
            <p className="text-sm font-bold text-gray-600">
              {searchQuery ? 'Tidak ada riwayat yang cocok dengan pencarian.' : 'Belum ada riwayat pengiriman.'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {searchQuery ? 'Coba kata kunci lain.' : 'Riwayat akan muncul di sini setelah pengiriman selesai.'}
            </p>
          </div>
        ) : (
          <HistoryTable 
            data={filtered} 
            onViewReceipt={(id) => { setActiveReceiptId(id); showToast('Memuat dokumen...', 'info') }} 
          />
        )}
      </div>

      {/* Receipt Modal */}
      {activeReceiptItem && (
        <ReceiptModal
          item={activeReceiptItem}
          onClose={() => setActiveReceiptId(null)}
          // No PDF generation exists — this opens the real handover proof file instead of
          // the old fake "success" toast that downloaded nothing. ReceiptModal disables
          // the button entirely when there's no proofUrl, so this is only ever called
          // when one exists.
          onDownload={() => window.open(activeReceiptItem.proofUrl, '_blank', 'noopener,noreferrer')}
        />
      )}
    </div>
  )
}
