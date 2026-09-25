import { useState, useEffect, useRef } from 'react'
import Icon from '../../components/Icon'
import Loader from '../../components/Loader'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { authAPI, auditLogsAPI, BASE_URL } from '../../lib/api'
import AdminModal from './components/AdminModal'
import AdminSessionsPanel from './components/AdminSessionsPanel'

// Same shape as the relative-time formatter in OverviewSection's activity feed.
function relativeTime(iso) {
  if (!iso) return '-'
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diffSec < 60) return 'Baru saja'
  const min = Math.floor(diffSec / 60)
  if (min < 60) return `${min} menit lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'Kemarin'
  if (day < 7) return `${day} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function humanizeAction(actionType) {
  return `melakukan ${(actionType || 'aksi').replace(/_/g, ' ').toLowerCase()}`
}

export default function AdminProfileSection() {
  const { user } = useAuth()
  const { showToast } = useToast()
  
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
  })
  
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
  })
  
  const [showCurrentPass, setShowCurrentPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  
  const [activityLogs, setActivityLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // The admin's own activity (GET /api/audit-logs/me — self-scoped, any role).
  useEffect(() => {
    auditLogsAPI.mine({ limit: 10 })
      .then(({ logs }) => {
        setActivityLogs((logs || []).map(l => ({
          id: l.id,
          details: l.changesSummary || humanizeAction(l.actionType),
          createdAt: l.timestamp,
        })))
      })
      .catch(() => showToast('Gagal memuat riwayat aktivitas.', 'error'))
      .finally(() => setIsLoading(false))
  }, [])

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    if (!formData.fullName.trim()) {
      showToast('Nama lengkap wajib diisi.', 'error')
      return
    }
    try {
      await authAPI.updateAdminMe({ fullName: formData.fullName.trim() })
      showToast('Profil berhasil diperbarui.', 'success')
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui profil.', 'error')
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (!passwords.currentPassword) {
      showToast('Masukkan password saat ini', 'error')
      return
    }
    if (passwords.newPassword.length < 6) {
      showToast('Password baru minimal 6 karakter', 'error')
      return
    }
    setIsSavingPassword(true)
    try {
      await authAPI.changeAdminPassword(passwords)
      showToast('Password berhasil diubah', 'success')
      setPasswords({ currentPassword: '', newPassword: '' })
    } catch (err) {
      showToast(err.message || 'Gagal mengubah password', 'error')
    } finally {
      setIsSavingPassword(false)
    }
  }

  // Load the real profile on mount (backend returns a relative /api/files/... path for
  // the avatar, plus the current fullName/email — more current than the AuthContext
  // snapshot from login).
  useEffect(() => {
    authAPI.getAdminMe()
      .then(({ admin }) => {
        setAvatarUrl(admin?.avatarUrl || null)
        if (admin) setFormData({ fullName: admin.fullName || '', email: admin.email || '' })
      })
      .catch(() => { /* keep the AuthContext defaults */ })
  }, [])

  const resolveAvatar = (u) => (u ? (u.startsWith('http') ? u : `${BASE_URL}${u}`) : null)

  const openAvatarModal = () => {
    setSelectedFile(null)
    setPreview(null)
    setDragOver(false)
    setShowAvatarModal(true)
  }

  const closeAvatarModal = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setSelectedFile(null)
    setShowAvatarModal(false)
  }

  const pickFile = (file) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Format harus JPG, PNG, atau WEBP.', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran maksimal 5 MB.', 'error')
      return
    }
    if (preview) URL.revokeObjectURL(preview)
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    pickFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  const handleUploadAvatar = async () => {
    if (!selectedFile) {
      showToast('Pilih atau seret gambar terlebih dahulu.', 'error')
      return
    }
    setUploadingAvatar(true)
    try {
      const { avatarUrl: url } = await authAPI.uploadAdminAvatar(selectedFile)
      setAvatarUrl(url)
      showToast('Foto profil berhasil diperbarui.', 'success')
      closeAvatarModal()
    } catch (err) {
      showToast(err.message || 'Gagal mengunggah foto.', 'error')
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#002442] mb-1">Profil Admin</h1>
          <p className="text-gray-500 text-sm lg:text-base">Kelola informasi akun dan pengaturan keamanan.</p>
        </div>
      </div>

      {/* Hero Profile Card */}
      <div className="bg-gradient-to-br from-[#002442] to-[#003866] rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden shadow-lg border border-[#fec330]/20">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#fec330] opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div
            className="relative group cursor-pointer"
            onClick={openAvatarModal}
            title="Ubah foto profil"
          >
            <img
              src={resolveAvatar(avatarUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'Admin')}&background=fec330&color=002442&bold=true&size=128`}
              alt="Profile"
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white/20 shadow-xl object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Icon name="camera_alt" className="text-white" size={26} />
              <span className="text-[0.6rem] font-bold text-white uppercase tracking-wide">Ubah Foto</span>
            </div>
          </div>
          
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#fec330]/20 border border-[#fec330]/30 text-[#fec330] text-xs font-bold tracking-wider mb-3">
              <Icon name="verified_user" size={16} />
              {user?.role || 'SUPERADMIN'}
            </div>
            <h2 className="text-3xl font-bold mb-1">{user?.fullName || 'Admin Utama'}</h2>
            <p className="text-[#fec330] opacity-90">{user?.email || 'admin@mpl.co.id'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        {/* Forms Section (Left / Main) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Personal Info Form */}
          <AdminSessionsPanel />

          <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.03)] border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#002442]/5 flex items-center justify-center text-[#002442]">
                <Icon name="person" size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#002442]">Informasi Pribadi</h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Nama Lengkap</label>
                    <input 
                      type="text"
                      value={formData.fullName}
                      onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/50 focus:border-[#fec330] outline-none transition-all"
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Alamat Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      disabled
                      readOnly
                      title="Email tidak dapat diubah dari halaman ini."
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="bg-[#002442] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#003866] transition-colors shadow-lg shadow-[#002442]/20">
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Security Form */}
          <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.03)] border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                <Icon name="lock" size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#002442]">Keamanan Akun</h3>
            </div>
            <div className="p-6">
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Password Saat Ini</label>
                  <div className="relative">
                    <input 
                      type={showCurrentPass ? "text" : "password"}
                      value={passwords.currentPassword}
                      onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-[#fec330]/50 focus:border-[#fec330] outline-none transition-all"
                      placeholder="Masukkan password saat ini"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <Icon name={showCurrentPass ? "visibility_off" : "visibility"} size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Password Baru</label>
                  <div className="relative">
                    <input 
                      type={showNewPass ? "text" : "password"}
                      value={passwords.newPassword}
                      onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-[#fec330]/50 focus:border-[#fec330] outline-none transition-all"
                      placeholder="Masukkan password baru"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <Icon name={showNewPass ? "visibility_off" : "visibility"} size={20} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Gunakan minimal 6 karakter.</p>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={isSavingPassword} className="bg-[#fec330] text-[#002442] px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#e0ab20] transition-colors shadow-lg shadow-[#fec330]/20 disabled:opacity-60 disabled:cursor-not-allowed">
                    {isSavingPassword ? 'Menyimpan...' : 'Perbarui Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
          
        </div>

        {/* Activity Log (Right Sidebar) */}
        <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.03)] border border-gray-100 overflow-hidden h-fit">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                <Icon name="history" size={22} />
              </div>
              <h3 className="text-lg font-bold text-[#002442]">Riwayat Aktivitas</h3>
            </div>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader size="md" />
              </div>
            ) : activityLogs.length > 0 ? (
              <div className="space-y-6">
                {activityLogs.map((log, index) => (
                  <div key={log.id} className="relative pl-6">
                    {/* Timeline line */}
                    {index !== activityLogs.length - 1 && (
                      <div className="absolute left-2.5 top-6 bottom-[-24px] w-px bg-gray-200" />
                    )}
                    {/* Timeline dot */}
                    <div className="absolute left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#fec330] border-2 border-white shadow-sm" />
                    
                    <div>
                      <p className="text-sm font-bold text-[#002442] mb-0.5">{log.details}</p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Icon name="schedule" size={14} />
                        <span>{relativeTime(log.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Icon name="inbox" className="text-gray-300 mb-2 mx-auto" size={32} />
                <p className="text-sm text-gray-500">Belum ada aktivitas.</p>
              </div>
            )}
          </div>
        </div>
        
      </div>

      {/* Avatar upload modal — click to select or drag & drop */}
      {showAvatarModal && (
        <AdminModal
          title="Ubah Foto Profil"
          subtitle="Pilih atau seret gambar. JPG, PNG, atau WEBP · maks 5MB."
          onClose={closeAvatarModal}
          onSubmit={handleUploadAvatar}
          submitLabel={uploadingAvatar ? 'Mengunggah...' : 'Unggah Foto'}
        >
          <div
            className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-[#fec330] bg-[#fec330]/10' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {preview ? (
              <img src={preview} alt="Pratinjau" className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#002442]/5 flex items-center justify-center text-[#002442]">
                <Icon name="add_photo_alternate" size={32} />
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-[#002442]">
                {selectedFile ? selectedFile.name : (dragOver ? 'Lepaskan gambar di sini' : 'Klik untuk memilih atau seret gambar ke sini')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {selectedFile ? 'Klik untuk mengganti gambar' : 'JPG, PNG, atau WEBP · maks 5MB'}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </AdminModal>
      )}
    </div>
  )
}
