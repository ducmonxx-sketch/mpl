import { useState, useRef, useEffect } from 'react'
import Icon from '../../../components/Icon'
import anime from 'animejs'

export default function LogoStudioModal({ imageUrl, onClose, onApply }) {
  const [zoom, setZoom] = useState(1)
  const modalRef = useRef(null)

  useEffect(() => {
    if (modalRef.current) {
      anime({
        targets: modalRef.current,
        opacity: [0, 1],
        scale: [0.95, 1],
        easing: 'easeOutExpo',
        duration: 400
      })
    }
  }, [])

  const handleApply = () => {
    // In a real app, we would crop the image using a canvas here.
    // For this prototype, we just pass the original image back.
    onApply(imageUrl)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#13191f]/80 backdrop-blur-md">
      <div 
        ref={modalRef}
        className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-extrabold text-[var(--dash-primary)] tracking-tight">Studio Logo</h3>
            <p className="text-xs font-semibold text-slate-500 mt-1">Sesuaikan tampilan logo perusahaan Anda</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Cropper Area */}
        <div className="relative w-full aspect-square bg-slate-50 overflow-hidden flex items-center justify-center">
          
          {/* The Image being cropped */}
          <img 
            src={imageUrl} 
            alt="Preview" 
            className="max-w-none origin-center"
            style={{ 
              transform: `scale(${zoom})`,
              transition: 'transform 0.1s ease-out'
            }} 
          />

          {/* The Crop Mask (Rounded Square) */}
          <div className="absolute inset-0 pointer-events-none" style={{
            boxShadow: 'inset 0 0 0 9999px rgba(255,255,255,0.7)'
          }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-dashed border-[var(--dash-primary)] rounded-2xl shadow-[0_0_0_9999px_rgba(19,25,31,0.5)]"></div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-6">
          <div className="flex items-center gap-4 mb-8">
            <Icon name="remove" size={20} className="text-slate-400" />
            <input 
              type="range" 
              min="1" 
              max="3" 
              step="0.05" 
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--dash-primary)] focus:outline-none"
            />
            <Icon name="add" size={20} className="text-slate-400" />
          </div>

          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Batal
            </button>
            <button 
              onClick={handleApply}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-[var(--dash-primary)] bg-[var(--dash-secondary)] shadow-[0_4px_15px_rgba(254,195,48,0.25)] hover:shadow-[0_6px_20px_rgba(254,195,48,0.35)] hover:-translate-y-0.5 active:scale-95 transition-all"
            >
              Terapkan Logo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
