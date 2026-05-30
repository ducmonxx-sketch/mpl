import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import { shipmentsAPI } from '../../lib/api'
import HistoryTabs from './components/HistoryTabs'
import HistoryItem from './components/HistoryItem'
import ReceiptModal from './components/ReceiptModal'

const TABS = { all: 'Semua', delivered: 'Selesai', failed: 'Gagal', cancelled: 'Dibatalkan' }
const STATUS_LABEL = { delivered: 'Terkirim', failed: 'Gagal', cancelled: 'Dibatalkan' }

export default function HistorySection() {
  const { showToast } = useToast()
  const [tab, setTab] = useState('all')
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

        const all = [
          ...(delivered.shipments || []),
          ...(failed.shipments || []),
          ...(cancelled.shipments || []),
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

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

  const filtered = tab === 'all' ? displayHistory : displayHistory.filter(h => h.status === tab)

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

  if (loading) {
    return (
      <div className="dash-content" style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #e2e8f0', borderTopColor: '#fec330', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '0.85rem' }}>Memuat riwayat...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Riwayat Pengiriman</h2>
          <p className="dash-header__subtitle">Catatan lengkap semua pengiriman yang telah selesai.</p>
        </div>
        <button className="hist-export-btn" onClick={exportToExcel}>
          <Icon name="download" size={16} />
          <span>Ekspor Data</span>
        </button>
      </section>

      {/* Tabs */}
      <HistoryTabs tabs={TABS} activeTab={tab} onTabChange={setTab} history={displayHistory} />

      {/* History List */}
      <div className="hist-list">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <Icon name="history" size={48} />
            <p style={{ marginTop: '1rem', fontWeight: 600 }}>Belum ada riwayat pengiriman.</p>
          </div>
        ) : (
          filtered.map((h) => (
            <HistoryItem
              key={h.id}
              item={h}
              onViewReceipt={(id) => { setActiveReceiptId(id); showToast('Memuat dokumen...', 'info') }}
            />
          ))
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
