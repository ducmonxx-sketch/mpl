import Icon from '../../../components/Icon'

export default function SecurityAccess({ onUpdateCredentials }) {
  return (
    <div className="settings-card glass-card">
      <div className="settings-card__header">
        <div className="settings-card__header-icon"><Icon name="shield" size={20} /></div>
        <h3>Keamanan & Akses</h3>
      </div>
      <div className="settings-security">
        <div className="settings-password">
          <p className="settings-password__title">Ubah Kata Sandi</p>
          <div className="settings-password__fields">
            <input type="password" placeholder="Kata Sandi Saat Ini" />
            <input type="password" placeholder="Kata Sandi Baru" />
          </div>
          <button className="settings-password__btn" onClick={onUpdateCredentials}>Perbarui Kredensial</button>
        </div>
      </div>
    </div>
  )
}
