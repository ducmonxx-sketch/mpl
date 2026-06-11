import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usersAPI } from '../lib/api'
import Icon from '../components/Icon'
import './MagicLinkPage.css'

export default function MagicLinkPage() {
  const { token } = useParams()
  
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    fullName: '',
    companyName: '',
    password: '',
    confirmPassword: ''
  })
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Validate token on mount
  useEffect(() => {
    async function validate() {
      try {
        const res = await usersAPI.validateMagicLink(token)
        setFormData(prev => ({
          ...prev,
          companyName: res.companyName || ''
        }))
        setLoading(false)
      } catch (err) {
        setError(err.message || 'Link tidak valid atau sudah kadaluarsa.')
        setLoading(false)
      }
    }
    validate()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      setError('Password dan Konfirmasi Password tidak cocok.')
      return
    }

    setVerifying(true)
    setError('')
    try {
      await usersAPI.registerViaMagicLink(token, {
        fullName: formData.fullName,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Gagal mendaftar. Silakan coba lagi.')
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <div className="ml-page">
        <div className="ml-bg">
          <div className="ml-bg__overlay"></div>
        </div>
        <div className="ml-content">
          <div className="ml-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <Icon name="progress_activity" size={40} className="spinning" style={{ color: '#fec330', margin: '0 auto 1rem' }} />
            <p style={{ color: '#fff' }}>Memvalidasi link...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ml-page">
      <div className="ml-bg">
        <div className="ml-bg__overlay"></div>
      </div>
      
      <div className="ml-content">
        <div className="ml-card">
          <div className="ml-brand">
            <div className="ml-brand__logo">
              <img src="/logo.png" alt="MPL Logo" onError={(e) => e.target.style.display = 'none'} />
              <span className="ml-brand__logo-text">MPL LOGISTICS</span>
            </div>
            <h1 className="ml-brand__heading">Pendaftaran Akun</h1>
            <p className="ml-brand__desc">Lengkapi profil Anda untuk mengakses dashboard klien.</p>
          </div>

          <div className="ml-form-panel">
            {success ? (
              <div className="ml-global-success">
                <p>Akun berhasil dibuat!</p>
                <Link to="/client" className="ml-link-btn">
                  Ke Halaman Login <Icon name="arrow_forward" size={18} />
                </Link>
              </div>
            ) : (
              <>
                {error && <div className="ml-global-error">{error}</div>}
                
                <form className="ml-form" onSubmit={handleSubmit}>
                  <div className="ml-field">
                    <label className="ml-field__label">Nama Lengkap</label>
                    <div className="ml-field__input-wrap">
                      <div className="ml-field__icon"><Icon name="person" size={20} /></div>
                      <input
                        type="text"
                        required
                        className="ml-field__input"
                        placeholder="Masukkan nama lengkap"
                        value={formData.fullName}
                        onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="ml-field">
                    <label className="ml-field__label">Nama Perusahaan</label>
                    <div className="ml-field__input-wrap">
                      <div className="ml-field__icon"><Icon name="business" size={20} /></div>
                      <input
                        type="text"
                        readOnly
                        className="ml-field__input"
                        value={formData.companyName}
                      />
                    </div>
                  </div>

                  <div className="ml-field">
                    <label className="ml-field__label">Password</label>
                    <div className="ml-field__input-wrap">
                      <div className="ml-field__icon"><Icon name="lock" size={20} /></div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        className="ml-field__input"
                        placeholder="Buat password"
                        value={formData.password}
                        onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="ml-field__toggle"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="ml-field">
                    <label className="ml-field__label">Konfirmasi Password</label>
                    <div className="ml-field__input-wrap">
                      <div className="ml-field__icon"><Icon name="lock" size={20} /></div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        className="ml-field__input"
                        placeholder="Ulangi password"
                        value={formData.confirmPassword}
                        onChange={e => setFormData(p => ({ ...p, confirmPassword: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="ml-field__toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        <Icon name={showConfirmPassword ? 'visibility_off' : 'visibility'} size={20} />
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="ml-submit" disabled={verifying || !!error && !formData.companyName}>
                    {verifying ? 'Memproses...' : 'Register'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
