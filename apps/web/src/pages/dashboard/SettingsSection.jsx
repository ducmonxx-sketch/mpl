import { useState, useEffect } from 'react'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import { usersAPI } from '../../lib/api'
import CompanyProfile from './components/CompanyProfile'
import SecurityAccess from './components/SecurityAccess'
import NotificationSettings from './components/NotificationSettings'
import DangerZone from './components/DangerZone'
import DeactivateModal from './components/DeactivateModal'

export default function SettingsSection() {
  const { showToast } = useToast()
  const { user, refreshProfile } = useAuth()
  
  const [notifs, setNotifs] = useState({
    emailEnabled: true,
    waEnabled: true,
  })

  const [saving, setSaving] = useState(false)

  // Load user settings from API
  useEffect(() => {
    async function loadSettings() {
      try {
        const { user: profile } = await usersAPI.getMe()
        if (profile?.settings) {
          setNotifs({
            emailEnabled: profile.settings.emailNotifications ?? true,
            waEnabled: profile.settings.whatsappNotifications ?? true,
          })
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
    }
    loadSettings()
  }, [])

  const toggleNotif = async (key) => {
    const newNotifs = { ...notifs, [key]: !notifs[key] }
    setNotifs(newNotifs)
    
    try {
      await usersAPI.updateSettings({
        emailNotifications: newNotifs.emailEnabled,
        whatsappNotifications: newNotifs.waEnabled,
      })
      showToast('Pengaturan notifikasi berhasil diperbarui.', 'success')
    } catch (err) {
      // Revert on error
      setNotifs(notifs)
      showToast('Gagal memperbarui pengaturan notifikasi.', 'error')
    }
  }

  const handleUpdateSettings = async () => {
    setSaving(true)
    showToast('Menyimpan pengaturan...', 'info')
    
    try {
      // Get form values from the CompanyProfile component
      // The CompanyProfile component uses uncontrolled inputs with default values
      const nameInput = document.getElementById('company-name')
      const companyInput = document.getElementById('company-company')
      const phoneInput = document.getElementById('company-phone')

      const updateData = {}
      if (nameInput?.value) updateData.fullName = nameInput.value
      if (companyInput?.value) updateData.companyName = companyInput.value
      if (phoneInput?.value) updateData.phoneNumber = phoneInput.value

      await usersAPI.updateMe(updateData)
      await refreshProfile()
      
      setSaving(false)
      showToast('Profil Perusahaan berhasil diperbarui!', 'success')
    } catch (err) {
      setSaving(false)
      showToast('Gagal memperbarui profil.', 'error')
    }
  }

  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [consentChecked, setConsentChecked] = useState(false)

  const handleDeactivateRequest = () => {
    setShowDeactivateModal(true)
    setCaptchaToken(null)
    setConsentChecked(false)
  }

  const submitDeactivateRequest = () => {
    if (!consentChecked || !captchaToken) return
    showToast('Permintaan penonaktifan berhasil dikirim ke Admin untuk ditinjau.', 'success')
    setShowDeactivateModal(false)
  }

  return (
    <div className="dash-content">
      <section className="dash-header" style={{ marginBottom: '0.5rem' }}>
        <div>
          <h2 className="dash-header__title">Pengaturan Akun</h2>
          <p className="dash-header__subtitle">Kelola profil perusahaan, keamanan, dan notifikasi operasional Anda.</p>
        </div>
      </section>

      <div className="settings-grid">
        {/* ── Left Column ── */}
        <div className="settings-col settings-col--main">
          <CompanyProfile saving={saving} onSave={handleUpdateSettings} userData={user} />
          <SecurityAccess onUpdateCredentials={() => showToast('Kredensial keamanan berhasil diperbarui.', 'success')} />
        </div>

        {/* ── Right Column ── */}
        <div className="settings-col settings-col--side">
          <NotificationSettings notifs={notifs} onToggle={toggleNotif} />
          <DangerZone onDeactivateRequest={handleDeactivateRequest} />
        </div>
      </div>

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <DeactivateModal
          consentChecked={consentChecked}
          captchaToken={captchaToken}
          onConsentChange={setConsentChecked}
          onCaptchaVerify={(token) => setCaptchaToken(token)}
          onCaptchaError={() => setCaptchaToken(null)}
          onSubmit={submitDeactivateRequest}
          onCancel={() => setShowDeactivateModal(false)}
        />
      )}
    </div>
  )
}
