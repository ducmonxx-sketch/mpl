import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { authAPI } from '../lib/api'
import './VerificationPage.css'

export default function VerificationPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('PENDING')
  // Pending accounts have no token (login is blocked), so we poll by the email
  // stashed at login/registration time instead of hitting an authenticated /me.
  const email =
    typeof window !== 'undefined' ? sessionStorage.getItem('mpl_pending_email') : null

  // Poll the account's verification status until it's approved (or rejected).
  useEffect(() => {
    if (!email) return
    let active = true
    const check = async () => {
      try {
        const { status: s } = await authAPI.registrationStatus(email)
        if (active && (s === 'VERIFIED' || s === 'REJECTED')) setStatus(s)
      } catch {
        /* transient network error — retry on next tick */
      }
    }
    check()
    const interval = setInterval(check, 6000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [email])

  // Once approved, clear the stash and send them to the login screen to sign in.
  useEffect(() => {
    if (status !== 'VERIFIED') return
    sessionStorage.removeItem('mpl_pending_email')
    const t = setTimeout(() => navigate('/client', { replace: true }), 3000)
    return () => clearTimeout(t)
  }, [status, navigate])

  const isVerified = status === 'VERIFIED'
  const isRejected = status === 'REJECTED'

  const subtitle = isVerified
    ? 'Akun anda telah terverifikasi!'
    : isRejected
    ? 'Pendaftaran tidak disetujui'
    : 'Akun anda sedang di-verifikasi'

  const desc = isVerified
    ? 'Selamat! Akun Anda telah disetujui admin. Anda akan diarahkan ke halaman masuk — silakan masuk untuk mengakses dashboard Anda.'
    : isRejected
    ? 'Mohon maaf, pendaftaran akun Anda belum dapat disetujui. Silakan hubungi tim dukungan kami untuk informasi lebih lanjut.'
    : 'Tim kami sedang meninjau detail pendaftaran Anda. Halaman ini akan otomatis diperbarui setelah akun Anda disetujui.'

  return (
    <div className="verify-page">
      {/* ── Header ── */}
      <header className="verify-header">
        <div className="verify-header__inner">
          <Link to="/" className="verify-header__brand">
            <img
              src="/mpl_logo_proto.svg"
              alt="PT Mahkota Putra Logistik"
              width="28"
              height="28"
            />
            <span className="verify-header__brand-text">
              Mahkota Putra Logistik
            </span>
          </Link>
          <button
            className="verify-header__help"
            aria-label="Help"
            type="button"
          >
            <Icon name="help_outline" size={20} />
          </button>
        </div>
      </header>

      {/* ── Background Decorative Elements ── */}
      <div className="verify-bg-elements" aria-hidden="true">
        <div className="verify-bg-elements__blob--gold" />
        <div className="verify-bg-elements__blob--navy" />
        <div className="verify-bg-elements__line--v" />
        <div className="verify-bg-elements__line--h" />
      </div>

      {/* ── Main Content ── */}
      <main className="verify-main">
        <div className="verify-content">
          {/* Status Illustration */}
          <div className="verify-illustration">
            <div className="verify-illustration__circle">
              {/* Background image inside circle */}
              <img
                className="verify-illustration__circle-bg"
                src="/2.webp"
                alt=""
                loading="eager"
              />
              {/* Yellow badge with status icon */}
              <div className="verify-illustration__badge">
                <Icon
                  name={isVerified ? 'check_circle' : isRejected ? 'cancel' : 'verified'}
                  size={40}
                />
              </div>
            </div>

            {/* Floating: Pending Actions */}
            <div className="verify-illustration__float-pending">
              <Icon name="pending_actions" size={22} />
            </div>

            {/* Floating: Sync */}
            <div className="verify-illustration__float-sync">
              <Icon name="sync" size={18} />
            </div>
          </div>

          {/* Text Content */}
          <h1 className="verify-title">Verification</h1>
          <div className="verify-title-bar" />

          <h2 className="verify-subtitle">{subtitle}</h2>

          <p className="verify-desc">{desc}</p>

          {/* Action Buttons */}
          <div className="verify-actions">
            {isVerified ? (
              <Link to="/client" className="verify-btn verify-btn--primary">
                <Icon name="login" size={20} />
                Masuk Sekarang
              </Link>
            ) : (
              <Link to="/" className="verify-btn verify-btn--primary">
                <Icon name="home" size={20} />
                Back to Home
              </Link>
            )}
            <a
              href="mailto:mahkotaputralogistik@yahoo.com"
              className="verify-btn verify-btn--secondary"
            >
              <Icon name="support_agent" size={20} />
              Contact Support
            </a>
          </div>

          {/* Estimation / status note */}
          <p className="verify-estimate">
            <Icon name="info" size={16} />
            {isVerified
              ? 'Mengarahkan ke halaman masuk...'
              : isRejected
              ? 'Hubungi dukungan untuk bantuan lebih lanjut.'
              : 'Estimasi waktu verifikasi: 1-2 hari kerja.'}
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="verify-footer">
        <div className="verify-footer__inner">
          <span className="verify-footer__copy">
            © 2026 Mahkota Putra Logistik. All rights reserved.
          </span>
          <nav className="verify-footer__links">
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
            <a href="#support">Contact Support</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
