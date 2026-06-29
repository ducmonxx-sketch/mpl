import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import './AdminAuthPage.css'

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
    <div className="adm-auth-page">
      {/* ── Background Layer ── */}
      <div className="adm-auth-bg" aria-hidden="true">
        <div className="adm-auth-bg__overlay" />
      </div>

      {/* ── Main Content ── */}
      <main className="adm-auth-content">
        <div className="adm-auth-card">
          {/* ── Left Panel (Branding) ── */}
          <div className="adm-auth-brand">
            <div>
              <div className="adm-auth-brand__logo">
                <img
                  src="/mpl_logo_proto.svg"
                  alt="PT Mahkota Putra Logistik"
                  width="32"
                  height="32"
                />
                <span className="adm-auth-brand__logo-text">
                  PT Mahkota Putra Logistik
                </span>
              </div>

              <h1 className="adm-auth-brand__heading">
                Command Center for <em>Operations</em>.
              </h1>

              <p className="adm-auth-brand__desc">
                Managing complex logistical networks with architectural precision and unwavering reliability. Restricted access.
              </p>
            </div>

            <div className="adm-auth-brand__bottom">
              <div className="adm-auth-brand__badge">
                <div className="adm-auth-brand__badge-icon">
                  <Icon name="admin_panel_settings" size={20} />
                </div>
                <span className="adm-auth-brand__badge-text">
                  Restricted Access • Admin Only
                </span>
              </div>
              <div className="adm-auth-brand__established">Internal Use Only</div>
            </div>
          </div>

          {/* ── Right Panel (Form) ── */}
          <div className="adm-auth-form-panel">
            <h2 className="adm-auth-form-panel__title">
              Login Admin
            </h2>
            <p className="adm-auth-form-panel__subtitle">
              Pusat kendali operasional internal. Restricted access.
            </p>

            <form className="adm-auth-form" onSubmit={handleSubmit}>
              {/* ─ Email ─ */}
              <div className="adm-auth-field">
                <label className="adm-auth-field__label" htmlFor="admin-email">
                  Email Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className={`adm-auth-field__input-wrap${emailError ? ' adm-auth-field__input-wrap--error' : ''}`}>
                  <span className="adm-auth-field__icon">
                    <Icon name="email" size={18} />
                  </span>
                  <input
                    id="admin-email"
                    className={`adm-auth-field__input${emailError ? ' adm-auth-field__input--error' : ''}`}
                    type="email"
                    placeholder="admin@mahkota.id"
                    autoComplete="email"
                    required
                    onChange={handleEmailChange}
                  />
                </div>
                {emailError && (
                  <p className="adm-auth-error">
                    <Icon name="error_outline" size={16} />
                    {emailError}
                  </p>
                )}
              </div>

              {/* ─ Password ─ */}
              <div className="adm-auth-field">
                <label className="adm-auth-field__label" htmlFor="admin-password">
                  <span>Password <span style={{ color: '#ef4444' }}>*</span></span>
                </label>
                <div className="adm-auth-field__input-wrap">
                  <span className="adm-auth-field__icon">
                    <Icon name="lock" size={18} />
                  </span>
                  <input
                    id="admin-password"
                    className="adm-auth-field__input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="adm-auth-field__toggle"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPw ? 'visibility_off' : 'visibility'} size={18} />
                  </button>
                </div>
              </div>

              {/* ─ Login Error ─ */}
              {loginError && (
                <div className="adm-auth-error" style={{ marginBottom: '1.25rem' }}>
                  <Icon name="error_outline" size={16} />
                  <p style={{ margin: 0 }}>{loginError}</p>
                </div>
              )}

              {/* ─ Forgot Password ─ */}
              <div className="adm-auth-forgot">
                <Icon name="info" size={16} />
                <span>Lupa kata sandi? Hubungi Super Admin Anda.</span>
              </div>

              {/* ─ Submit ─ */}
              <button
                type="submit"
                className="adm-auth-submit"
                id="admin-login-btn"
                disabled={submitting}
                style={submitting ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
              >
                {submitting ? 'Memproses...' : 'Masuk ke Panel Admin'}
                {!submitting && (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="adm-auth-footer">
        <div className="adm-auth-footer__inner">
          <div className="adm-auth-footer__brand">
            <img
              src="/mpl_logo_proto.svg"
              alt=""
              width="20"
              height="20"
            />
            PT Mahkota Putra Logistik
          </div>
          <span className="adm-auth-footer__copy">
            © 2026 PT Mahkota Putra Logistik. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  )
}
