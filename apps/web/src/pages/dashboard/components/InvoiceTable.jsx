import { useEffect, useRef } from 'react'
import Icon from '../../../components/Icon'
import anime from 'animejs'
import { useToast } from '../../../contexts/ToastContext'

const STATUS_LABELS = {
  paid: 'Lunas',
  sent: 'Belum Dibayar',
  unpaid: 'Belum Dibayar',
  overdue: 'Lewat Jatuh Tempo',
  cancelled: 'Dibatalkan'
}

const STATUS_CLASS = {
  paid: 'text-[#005312] bg-[#005312]/10',
  sent: 'text-[#795900] bg-[#fec330]/20',
  unpaid: 'text-[#795900] bg-[#fec330]/20',
  overdue: 'text-[#ba1a1a] bg-[#ba1a1a]/10',
  cancelled: 'text-[#ba1a1a] bg-[#ba1a1a]/10'
}

const ICON_MAP = {
  paid: 'check_circle',
  sent: 'schedule',
  unpaid: 'schedule',
  overdue: 'warning',
  cancelled: 'cancel'
}

const formatIDR = (num) => {
  if (num === null || num === undefined || isNaN(Number(num))) return '-'
  return 'Rp ' + Number(num).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function InvoiceTable({ data }) {
  const tableBodyRef = useRef(null)
  const { showToast } = useToast()

  useEffect(() => {
    if (tableBodyRef.current && tableBodyRef.current.children.length > 0) {
      anime({
        targets: tableBodyRef.current.children,
        opacity: [0, 1],
        translateY: [20, 0],
        easing: 'easeOutExpo',
        duration: 600,
        delay: anime.stagger(50)
      })
    }
  }, [data])

  const handleDownload = (id) => {
    showToast(`Faktur ${id} berhasil diunduh.`, 'success')
  }

  return (
    <div className="w-full glass-card overflow-hidden rounded-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,36,66,0.05)] bg-white/60 backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-white/30 text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold bg-white/20">
              <th className="py-4 px-6 font-semibold">Nomor Faktur</th>
              <th className="py-4 px-6 font-semibold">Terkait Pengiriman</th>
              <th className="py-4 px-6 font-semibold">Jatuh Tempo</th>
              <th className="py-4 px-6 font-semibold">Total Tagihan</th>
              <th className="py-4 px-6 font-semibold">Status</th>
              <th className="py-4 px-6 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody ref={tableBodyRef} className="divide-y divide-white/20">
            {data.map((inv) => {
              const statusLower = inv.status.toLowerCase()
              const dueDateFormatted = new Date(inv.dueDate).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })

              return (
                <tr 
                  key={inv.id} 
                  className="group hover:bg-white/40 transition-all duration-300 ease-out opacity-0"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]">
                        <Icon name="receipt_long" size={16} />
                      </div>
                      <span className="font-bold text-[var(--dash-primary)]">{inv.invoiceNumber}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <Icon name="local_shipping" size={14} className="text-slate-400" />
                      <span className="text-sm font-semibold text-slate-700">{inv.shipmentId}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm font-medium text-slate-600">{dueDateFormatted}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-base font-extrabold text-[var(--dash-primary)]">{formatIDR(inv.totalAmount)}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${STATUS_CLASS[statusLower] || STATUS_CLASS.sent}`}>
                      <Icon name={ICON_MAP[statusLower] || 'info'} size={12} />
                      {STATUS_LABELS[statusLower] || statusLower}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleDownload(inv.invoiceNumber)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold bg-[var(--dash-secondary)] text-[var(--dash-primary)] rounded-lg shadow-[0_4px_15px_rgba(254,195,48,0.2)] hover:shadow-[0_6px_20px_rgba(254,195,48,0.3)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300"
                    >
                      <Icon name="download" size={16} />
                      Unduh PDF
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
