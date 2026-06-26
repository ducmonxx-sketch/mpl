import Icon from '../../../components/Icon'

export default function SecurityAccess({ onUpdateCredentials }) {
  return (
    <div className="relative w-full glass-card overflow-hidden rounded-3xl border border-white/20 shadow-[0_8px_32px_rgba(0,36,66,0.05)] bg-white/60 backdrop-blur-xl">
      <div className="p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-200/50 text-slate-600">
            <Icon name="shield" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-[var(--dash-primary)] tracking-tight">Keamanan & Akses</h3>
            <p className="text-sm font-medium text-slate-500">Kelola kata sandi dan keamanan akun Anda.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-bold text-[var(--dash-primary)] mb-4">Ubah Kata Sandi</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kata Sandi Saat Ini</label>
                <div className="relative">
                  <Icon name="lock" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full pl-10 pr-4 py-3 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-xl text-sm font-semibold text-[var(--dash-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent transition-all shadow-sm placeholder:text-slate-300"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kata Sandi Baru</label>
                <div className="relative">
                  <Icon name="key" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full pl-10 pr-4 py-3 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-xl text-sm font-semibold text-[var(--dash-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent transition-all shadow-sm placeholder:text-slate-300"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6 mt-6 border-t border-slate-200/50 border-dashed">
          <button 
            onClick={onUpdateCredentials}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white text-sm font-bold uppercase tracking-wide rounded-xl shadow-[0_4px_15px_rgba(30,41,59,0.25)] hover:shadow-[0_8px_25px_rgba(30,41,59,0.35)] hover:-translate-y-0.5 hover:bg-slate-900 active:scale-95 transition-all duration-300"
          >
            <Icon name="lock_reset" size={18} />
            Perbarui Kredensial
          </button>
        </div>
      </div>
    </div>
  )
}
