import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import './VerificationPage.css'

export default function VerificationPage() {
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
                src="/2.JPG.jpeg"
                alt=""
                loading="eager"
              />
              {/* Yellow badge with shield icon */}
              <div className="verify-illustration__badge">
                <Icon name="verified" size={40} />
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

          <h2 className="verify-subtitle">
            Akun anda sedang di-verifikasi
          </h2>

          <p className="verify-desc">
            Tim kami sedang meninjau detail pendaftaran Anda untuk memastikan
            standar keamanan tertinggi. Kami akan segera memberi tahu Anda
            melalui email setelah proses selesai.
          </p>

          {/* Action Buttons */}
          <div className="verify-actions">
            <Link to="/" className="verify-btn verify-btn--primary">
              <Icon name="home" size={20} />
              Back to Home
            </Link>
            <a
              href="mailto:mahkotaputralogistik@yahoo.com"
              className="verify-btn verify-btn--secondary"
            >
              <Icon name="support_agent" size={20} />
              Contact Support
            </a>
          </div>

          {/* Estimation */}
          <p className="verify-estimate">
            <Icon name="info" size={16} />
            Estimasi waktu verifikasi: 1-2 hari kerja.
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
