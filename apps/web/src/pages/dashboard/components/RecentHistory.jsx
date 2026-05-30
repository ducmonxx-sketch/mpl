import Icon from '../../../components/Icon'

export default function RecentHistory({ displayedHistory, isExpanded, onToggleExpand }) {
  return (
    <div className="dash-bottom-grid">
      <div className="dash-history-card dash-history-card--full glass-card">
        <div className="dash-history-header">
          <h3>Riwayat Terkini</h3>
          <button onClick={onToggleExpand}>
            {isExpanded ? 'Tutup' : 'Lihat Semua'}
          </button>
        </div>
        <div className="dash-history-list" style={{ transition: 'all 0.5s ease', overflow: 'hidden' }}>
          {displayedHistory.map((item) => (
            <div key={item.id} className="dash-history-item" style={{ animation: 'dashFadeUp 0.3s ease both' }}>
              <div className="dash-history-item__icon"><Icon name={item.icon} size={20} /></div>
              <div className="dash-history-item__info">
                <p className="dash-history-item__id">{item.id}</p>
                <p className="dash-history-item__desc">{item.desc}</p>
                <p className="dash-history-item__dest">Ke: {item.dest}</p>
              </div>
              <div className="dash-history-item__status">
                <p className={`dash-history-item__status-text dash-history-item__status-text--${item.statusClass}`}>{item.statusText}</p>
                <p className="dash-history-item__time">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
