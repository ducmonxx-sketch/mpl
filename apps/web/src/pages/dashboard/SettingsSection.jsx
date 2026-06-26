import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import CompanyProfile from './components/CompanyProfile'
import SecurityAccess from './components/SecurityAccess'

export default function SettingsSection() {
  const { showToast } = useToast()
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
      {/* Header */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white/40 backdrop-blur-md p-6 rounded-2xl border border-white/50 shadow-sm">
        <div>
          <h2 className="text-3xl font-extrabold text-[var(--dash-primary)] tracking-tight mb-1">Pengaturan Akun</h2>
          <p className="text-slate-600 text-sm font-medium">Kelola profil perusahaan dan keamanan kredensial Anda.</p>
        </div>
      </section>

      {/* Main Settings Grid */}
      <div className="flex flex-col gap-6">
        <CompanyProfile userData={user} />
        <SecurityAccess onUpdateCredentials={() => showToast('Kredensial keamanan berhasil diperbarui.', 'success')} />
      </div>
    </div>
  )
}
