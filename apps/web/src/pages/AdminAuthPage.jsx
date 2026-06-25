import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AdminAuthPage() {
  const navigate = useNavigate()
  const { adminLogin } = useAuth()
  const [showPw, setShowPw] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [loginError, setLoginError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    const form = e.target
    const emailValue = form.elements['admin-email']?.value?.trim() || ''
    const passwordValue = form.elements['admin-password']?.value || ''

    if (!emailValue) { setEmailError('Email wajib diisi.'); return }
    if (!EMAIL_REGEX.test(emailValue)) { setEmailError('Masukkan email yang valid (cth: admin@mahkota.id).'); return }
    setEmailError('')
    setLoginError('')
    setSubmitting(true)

    try {
      await adminLogin(emailValue, passwordValue)
      navigate('/admin/dashboard')
    } catch (err) {
      if (err.status === 401) {
        setLoginError('Email atau password salah.')
      } else {
        setLoginError(err.message || 'Terjadi kesalahan. Silakan coba lagi.')
      }
    } finally {
      setSubmitting(false)
    }
  }, [navigate, adminLogin])

  const handleEmailChange = useCallback(() => {
    if (emailError) setEmailError('')
    if (loginError) setLoginError('')
  }, [emailError, loginError])

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-primary relative overflow-hidden font-display">
      {/* Abstract Glowing Background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-[30%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-white/5 blur-[120px] mix-blend-screen opacity-50 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-[#f2b824]/10 blur-[120px] mix-blend-screen opacity-40 animate-pulse" style={{ animationDuration: '12s' }} />
      </div>

      <main className="z-10 w-full max-w-5xl p-6 md:p-12 flex flex-col items-center">
        
        {/* Floating Glassmorphism Card */}
        <div className="w-full max-w-[520px] rounded-[2rem] bg-white/5 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] backdrop-blur-md overflow-hidden flex flex-col transform transition-all duration-500 ease-out">
          
          {/* Header Section */}
          <div className="px-8 pt-12 pb-8 text-center border-b border-white/5">
            <div className="flex items-center justify-center gap-3 mb-6">
              <img src="/mpl_logo_proto.svg" alt="PT Mahkota Putra Logistik" className="w-20 h-20 drop-shadow-lg" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
              Panel <span className="text-secondary font-light italic">Administrasi</span>
            </h1>
            <p className="text-base text-gray-300">
              Pusat kendali operasional internal. Restricted access.
            </p>
          </div>

          {/* Form Section */}
          <div className="px-8 py-10">
            <h2 className="text-xl font-semibold text-white mb-8 flex items-center justify-center gap-2">
              <Icon name="admin_panel_settings" size={24} className="text-secondary" />
              <span>Login Admin</span>
            </h2>

            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
              
              {/* Email Field */}
              <div className="flex flex-col gap-2">
                <label className="text-base font-medium text-gray-200" htmlFor="admin-email">
                  Email <span className="text-red-400">*</span>
                </label>
                <div className={`relative flex items-center bg-black/20 border rounded-xl overflow-hidden transition-all duration-300 focus-within:ring-2 ${emailError ? 'border-red-500/50 focus-within:ring-red-500/30' : 'border-white/10 focus-within:border-secondary/50 focus-within:ring-secondary/20'}`}>
                  <span className="pl-5 text-gray-400">
                    <Icon name="email" size={22} />
                  </span>
                  <input
                    id="admin-email"
                    className="w-full bg-transparent text-white px-4 py-4 text-base outline-none placeholder:text-gray-400 font-body"
                    type="email"
                    placeholder="admin@mahkota.id"
                    autoComplete="email"
                    required
                    onChange={handleEmailChange}
                  />
                </div>
                {emailError && <p className="text-red-300 text-sm font-medium mt-1 pl-1">{emailError}</p>}
              </div>

              {/* Password Field */}
              <div className="flex flex-col gap-2">
                <label className="text-base font-medium text-gray-200" htmlFor="admin-password">
                  Password <span className="text-red-400">*</span>
                </label>
                <div className="relative flex items-center bg-black/20 border border-white/10 rounded-xl overflow-hidden transition-all duration-300 focus-within:border-secondary/50 focus-within:ring-2 focus-within:ring-secondary/20">
                  <span className="pl-5 text-gray-400">
                    <Icon name="lock" size={22} />
                  </span>
                  <input
                    id="admin-password"
                    className="w-full bg-transparent text-white px-4 py-4 text-base outline-none placeholder:text-gray-400 font-body"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="pr-5 text-gray-400 hover:text-white transition-colors"
                    onClick={() => setShowPw(s => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPw ? 'visibility_off' : 'visibility'} size={22} />
                  </button>
                </div>
              </div>

              {/* Login Error */}
              {loginError && (
                <div className="p-4 mt-2 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-200 text-base">
                  <Icon name="error_outline" size={20} />
                  <p>{loginError}</p>
                </div>
              )}

              {/* Forgot Password */}
              <div className="flex items-center gap-2 text-sm text-gray-300 mt-2 mb-4">
                <Icon name="info" size={16} className="text-white/60" />
                <span>Lupa kata sandi? Hubungi Super Admin Anda.</span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={`w-full relative flex items-center justify-center gap-3 bg-secondary text-primary font-bold text-lg py-4 rounded-xl shadow-[0_0_15px_rgba(242,184,36,0.3)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(242,184,36,0.5)] hover:scale-[1.02] active:scale-[0.98] ${submitting ? 'opacity-70 cursor-not-allowed hover:scale-100 hover:shadow-none' : ''}`}
                id="admin-login-btn"
                disabled={submitting}
              >
                {submitting ? 'Memproses...' : 'Masuk ke Panel Admin'}
                {!submitting && <Icon name="arrow_forward" size={22} />}
                
                {/* Button Inner Glow */}
                <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="absolute bottom-6 z-10 text-center">
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm font-medium">
          <img src="/mpl_logo_proto.svg" alt="" className="w-4 h-4 opacity-70 grayscale" /> 
          <span>© 2026 PT Mahkota Putra Logistik</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Internal Use Only.</p>
      </footer>
    </div>
  )
}
