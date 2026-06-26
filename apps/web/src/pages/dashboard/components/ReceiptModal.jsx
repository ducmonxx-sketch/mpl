import Icon from '../../../components/Icon'

const STATUS_LABEL = { delivered: 'Terkirim', failed: 'Gagal', cancelled: 'Dibatalkan' }
const STATUS_CLASS = { delivered: 'text-[#005312] bg-[#005312]/10', failed: 'text-[#ba1a1a] bg-[#ba1a1a]/10', cancelled: 'text-[#ba1a1a] bg-[#ba1a1a]/10' }

export default function ReceiptModal({ item, onClose, onDownload }) {
  const h = item

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#13191f]/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div 
        className="relative w-full max-w-md mx-4 bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Tape / Edge Effect */}
        <div className="h-2 w-full bg-[var(--dash-secondary)]" />
        
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-extrabold text-[var(--dash-primary)] uppercase tracking-wide">Resi Pengiriman</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">PT Mahkota Putra Logistik</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-[var(--dash-primary)] hover:bg-slate-100 rounded-full transition-colors"
            >
              <Icon name="close" size={24} />
            </button>
          </div>

          <div className="flex items-center gap-4 mb-8 p-4 bg-[var(--dash-primary)]/5 rounded-2xl border border-[var(--dash-primary)]/10">
            <div className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm text-[var(--dash-primary)]">
              <Icon name="local_shipping" size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">ID Pengiriman</p>
              <p className="text-lg font-black text-[var(--dash-primary)] tracking-tight">{h.id}</p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 border-dashed">
              <span className="text-sm font-semibold text-slate-500">Status</span>
              <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${STATUS_CLASS[h.status]}`}>
                {STATUS_LABEL[h.status]}
              </span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 border-dashed">
              <span className="text-sm font-semibold text-slate-500">Jenis Paket</span>
              <span className="text-sm font-bold text-slate-800 text-right max-w-[200px] truncate">{h.desc}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 border-dashed">
              <span className="text-sm font-semibold text-slate-500">Rute</span>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <span>{h.origin}</span>
                <Icon name="arrow_forward" size={14} className="text-slate-400" />
                <span>{h.dest}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-500">Diselesaikan</span>
              <span className="text-sm font-bold text-[var(--dash-primary)]">{h.completedAt}</span>
            </div>
          </div>
          
          <button 
            onClick={onDownload} 
            className="w-full py-3.5 flex items-center justify-center gap-2 bg-[var(--dash-secondary)] text-[var(--dash-primary)] text-sm font-bold uppercase tracking-wider rounded-xl shadow-[0_4px_15px_rgba(254,195,48,0.25)] hover:shadow-[0_8px_25px_rgba(254,195,48,0.35)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300"
          >
            <Icon name="download" size={18} /> 
            Unduh Dokumen PDF
          </button>
        </div>
      </div>
    </div>
  )
}
