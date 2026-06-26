import Icon from '../../../components/Icon'

export default function NotificationSettings({ notifs, onToggle }) {
  return (
    <div className="settings-card glass-card">
      <div className="settings-card__header">
        <div className="settings-card__header-icon"><Icon name="notifications" size={20} /></div>
        <h3>Media Notifikasi</h3>
      </div>
      <p className="settings-notif-desc">Pilih di channel mana Anda ingin menerima pembaruan terkait pengiriman, laporan, dan keuangan.</p>
      <div className="settings-notifs">
        <div className="settings-notif-group" style={{ marginTop: '1rem' }}>
          <div className="settings-notif-items">
            
            {/* Email Toggle */}
            <div className="settings-notif-item">
              <div className="settings-notif-item__text flex gap-3 items-center">
                <div className="bg-[#e0e7ff] text-[#4f46e5] p-2 rounded-full flex">
                   <Icon name="email" size={18} />
                </div>
                <div>
                  <span className="font-bold">Pembaruan Email</span>
                  <p className="settings-notif-item__desc">Terima dokumen resmi dan struk</p>
                </div>
              </div>
              <label className="settings-switch settings-switch--sm">
                <input type="checkbox" checked={notifs.emailEnabled} onChange={() => onToggle('emailEnabled')} />
                <span className="settings-switch__slider" />
              </label>
            </div>

            {/* WA Toggle */}
            <div className="settings-notif-item" style={{ marginTop: '1rem' }}>
              <div className="settings-notif-item__text flex gap-3 items-center">
                <div className="bg-[#dcfce7] text-[#16a34a] p-2 rounded-full flex">
                   <Icon name="chat" size={18} />
                </div>
                <div>
                  <span className="font-bold">Pembaruan WhatsApp</span>
                  <p className="settings-notif-item__desc">Terima pelacakan real-time instan</p>
                </div>
              </div>
              <label className="settings-switch settings-switch--sm settings-switch--gold">
                <input type="checkbox" checked={notifs.waEnabled} onChange={() => onToggle('waEnabled')} />
                <span className="settings-switch__slider" />
              </label>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
