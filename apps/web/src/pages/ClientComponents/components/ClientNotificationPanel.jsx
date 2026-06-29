import Icon from '../../../components/Icon'
import { useState } from 'react'

const CATEGORY_STYLES = {
  shipment: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'local_shipping' },
  tracking: { bg: 'bg-teal-50', text: 'text-teal-600', icon: 'location_on' },
  invoice: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'receipt' },
  alert: { bg: 'bg-red-50', text: 'text-red-600', icon: 'warning' },
}

const CATEGORY_LABELS = {
  shipment: 'Pengiriman',
  tracking: 'Pelacakan',
  invoice: 'Faktur',
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

export default function ClientNotificationPanel({
  notifications = [],
  onMarkAllRead,
  onMarkRead,
  onDelete,
  onNavigate,
  onClose
}) {
  const [deletingId, setDeletingId] = useState(null)
  return (
    <div className="absolute top-full right-0 mt-4 w-80 md:w-96 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,36,66,0.15)] border border-gray-100 overflow-hidden z-50 transform origin-top-right transition-all">
      
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
                  className={`relative p-4 flex gap-4 cursor-pointer hover:bg-[#002442]/[0.02] transition-colors group ${
                    !notif.isRead ? 'bg-[#fec330]/[0.04]' : ''
                  }`}
                  onClick={() => {
                    if (deletingId === notif.id) return;
                    if (!notif.isRead) onMarkRead(notif.id)
                    if (onNavigate) {
                      onNavigate(notif.linkTo, notif.linkId)
                      if (onClose) onClose()
                    }
                  }}
                >
                  {/* Inline Delete Confirmation */}
                  {deletingId === notif.id ? (
                    <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                      <p className="text-sm font-bold text-gray-800 mb-2">Hapus notifikasi ini?</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDelete(notif.id); setDeletingId(null); }}
                          className="px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors"
                        >
                          Ya, Hapus
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                          className="px-3 py-1 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Delete Button (X) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(notif.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-md text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all z-20"
                    title="Hapus Notifikasi"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
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
    </div>
  )
}
