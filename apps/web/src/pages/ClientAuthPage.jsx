import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import './ClientAuthPage.css'

/* Simple email format check: something@something.something */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ClientAuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [showPw, setShowPw] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { login, register } = useAuth()

  const isLogin = mode === 'login'

  const switchMode = useCallback(() => {
    setMode((m) => (m === 'login' ? 'register' : 'login'))
    setShowPw(false)
    setEmailError('')
    setFormError('')
  }, [])

  /** Validate email and handle submit */
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      const form = e.target
      const emailValue = form.elements['auth-email']?.value?.trim() || ''
      const passwordValue = form.elements['auth-password']?.value || ''

      // Email format validation
      if (!emailValue) {
        setEmailError('Email address is required.')
        return
      }
      if (!EMAIL_REGEX.test(emailValue)) {
        setEmailError('Please enter a valid email (e.g. name@mail.com).')
        return
      }

      setEmailError('')
      setFormError('')
      setSubmitting(true)

      try {
        if (!isLogin) {
          // ── Register ──
          const fullName = form.elements['auth-name']?.value?.trim() || ''
          const phoneNumber = form.elements['auth-phone']?.value?.trim() || ''

          await register({
            fullName,
            email: emailValue,
            password: passwordValue,
            phoneNumber,
          })
          console.log("success brother")
          // Registration successful → redirect to verification page
          navigate('/client/verification')
        } else {
          // ── Login ──
          await login(emailValue, passwordValue)

          // Login successful → redirect to dashboard
          navigate('/client/dashboard')
        }
      } catch (err) {
        // Handle specific error statuses
        if (err.status === 403) {
          // Account pending or rejected
          if (err.message?.toLowerCase().includes('pending')) {
            navigate('/client/verification')
            return
          }
          setFormError(err.message || 'Your account has been rejected. Please contact support.')
        } else if (err.status === 401) {
          setFormError('Email atau password salah.')
        } else if (err.status === 400) {
          setFormError(err.message || 'Email sudah terdaftar.')
        } else {
          setFormError(err.message || 'Terjadi kesalahan. Silakan coba lagi.')
        }
      } finally {
        setSubmitting(false)
      }
    },
    [isLogin, navigate, login, register]
  )

  /** Clear error on typing */
  const handleEmailChange = useCallback(() => {
    if (emailError) setEmailError('')
    if (formError) setFormError('')
  }, [emailError, formError])

  return (
    <div className="auth-page">
      {/* ── Background with breathing animation ── */}
      <div className="auth-bg" aria-hidden="true">
        <img
          className="auth-bg__img"
          src="/fresh_logistics_bg.png"
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <div className="auth-bg__overlay" />
      </div>

      {/* ── Main Content ── */}
      <main className="auth-content">
        <div className="auth-card">
          {/* ── Left: Branding Panel ── */}
          <div className="auth-brand">
            <div>
              <div className="auth-brand__logo">
                <img
                  src="/mpl_logo_proto.svg"
                  alt="PT Mahkota Putra Logistik"
                  width="32"
                  height="32"
                />
                <span className="auth-brand__logo-text">
                  Mahkota Putra Logistik
                </span>
              </div>

              <h1 className="auth-brand__heading">
                {isLogin ? (
                  <>
                    Seamless <em>Intelligence</em> for Global Supply.
                  </>
                ) : (
                  <>
                    Architectural Logistics <em>Excellence.</em>
                  </>
                )}
              </h1>

              <p className="auth-brand__desc">
                {isLogin
                  ? 'Managing complex logistical networks with architectural precision and unwavering reliability.'
                  : 'Join the network that defines precision and structural integrity in global supply chains.'}
              </p>
            </div>

            <div className="auth-brand__bottom">
              <div className="auth-brand__badge">
                <div className="auth-brand__badge-icon">
                  <Icon
                    name={isLogin ? 'shield' : 'verified'}
                    size={20}
                  />
                </div>
                <span className="auth-brand__badge-text">
                  Enterprise Grade Security &amp; Tracking
                </span>
              </div>
              <div className="auth-brand__established">Established 2026</div>
            </div>
          </div>

          {/* ── Right: Form Panel ── */}
          <div className="auth-form-panel">
            <h2 className="auth-form-panel__title">
              {isLogin ? 'Login' : 'Register'}
            </h2>
            <p className="auth-form-panel__subtitle">
              {isLogin
                ? 'Enter your credentials to access the logistics portal.'
                : 'Create your logistics partner account to get started.'}
            </p>

            {/* Form — key forces remount for animation */}
            <form
              className="auth-form"
              key={mode}
              onSubmit={handleSubmit}
            >
              {/* ─ Full Name (Register only) ─ */}
              {!isLogin && (
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="auth-name">
                    Full Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div className="auth-field__input-wrap">
                    <span className="auth-field__icon">
                      <Icon name="person" size={18} />
                    </span>
                    <input
                      id="auth-name"
                      className="auth-field__input"
                      type="text"
                      placeholder="John Doe"
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>
              )}

              {/* ─ Email ─ */}
              <div className="auth-field">
                <label className="auth-field__label" htmlFor="auth-email">
                  Email Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className={`auth-field__input-wrap${emailError ? ' auth-field__input-wrap--error' : ''}`}>
                  <span className="auth-field__icon">
                    <Icon name="email" size={18} />
                  </span>
                  <input
                    id="auth-email"
                    className={`auth-field__input${emailError ? ' auth-field__input--error' : ''}`}
                    type="email"
                    placeholder="name@mail.com"
                    autoComplete="email"
                    required
                    onChange={handleEmailChange}
                  />
                </div>
                {emailError && (
                  <p className="auth-field__error">{emailError}</p>
                )}
              </div>

              {/* ─ Phone (Register only) ─ */}
              {!isLogin && (
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="auth-phone">
                    Phone Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Country Code Dropdown */}
                    <div className="auth-field__input-wrap" style={{ flex: '0 0 auto', width: '90px' }}>
                      <select className="auth-field__input" style={{ paddingLeft: '12px', paddingRight: '24px', cursor: 'pointer', appearance: 'none', fontWeight: 600 }} defaultValue="+62">
                        <option value="+62">🇮🇩 +62</option>
                        <option value="+65">🇸🇬 +65</option>
                        <option value="+60">🇲🇾 +60</option>
                      </select>
                      <span style={{ position: 'absolute', right: '8px', pointerEvents: 'none', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: 'var(--auth-text-dim)' }}>
                        <Icon name="expand_more" size={16} />
                      </span>
                    </div>

                    {/* Phone Number Input */}
                    <div className="auth-field__input-wrap" style={{ flex: '1 1 auto' }}>
                      <span className="auth-field__icon">
                        <Icon name="phone" size={18} />
                      </span>
                      <input
                        id="auth-phone"
                        className="auth-field__input"
                        type="number"
                        placeholder="812 3456 7890"
                        autoComplete="tel"
                        required
                        onKeyDown={(e) => {
                          if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault()
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ─ Password ─ */}
              <div className="auth-field">
                <label className="auth-field__label" htmlFor="auth-password">
                  <span>Password <span style={{ color: '#ef4444' }}>*</span></span>
                  {isLogin && (
                    <a className="auth-field__forgot" href="#forgot">
                      Forgot Password?
                    </a>
                  )}
                </label>
                <div className="auth-field__input-wrap">
                  <span className="auth-field__icon">
                    <Icon name="lock" size={18} />
                  </span>
                  <input
                    id="auth-password"
                    className="auth-field__input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete={
                      isLogin ? 'current-password' : 'new-password'
                    }
                    required
                  />
                  <button
                    type="button"
                    className="auth-field__toggle-pw"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPw ? 'visibility_off' : 'visibility'} size={18} />
                  </button>
                </div>
              </div>

              {/* ─ Form Error ─ */}
              {formError && (
                <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0 0 0.5rem', fontWeight: 600 }}>
                  {formError}
                </p>
              )}

              {/* ─ Checkbox ─ */}
              <label className="auth-checkbox">
                <input type="checkbox" id="auth-agree" />
                <span className="auth-checkbox__text">
                  {isLogin ? (
                    'Remember this device'
                  ) : (
                    <>
                      By creating an account, I agree to the{' '}
                      <a href="#terms">Terms of Service</a> and{' '}
                      <a href="#privacy">Privacy Policy</a>.
                    </>
                  )}
                </span>
              </label>

              {/* ─ Submit ─ */}
              <button
                type="submit"
                className="auth-submit"
                id="auth-submit-btn"
                disabled={submitting}
                style={submitting ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
              >
                {submitting ? 'Loading...' : isLogin ? 'Login' : 'Create Account'}
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

            {/* ─ Divider ─ */}
            <div className="auth-divider">
              <span className="auth-divider__line" />
            </div>

            {/* ─ Switch mode ─ */}
            <div className="auth-switch">
              {isLogin
                ? "Don't have an account?"
                : 'Already have an account?'}
              <button
                type="button"
                className="auth-switch__btn"
                onClick={switchMode}
              >
                {isLogin ? 'Contact Administrator' : 'Login'}
                {!isLogin && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="auth-footer">
        <div className="auth-footer__inner">
          <div className="auth-footer__brand">
            <img
              src="/mpl_logo_proto.svg"
              alt=""
              width="20"
              height="20"
            />
            Mahkota Putra Logistik
          </div>
          <div className="auth-footer__links">
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
            <a href="#support">Contact Support</a>
          </div>
          <span className="auth-footer__copy">
            © 2026 Mahkota Putra Logistik. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  )
}
