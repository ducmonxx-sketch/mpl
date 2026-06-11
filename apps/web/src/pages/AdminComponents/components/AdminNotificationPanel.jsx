import Icon from '../../../components/Icon'

const CATEGORY_COLORS = {
  shipment: '#3b82f6',   // blue
  client: '#eab308',     // yellow
  driver: '#22c55e',     // green
  armada: '#f97316',     // orange
  invoice: '#8b5cf6',    // purple
  tracking: '#14b8a6',   // teal
  alert: '#ef4444',      // red
}

const CATEGORY_LABELS = {
  shipment: 'Pengiriman',
  client: 'Klien',
  driver: 'Driver',
  armada: 'Armada',
  invoice: 'Faktur',
  tracking: 'Pelacakan',
  alert: 'Peringatan',
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes}m yang lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}j yang lalu`
  return `${Math.floor(hours / 24)}h yang lalu`
}

export default function AdminNotificationPanel({
  notifications = [],
  onMarkAllRead,
  onMarkRead,
  onNavigate,
  onClose
}) {
  return (
    <div className="adm-notif-panel">
      <div className="adm-notif-header">
        <h3>Notifikasi</h3>
        {notifications.some(n => !n.isRead) && (
          <button onClick={onMarkAllRead} className="adm-notif-mark-all">
            Tandai semua dibaca
          </button>
        )}
      </div>

      <div className="adm-notif-list">
        {notifications.length === 0 ? (
          <div className="adm-notif-empty">
            <Icon name="notifications_none" size={32} />
            <p>Tidak ada notifikasi baru.</p>
          </div>
        ) : (
          notifications.map(notif => (
            <div 
              key={notif.id}
              className={`adm-notif-item ${notif.isRead ? '' : 'adm-notif-item--unread'}`}
              onClick={() => {
                if (!notif.isRead) onMarkRead(notif.id)
                onNavigate(notif.linkTo, notif.linkId)
              }}
            >
              <div 
                className="adm-notif-dot"
                style={{ backgroundColor: CATEGORY_COLORS[notif.category] || '#94a3b8' }}
              />
              <div className="adm-notif-content">
                <div className="adm-notif-title-row">
                  <span className="adm-notif-title">{notif.title}</span>
                  <span className="adm-notif-time">{timeAgo(notif.createdAt)}</span>
                </div>
                <p className="adm-notif-message">{notif.message}</p>
                <span className="adm-notif-category-label" style={{ color: CATEGORY_COLORS[notif.category] || '#94a3b8' }}>
                  {CATEGORY_LABELS[notif.category] || notif.category}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
