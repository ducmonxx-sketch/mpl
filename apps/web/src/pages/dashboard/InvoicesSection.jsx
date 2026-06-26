import { useState, useEffect, useRef } from 'react'
import Icon from '../../components/Icon'
import { invoicesAPI } from '../../lib/api'
import InvoiceTable from './components/InvoiceTable'

export default function InvoicesSection() {
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  // Animated tabs state
  const tabsContainerRef = useRef(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true)
      try {
        const res = await invoicesAPI.list()
        let fetchedInvoices = res.invoices || []
        
        if (fetchedInvoices.length === 0) {
          fetchedInvoices = [
            {
              id: 'INV-001',
              invoiceNumber: 'INV/2026/06/001',
              shipmentId: 'MPL-882194',
              dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
              totalAmount: 15500000,
              status: 'SENT'
            },
            {
              id: 'INV-002',
              invoiceNumber: 'INV/2026/05/088',
              shipmentId: 'MPL-882100',
              dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
              totalAmount: 8200000,
              status: 'OVERDUE'
            },
            {
              id: 'INV-003',
              invoiceNumber: 'INV/2026/05/045',
              shipmentId: 'MPL-882050',
              dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
              totalAmount: 4500000,
              status: 'PAID'
            },
            {
              id: 'INV-004',
              invoiceNumber: 'INV/2026/04/012',
              shipmentId: 'MPL-881900',
              dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
              totalAmount: 12000000,
              status: 'PAID'
            }
          ]
        }
        
        setInvoices(fetchedInvoices)
      } catch (err) {
        console.error('Failed to fetch client invoices:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchInvoices()
  }, [])

  // Filter out DRAFT invoices for clients
  const clientInvoices = invoices.filter(inv => inv.status !== 'DRAFT')

  // Apply Tabs Filter
  const filteredByTab = clientInvoices.filter(inv => {
    const statusLower = inv.status.toLowerCase()
    if (filter === 'all') return true
    if (filter === 'unpaid') return statusLower === 'sent'
    if (filter === 'paid') return statusLower === 'paid'
    if (filter === 'overdue') return statusLower === 'overdue'
    return false
  })

  // Apply Search Filter
  const filtered = filteredByTab.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.shipmentId.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filters = [
    { id: 'all', label: 'Semua' },
    { id: 'unpaid', label: 'Belum Dibayar' },
    { id: 'paid', label: 'Lunas' },
    { id: 'overdue', label: 'Jatuh Tempo' },
  ]

  // Update sliding indicator for tabs
  useEffect(() => {
    if (!tabsContainerRef.current) return
    const activeEl = tabsContainerRef.current.querySelector('[data-active="true"]')
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth
      })
    }
  }, [filter, clientInvoices.length])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white/40 backdrop-blur-md p-6 rounded-2xl border border-white/50 shadow-sm">
        <div>
          <h2 className="text-3xl font-extrabold text-[var(--dash-primary)] tracking-tight mb-1">Faktur &amp; Pembayaran</h2>
          <p className="text-slate-600 text-sm font-medium">Lihat riwayat tagihan dan status pembayaran Anda.</p>
        </div>
      </section>

      {/* Controls: Tabs & Search */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        
        {/* Animated Tabs */}
        <div className="relative inline-flex p-1.5 bg-white/40 backdrop-blur-md rounded-xl border border-white/50 shadow-sm overflow-x-auto max-w-full" ref={tabsContainerRef}>
          <div 
            className="absolute top-1.5 bottom-1.5 bg-white rounded-lg shadow-sm transition-all duration-300 ease-out"
            style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          />
          
          {filters.map(f => {
            const count = f.id === 'all' 
              ? clientInvoices.length 
              : clientInvoices.filter(inv => {
                  const statusLower = inv.status.toLowerCase()
                  if (f.id === 'unpaid') return statusLower === 'sent'
                  if (f.id === 'paid') return statusLower === 'paid'
                  if (f.id === 'overdue') return statusLower === 'overdue'
                  return false
                }).length
            const isActive = filter === f.id
            
            return (
              <button
                key={f.id}
                data-active={isActive}
                onClick={() => setFilter(f.id)}
                className={`relative z-10 flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg transition-colors duration-200 whitespace-nowrap ${
                  isActive ? 'text-[var(--dash-primary)]' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.label}
                {f.id !== 'all' && (
                  <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[0.65rem] rounded-full transition-colors ${
                    isActive ? 'bg-[var(--dash-secondary)] text-[var(--dash-primary)]' : 'bg-slate-200/80 text-slate-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-80 flex-shrink-0">
          <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari Nomor Faktur atau ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/60 backdrop-blur-md border border-white/50 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--dash-secondary)] focus:border-transparent transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Invoice Table / Content */}
      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 glass-card rounded-2xl text-slate-400">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-[var(--dash-secondary)] rounded-full animate-spin mb-4" />
            <p className="font-semibold text-slate-600">Memuat data faktur...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 glass-card rounded-2xl text-slate-400">
            <Icon name="receipt_long" size={48} />
            <p className="mt-4 font-semibold text-slate-600">
              {searchQuery ? 'Tidak ada faktur yang cocok dengan pencarian.' : 'Belum ada faktur.'}
            </p>
          </div>
        ) : (
          <InvoiceTable data={filtered} />
        )}
      </div>
    </div>
  )
}

