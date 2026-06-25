import { useState, useEffect } from 'react'
import Icon from '../../components/Icon'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

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
  
  const [activityLogs, setActivityLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Mock data for activity logs since backend isn't ready
  useEffect(() => {
    setTimeout(() => {
      setActivityLogs([
        { id: 1, action: 'CREATE_INVOICE', details: 'Membuat faktur INV-2024-001', createdAt: new Date(Date.now() - 3600000).toISOString() },
        { id: 2, action: 'UPDATE_SHIPMENT', details: 'Memperbarui status pengiriman #MPL-005', createdAt: new Date(Date.now() - 86400000).toISOString() },
        { id: 3, action: 'ADD_DRIVER', details: 'Menambahkan pengemudi baru: Budi Santoso', createdAt: new Date(Date.now() - 172800000).toISOString() },
      ])
      setIsLoading(false)
    }, 1000)
  }, [])

  const handleProfileSubmit = (e) => {
    e.preventDefault()
    // TODO: Call API when backend is ready
    showToast('Profil berhasil diperbarui (Simulasi)', 'success')
  }

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (passwords.newPassword.length < 6) {
      showToast('Password baru minimal 6 karakter', 'error')
      return
    }
    // TODO: Call API when backend is ready
    showToast('Password berhasil diubah (Simulasi)', 'success')
    setPasswords({ currentPassword: '', newPassword: '' })
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
          <div className="relative group cursor-pointer">
            <img 
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'Admin')}&background=fec330&color=002442&bold=true&size=128`}
              alt="Profile"
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white/20 shadow-xl transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Icon name="camera_alt" className="text-white" size={28} />
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
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#fec330]/50 focus:border-[#fec330] outline-none transition-all"
                      placeholder="admin@example.com"
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
                  <button type="submit" className="bg-[#fec330] text-[#002442] px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#e0ab20] transition-colors shadow-lg shadow-[#fec330]/20">
                    Perbarui Password
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#002442]"></div>
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
                        <span>{new Date(log.createdAt).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}</span>
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
    </div>
  )
}
