import Icon from '../../../components/Icon'

export default function CompanyProfile({ saving, onSave }) {
  return (
    <div className="settings-card glass-card">
      <div className="settings-card__accent" />
      <div className="settings-card__header">
        <div className="settings-card__header-icon"><Icon name="business" size={20} /></div>
        <h3>Profil Perusahaan</h3>
      </div>
      <div className="settings-profile">
        <div className="settings-profile__avatar-wrap">
          <div className="settings-profile__avatar">
            <img src="/mpl_logo_proto.svg" alt="Logo Perusahaan" />
            <div className="settings-profile__avatar-overlay">
              <Icon name="add_a_photo" size={18} />
              <span>Ubah</span>
            </div>
          </div>
        </div>
        <div className="settings-profile__fields">
          <div className="settings-field">
            <label>Nama Perusahaan</label>
            <input type="text" defaultValue="PT Mahkota Putra Logistik" />
          </div>
          <div className="settings-field">
            <label>Nomor Induk Berusaha (NIB)</label>
            <input type="text" defaultValue="912000-834-291" />
          </div>
        </div>
      </div>
      <div className="settings-profile__row">
        <div className="settings-field">
          <label>Kontak Person</label>
          <input type="text" defaultValue="Ananditha Putri" />
        </div>
        <div className="settings-field">
          <label>Email Resmi</label>
          <input type="email" defaultValue="ops@mahkotaputra.com" />
        </div>
      </div>
      <div className="settings-profile__row">
        <div className="settings-field">
          <label>Nomor Telepon</label>
          <input type="tel" defaultValue="+62 812 9116 6006" />
        </div>
        <div className="settings-field">
          <label>Alamat Kantor</label>
          <input type="text" defaultValue="Jl. Raya Bogor Km. 29, Jakarta Timur" />
        </div>
      </div>
      <div className="settings-card__actions">
        <button 
          className="settings-save-btn" 
          onClick={onSave}
          disabled={saving}
          style={{ opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Perubahan Profil'}
        </button>
      </div>
    </div>
  )
}
