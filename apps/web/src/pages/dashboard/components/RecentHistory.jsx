import Icon from '../../../components/Icon'

export default function RecentHistory({ displayedHistory, isExpanded, onToggleExpand }) {
  return (
    <div className="dash-bottom-grid">
      <div className="dash-history-card dash-history-card--full glass-card">
        <div className="dash-history-header">
          <h3>Riwayat Terkini</h3>
          <button className="dash-ghost-btn" onClick={onToggleExpand}>
            {isExpanded ? 'Tutup' : 'Lihat Semua'}
          </button>
        </div>
        <div className="dash-table-container" style={{ transition: 'max-height 0.5s ease', overflowX: 'auto', overflowY: 'hidden' }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th>ID Pengiriman</th>
                <th>Tanggal</th>
                <th>Jenis Paket</th>
                <th>Tujuan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedHistory.map((item, index) => (
                <tr key={item.id} style={{ animation: `dashFadeUp 0.3s ease forwards ${index * 0.05}s`, opacity: 0 }}>
                  <td className="dash-table-cell--id">
                    <div className="dash-table-id-wrapper">
                      <Icon name={item.icon} size={16} />
                      <span>{item.id}</span>
                    </div>
                  </td>
                  <td>{item.time}</td>
                  <td>{item.desc}</td>
                  <td className="dash-table-cell--dest">{item.dest}</td>
                  <td>
                    <span className={`dash-status-pill dash-status-pill--${item.statusClass}`}>
                      {item.statusText}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
