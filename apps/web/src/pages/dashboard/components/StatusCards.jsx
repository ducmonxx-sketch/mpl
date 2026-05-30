import Icon from '../../../components/Icon'

export default function StatusCards() {
  return (
    <div className="dash-status-column">
      <div className="dash-status-card glass-card">
        <div className="dash-status-card__header">
          <div>
            <p className="dash-status-card__label dash-status-card__label--transit">Dalam Perjalanan</p>
            <h4 className="dash-status-card__title">Pengiriman Berjalan</h4>
          </div>
          <div className="dash-status-card__icon dash-status-card__icon--transit">
            <Icon name="sync" size={22} />
          </div>
        </div>
        <div className="dash-progress">
          <div className="dash-progress__info">
            <span>142 Unit Aktif</span><span>84%</span>
          </div>
          <div className="dash-progress__bar">
            <div className="dash-progress__fill" style={{ '--progress-percent': '84%' }} />
          </div>
        </div>
      </div>

      <div className="dash-status-card glass-card">
        <div className="dash-status-card__header">
          <div>
            <p className="dash-status-card__label dash-status-card__label--done">Terkirim</p>
            <h4 className="dash-status-card__title">Pengiriman Selesai</h4>
          </div>
          <div className="dash-status-card__icon dash-status-card__icon--done">
            <Icon name="check_circle" size={22} />
          </div>
        </div>
        <div className="dash-status-card__metric">
          <span className="dash-status-card__metric-value">2.891</span>
          <span className="dash-status-card__metric-label">Selesai hari ini</span>
        </div>
      </div>

      <div className="dash-status-card glass-card">
        <div className="dash-status-card__header">
          <div>
            <p className="dash-status-card__label dash-status-card__label--failed">Perlu Perhatian</p>
            <h4 className="dash-status-card__title">Pengiriman Gagal</h4>
          </div>
          <div className="dash-status-card__icon dash-status-card__icon--failed">
            <Icon name="warning" size={22} />
          </div>
        </div>
        {/* Tinjau Masalah removed */}
      </div>
    </div>
  )
}
