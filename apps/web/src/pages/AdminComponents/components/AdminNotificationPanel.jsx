import Icon from '../../../components/Icon'

const CATEGORY_STYLES = {
  shipment: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'local_shipping' },
  client: { bg: 'bg-yellow-50', text: 'text-yellow-600', icon: 'business' },
  driver: { bg: 'bg-green-50', text: 'text-green-600', icon: 'person' },
  armada: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'directions_car' },
  invoice: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'receipt_long' },
  tracking: { bg: 'bg-teal-50', text: 'text-teal-600', icon: 'my_location' },
  alert: { bg: 'bg-red-50', text: 'text-red-600', icon: 'warning' },
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
  if (minutes < 60) return `${minutes}m lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}j lalu`
  return `${Math.floor(hours / 24)}h lalu`
}

export default function AdminNotificationPanel({
  notifications = [],
  onMarkAllRead,
  onMarkRead,
  onNavigate,
  onClose
}) {
  return (
    <div className="absolute top-full right-0 mt-4 w-80 md:w-96 bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,36,66,0.15)] border border-gray-100 overflow-hidden z-50 transform origin-top-right transition-all">
      
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white/50">
        <h3 className="text-base font-bold text-[#002442]">Notifikasi</h3>
        {notifications.some(n => !n.isRead) && (
          <button 
            onClick={onMarkAllRead} 
            className="text-xs font-bold text-[#fec330] hover:text-[#d9a320] transition-colors"
          >
            Tandai semua dibaca
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[28rem] overflow-y-auto custom-scrollbar">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-gray-400">
            <Icon name="notifications_none" size={40} className="mb-3 opacity-50" />
            <p className="text-sm font-medium">Tidak ada notifikasi baru.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50/50">
            {notifications.map(notif => {
              const style = CATEGORY_STYLES[notif.category] || { bg: 'bg-gray-50', text: 'text-gray-500', icon: 'notifications' }
              return (
                <div 
                  key={notif.id}
                  className={`relative p-4 flex gap-4 cursor-pointer hover:bg-[#002442]/[0.02] transition-colors ${
                    !notif.isRead ? 'bg-[#fec330]/[0.04]' : ''
                  }`}
                  onClick={() => {
                    if (!notif.isRead) onMarkRead(notif.id)
                    onNavigate(notif.linkTo, notif.linkId)
                  }}
                >
                  {/* Unread indicator line */}
                  {!notif.isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#fec330]" />
                  )}

                  {/* Icon Box */}
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${style.bg} ${style.text}`}>
                    <Icon name={style.icon} size={20} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <p className={`text-sm font-bold truncate ${!notif.isRead ? 'text-[#002442]' : 'text-gray-700'}`}>
                        {notif.title}
                      </p>
                      <span className="shrink-0 text-[0.65rem] font-bold text-gray-400">
                        {timeAgo(notif.createdAt)}
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-2">
                      {notif.message}
                    </p>
                    
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}>
                      {CATEGORY_LABELS[notif.category] || notif.category}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer (Optional / can be removed if not needed, but adds a nice touch) */}
      {notifications.length > 0 && (
        <div className="p-3 bg-gray-50/80 border-t border-gray-100 text-center">
          <button 
            onClick={() => onNavigate('overview')}
            className="text-xs font-bold text-gray-500 hover:text-[#002442] transition-colors"
          >
            Lihat semua aktivitas di beranda
          </button>
        </div>
      )}
    </div>
  )
}
