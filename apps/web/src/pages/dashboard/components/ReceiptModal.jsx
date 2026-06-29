import { useEffect, useRef } from 'react'
import anime from 'animejs'
import Icon from '../../../components/Icon'

const STATUS_LABEL = { delivered: 'Terkirim', failed: 'Gagal', cancelled: 'Dibatalkan' }
const STATUS_CLASS = { delivered: 'text-[#005312] bg-[#005312]/10', failed: 'text-[#ba1a1a] bg-[#ba1a1a]/10', cancelled: 'text-[#ba1a1a] bg-[#ba1a1a]/10' }

export default function ReceiptModal({ item, onClose, onDownload }) {
  const h = item
  const modalRef = useRef(null)
  const overlayRef = useRef(null)
  
  // Mock image for Proof of Delivery
  const proofImage = "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop"

  useEffect(() => {
    // Entrance animations
    anime({
      targets: overlayRef.current,
      opacity: [0, 1],
      duration: 300,
      easing: 'easeOutSine'
    })
    
    anime({
      targets: modalRef.current,
      scale: [0.95, 1],
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 500,
      easing: 'easeOutExpo'
    })
    
    anime({
      targets: '.receipt-anim',
      opacity: [0, 1],
      translateY: [10, 0],
      delay: anime.stagger(50, { start: 200 }),
      duration: 400,
      easing: 'easeOutCubic'
    })
  }, [])

  const handleClose = () => {
    // Exit animations
    anime({
      targets: modalRef.current,
      scale: 0.95,
      opacity: 0,
      translateY: 20,
      duration: 200,
      easing: 'easeInExpo'
    })
    anime({
      targets: overlayRef.current,
      opacity: 0,
      duration: 200,
      easing: 'easeInSine',
      complete: onClose
    })
  }

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#13191f]/70 backdrop-blur-md opacity-0" 
      onClick={handleClose}
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-lg mx-4 bg-white/95 backdrop-blur-2xl border border-white/50 shadow-2xl rounded-3xl overflow-hidden opacity-0 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="h-2 w-full bg-gradient-to-r from-[var(--dash-primary)] via-[var(--dash-secondary)] to-[var(--dash-primary)] receipt-anim" />
        
        {/* Header Section */}
        <div className="p-8 pb-4 shrink-0 receipt-anim">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-2xl font-black text-[var(--dash-primary)] uppercase tracking-tight">Resi Pengiriman</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">PT Mahkota Putra Logistik</p>
            </div>
            <button 
              onClick={handleClose} 
              className="p-2 text-slate-400 hover:text-[var(--dash-primary)] hover:bg-slate-100 rounded-full transition-colors"
            >
              <Icon name="close" size={24} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[var(--dash-primary)]/5 rounded-2xl border border-[var(--dash-primary)]/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center bg-white rounded-xl shadow-sm text-[var(--dash-primary)]">
                <Icon name="local_shipping" size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">ID Pengiriman</p>
                <p className="text-lg font-black text-[var(--dash-primary)] tracking-tight">{h.id}</p>
              </div>
            </div>
            <div className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl shadow-inner ${STATUS_CLASS[h.status]}`}>
              {STATUS_LABEL[h.status]}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-8 pt-4 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* Details */}
          <div className="space-y-4 mb-8 receipt-anim">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 border-dashed">
              <span className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                <Icon name="inventory_2" size={16} /> Jenis Paket
              </span>
              <span className="text-sm font-bold text-slate-800 text-right max-w-[200px] truncate">{h.desc}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 border-dashed">
              <span className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                <Icon name="route" size={16} /> Rute
              </span>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <span>{h.origin}</span>
                <Icon name="arrow_forward" size={14} className="text-slate-400" />
                <span>{h.dest}</span>
              </div>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 border-dashed">
              <span className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                <Icon name="check_circle" size={16} /> Diselesaikan
              </span>
              <span className="text-sm font-bold text-[var(--dash-primary)]">{h.completedAt}</span>
            </div>
          </div>

          {/* Proof of Delivery Image (Hardcoded) */}
          <div className="mb-4 receipt-anim">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Icon name="photo_camera" size={16} /> Bukti Pengiriman (Proof of Delivery)
            </h4>
            <div className="relative w-full h-48 rounded-2xl overflow-hidden group border-2 border-slate-100 shadow-sm">
              <img 
                src={proofImage} 
                alt="Proof of Delivery" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                <p className="text-white text-xs font-bold uppercase tracking-wider drop-shadow-md">
                  Diunggah oleh Kurir
                </p>
              </div>
            </div>
          </div>

        </div>
        
        {/* Footer Actions */}
        <div className="p-8 pt-4 shrink-0 bg-slate-50/80 border-t border-slate-100 receipt-anim">
          <button 
            onClick={onDownload} 
            className="w-full py-4 flex items-center justify-center gap-2 bg-[var(--dash-secondary)] text-[var(--dash-primary)] text-sm font-black uppercase tracking-wider rounded-xl shadow-[0_4px_20px_rgba(254,195,48,0.3)] hover:shadow-[0_8px_30px_rgba(254,195,48,0.4)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300"
          >
            <Icon name="download" size={20} /> 
            Unduh Dokumen PDF
          </button>
        </div>

      </div>
    </div>
  )
}
