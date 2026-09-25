import { useState, useRef } from 'react'
import Icon from '../../../components/Icon'
import { useToast } from '../../../contexts/ToastContext'
import LogoStudioModal from './LogoStudioModal'

function InfoField({ icon, label, value, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
        <Icon name={icon} size={13} className="text-slate-400" />
        {label}
      </label>
      <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200/70 rounded-xl text-sm font-semibold text-[#002442]">
        {value}
      </div>
    </div>
  )
}

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
  const isVerified = userData?.verificationStatus === 'VERIFIED'

  return (
    <>
      <div className="relative w-full bg-white rounded-3xl border border-gray-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
        {/* Cover banner */}
        <div className="h-20 md:h-24 bg-gradient-to-r from-[var(--dash-primary)] to-[#003a66]" />

        <div className="px-6 md:px-8 pb-8">
          {/* Identity row: avatar overlapping the banner + name/meta */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-5 -mt-12 md:-mt-14 mb-6">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg, image/png, image/webp"
              className="hidden"
            />

            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <div
                onClick={handleAvatarClick}
                className={`relative group w-28 h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden border-4 border-white bg-white shadow-lg transition-colors ${
                  isCooldownActive ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                }`}
              >
                <img src={currentLogo} alt="Logo Perusahaan" className="w-full h-full object-contain p-2" />
                {!isCooldownActive && (
                  <div className="absolute inset-0 bg-[var(--dash-primary)]/80 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Icon name="add_a_photo" size={22} />
                    <span className="text-[0.65rem] font-bold mt-1 uppercase tracking-wider">Ubah Logo</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest text-center">Maks 2MB (JPG, PNG)</span>
                {isCooldownActive && (
                  <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full mt-1">
                    <Icon name="timer" size={11} />
                    Tunggu 7 Hari
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-1 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-2xl font-black text-[#002442] tracking-tight truncate">
                    {userData?.companyName || 'PT Mahkota Putra Logistik'}
                  </h3>
                  {isVerified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200 flex-shrink-0">
                      <Icon name="verified" size={12} />
                      Terverifikasi
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-500 mt-1 truncate">
                  {userData?.fullName || 'Ananditha Putri'} · Klien Bisnis
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 flex-shrink-0 self-start">
                <Icon name="lock" size={14} className="text-slate-400" />
                <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Hanya Admin dapat mengubah</span>
              </div>
            </div>
          </div>

          {/* Read-only company details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoField icon="business" label="Nama Perusahaan" value={userData?.companyName || 'PT Mahkota Putra Logistik'} />
            <InfoField icon="badge" label="Nomor Induk Berusaha (NIB)" value="912000-834-291" />
            <InfoField icon="person" label="Kontak Person" value={userData?.fullName || 'Ananditha Putri'} />
            <InfoField icon="email" label="Email Resmi" value={userData?.email || 'ops@mahkotaputra.com'} />
            <InfoField icon="phone" label="Nomor Telepon" value={userData?.phoneNumber || '+62 812 9116 6006'} />
            <InfoField icon="location_on" label="Alamat Kantor" value="Jl. Raya Bogor Km. 29, Jakarta Timur" className="md:col-span-2" />
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
