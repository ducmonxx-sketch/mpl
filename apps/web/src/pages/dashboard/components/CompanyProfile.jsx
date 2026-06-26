import { useState, useRef } from 'react'
import Icon from '../../../components/Icon'
import { useToast } from '../../../contexts/ToastContext'
import LogoStudioModal from './LogoStudioModal'

export default function CompanyProfile({ userData }) {
  const { showToast } = useToast()
  
  const [lastUploadDate, setLastUploadDate] = useState(null)
  const [currentLogo, setCurrentLogo] = useState('/mpl_logo_proto.svg')
  
  // Studio Modal State
  const [studioImageUrl, setStudioImageUrl] = useState(null)
  const fileInputRef = useRef(null)

  const handleAvatarClick = () => {
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
    const now = Date.now()

    if (lastUploadDate && (now - lastUploadDate) < ONE_WEEK_MS) {
      showToast('Anda hanya dapat mengubah logo 1 kali per minggu.', 'error')
      return
    }

    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran file maksimal 2MB.', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setStudioImageUrl(event.target.result)
    }
    reader.readAsDataURL(file)
    
    // Reset input so the same file can be selected again if needed
    e.target.value = null
  }

  const handleApplyLogo = (croppedUrl) => {
    setCurrentLogo(croppedUrl)
    setStudioImageUrl(null)
    setLastUploadDate(Date.now())
    showToast('Logo perusahaan berhasil diperbarui!', 'success')
  }

  const isCooldownActive = lastUploadDate && (Date.now() - lastUploadDate) < (7 * 24 * 60 * 60 * 1000)

  return (
    <>
      <div className="relative w-full glass-card overflow-hidden rounded-3xl border border-white/20 shadow-[0_8px_32px_rgba(0,36,66,0.05)] bg-white/60 backdrop-blur-xl">
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[var(--dash-primary)] to-[var(--dash-secondary)]" />
        
        <div className="p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]">
                <Icon name="business" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-[var(--dash-primary)] tracking-tight">Profil Perusahaan</h3>
                <p className="text-sm font-medium text-slate-500">Informasi utama akun bisnis Anda.</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
              <Icon name="lock" size={14} className="text-slate-500" />
              <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Hanya Admin yang dapat mengubah profil</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-10 mb-4">
            {/* Avatar Upload Area */}
            <div className="flex-shrink-0 flex flex-col items-center gap-3">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/jpeg, image/png, image/webp" 
                className="hidden" 
              />
              
              <div 
                onClick={handleAvatarClick}
                className={`relative group w-32 h-32 rounded-2xl overflow-hidden border-2 border-dashed bg-white shadow-sm transition-colors ${
                  isCooldownActive 
                    ? 'border-slate-300 cursor-not-allowed opacity-80' 
                    : 'border-[var(--dash-secondary)]/50 cursor-pointer hover:border-[var(--dash-secondary)]'
                }`}
              >
                <img src={currentLogo} alt="Logo Perusahaan" className="w-full h-full object-contain p-2" />
                
                {!isCooldownActive && (
                  <div className="absolute inset-0 bg-[var(--dash-primary)]/80 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Icon name="add_a_photo" size={24} />
                    <span className="text-xs font-bold mt-1 uppercase tracking-wider">Ubah Logo</span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col items-center">
                <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest text-center mb-1">Maks 2MB (JPG, PNG)</span>
                {isCooldownActive && (
                  <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full mt-1">
                    <Icon name="timer" size={12} />
                    Tunggu 7 Hari
                  </span>
                )}
              </div>
            </div>

            {/* Form Fields (Read Only) */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Perusahaan</label>
                <input 
                  type="text" 
                  disabled
                  defaultValue={userData?.companyName || "PT Mahkota Putra Logistik"} 
                  className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200/60 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nomor Induk Berusaha (NIB)</label>
                <input 
                  type="text" 
                  disabled
                  defaultValue="912000-834-291" 
                  className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200/60 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kontak Person</label>
                <input 
                  type="text" 
                  disabled
                  defaultValue={userData?.fullName || "Ananditha Putri"} 
                  className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200/60 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Resmi</label>
                <input 
                  type="email" 
                  disabled
                  defaultValue={userData?.email || "ops@mahkotaputra.com"} 
                  className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200/60 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nomor Telepon</label>
                <input 
                  type="tel" 
                  disabled
                  defaultValue={userData?.phoneNumber || "+62 812 9116 6006"} 
                  className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200/60 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed shadow-sm"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alamat Kantor</label>
                <input 
                  type="text" 
                  disabled
                  defaultValue="Jl. Raya Bogor Km. 29, Jakarta Timur" 
                  className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200/60 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {studioImageUrl && (
        <LogoStudioModal 
          imageUrl={studioImageUrl} 
          onClose={() => setStudioImageUrl(null)} 
          onApply={handleApplyLogo} 
        />
      )}
    </>
  )
}
