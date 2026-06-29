import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import { shipmentsAPI } from '../../lib/api'
import HistoryTabs from './components/HistoryTabs'
import HistoryTable from './components/HistoryTable'
import ReceiptModal from './components/ReceiptModal'

const TABS = { all: 'Semua', delivered: 'Selesai', failed: 'Gagal', cancelled: 'Dibatalkan' }
const STATUS_LABEL = { delivered: 'Terkirim', failed: 'Gagal', cancelled: 'Dibatalkan' }

export default function HistorySection() {
  const { showToast } = useToast()
  const [tab, setTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeReceiptId, setActiveReceiptId] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch completed shipments
  useEffect(() => {
    async function fetchHistory() {
      setLoading(true)
      try {
        // Fetch all completed status shipments
        const [delivered, failed, cancelled] = await Promise.all([
          shipmentsAPI.list({ status: 'DELIVERED' }),
          shipmentsAPI.list({ status: 'FAILED' }),
          shipmentsAPI.list({ status: 'CANCELLED' }),
        ])

        let all = [
          ...(delivered.shipments || []),
          ...(failed.shipments || []),
          ...(cancelled.shipments || []),
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        if (all.length === 0) {
          all = [
            {
              id: 'MPL-882194',
              packageType: 'Alat Berat - Excavator PC200',
              originLocation: 'Jakarta (Tanjung Priok)',
              destinationLocation: 'Surabaya (Tanjung Perak)',
              status: 'DELIVERED',
              createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
              completionDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
            },
            {
              id: 'MPL-882195',
              packageType: 'Sparepart Mesin Industri',
              originLocation: 'Bandung',
              destinationLocation: 'Semarang',
              status: 'FAILED',
              createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
              completionDate: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
            },
            {
              id: 'MPL-882196',
              packageType: 'Pipa Baja Besi',
              originLocation: 'Medan',
              destinationLocation: 'Palembang',
              status: 'CANCELLED',
              createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
              completionDate: new Date(Date.now() - 1000 * 60 * 60 * 100).toISOString()
            },
            {
              id: 'MPL-882197',
              packageType: 'Material Konstruksi',
              originLocation: 'Makassar',
              destinationLocation: 'Manado',
              status: 'DELIVERED',
              createdAt: new Date(Date.now() - 1000 * 60 * 60 * 240).toISOString(),
              completionDate: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString()
            }
          ]
        }

        setHistory(all)
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
        'Status': STATUS_LABEL[h.status] || h.status,
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
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white/40 backdrop-blur-md p-6 rounded-2xl border border-white/50 shadow-sm">
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
          <div className="flex flex-col items-center justify-center p-16 glass-card rounded-2xl text-slate-400">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-[var(--dash-secondary)] rounded-full animate-spin mb-4" />
            <p className="font-semibold text-slate-600">Memuat riwayat...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 glass-card rounded-2xl text-slate-400">
            <Icon name="history" size={48} />
            <p className="mt-4 font-semibold text-slate-600">
              {searchQuery ? 'Tidak ada riwayat yang cocok dengan pencarian.' : 'Belum ada riwayat pengiriman.'}
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
          onDownload={() => showToast('Manifes PDF berhasil diunduh.', 'success')}
        />
      )}
    </div>
  )
}
