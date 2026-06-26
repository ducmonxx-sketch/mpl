import { useEffect, useRef } from 'react'
import Icon from '../../../components/Icon'
import anime from 'animejs'

const STATUS_CLASS = { delivered: 'completed', failed: 'failed', cancelled: 'failed' }
const STATUS_LABEL = { delivered: 'Selesai', failed: 'Gagal', cancelled: 'Dibatalkan' }
const ICON_MAP = { delivered: 'check_circle', failed: 'warning', cancelled: 'close' }

export default function HistoryTable({ data, onViewReceipt }) {
  const tableBodyRef = useRef(null)

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

  return (
    <div className="w-full glass-card overflow-hidden rounded-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,36,66,0.05)] bg-white/60 backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/30 text-[0.65rem] uppercase tracking-wider text-slate-500 font-bold bg-white/20">
              <th className="py-4 px-6 font-semibold">ID Pengiriman</th>
              <th className="py-4 px-6 font-semibold">Tanggal</th>
              <th className="py-4 px-6 font-semibold">Rute & Paket</th>
              <th className="py-4 px-6 font-semibold">Selesai & Durasi</th>
              <th className="py-4 px-6 font-semibold">Status</th>
              <th className="py-4 px-6 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody ref={tableBodyRef} className="divide-y divide-white/20">
            {data.map((item) => (
              <tr 
                key={item.id} 
                className="group hover:bg-white/40 transition-all duration-300 ease-out opacity-0"
              >
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--dash-secondary)]/20 text-[var(--dash-primary)]">
                      <Icon name="receipt" size={16} />
                    </div>
                    <span className="font-bold text-[var(--dash-primary)]">{item.id}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="text-sm font-medium text-slate-700">{item.date}</div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-slate-800 text-sm">{item.desc}</span>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <span>{item.origin}</span>
                      <Icon name="arrow_forward" size={12} />
                      <span>{item.dest}</span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-slate-700">{item.completedAt}</span>
                    <span className="text-xs text-slate-500 font-medium">{item.duration}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide dash-status-pill--${STATUS_CLASS[item.status]}`}>
                    <Icon name={ICON_MAP[item.status]} size={12} />
                    {STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td className="py-4 px-6 text-right">
                  <button
                    onClick={() => onViewReceipt(item.id)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold bg-white text-[var(--dash-primary)] rounded-lg shadow-sm hover:shadow-md hover:bg-[var(--dash-primary)] hover:text-white transition-all duration-300 border border-slate-200 hover:border-transparent active:scale-95"
                  >
                    <Icon name="visibility" size={16} />
                    Lihat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
