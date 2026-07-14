import Icon from '../../../components/Icon'
import AdminNotificationPanel from '../components/AdminNotificationPanel'

export default function AdminTopbar({
  setSidebarOpen,
  searchWrapperRef, // kept to prevent breaking prop
  notifWrapperRef,
  searchQuery,      // kept to prevent breaking prop
  setSearchQuery,   // kept to prevent breaking prop
  showNotifPanel,
  setShowNotifPanel,
  unreadCount,
  notifications,
  handleMarkAllRead,
  handleMarkRead,
  handleDeleteNotif,
  handleNotifNavigate
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-4 md:px-8 md:py-6 bg-[#f8f9fa]/80 backdrop-blur-xl border-b border-gray-200 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
      
      {/* ── Left side: Mobile menu ── */}
      <div className="flex items-center gap-4 flex-1">
        <button 
          className="lg:hidden p-2 rounded-xl text-[#002442] hover:bg-[#002442]/5 transition-colors"
          onClick={() => setSidebarOpen(true)}
        >
          <Icon name="menu" size={28} />
        </button>
      </div>

      {/* ── Right side: Notifications & Profile ── */}
      <div className="flex items-center gap-6 lg:gap-8">
        
        {/* Notifications */}
        <div className="relative" ref={notifWrapperRef}>
          <button 
            className="relative p-3 rounded-full text-gray-500 hover:text-[#002442] hover:bg-gray-100 transition-colors"
            onClick={() => setShowNotifPanel(prev => !prev)}
          >
            <Icon name="notifications" size={26} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[20px] h-[20px] px-1 bg-red-500 rounded-full border-2 border-white text-[0.7rem] font-bold text-white flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          
          {showNotifPanel && (
            <AdminNotificationPanel
              notifications={notifications}
              onMarkAllRead={handleMarkAllRead}
              onMarkRead={handleMarkRead}
              onDelete={handleDeleteNotif}
              onNavigate={handleNotifNavigate}
              onClose={() => setShowNotifPanel(false)}
            />
          )}
        </div>

      </div>
    </header>
  )
}
