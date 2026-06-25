import Icon from '../../../components/Icon'
import AdminNotificationPanel from '../components/AdminNotificationPanel'

export default function AdminTopbar({
  setSidebarOpen,
  searchWrapperRef, // kept to prevent breaking prop
  searchQuery,      // kept to prevent breaking prop
  setSearchQuery,   // kept to prevent breaking prop
  showNotifPanel,
  setShowNotifPanel,
  unreadCount,
  notifications,
  handleMarkAllRead,
  handleMarkRead,
  handleNotifNavigate,
  displayName,
  displayRole,
  onProfileClick
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-6 bg-[#f8f9fa]/80 backdrop-blur-xl border-b border-gray-200 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
      
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
        <div className="relative">
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
              onNavigate={handleNotifNavigate}
              onClose={() => setShowNotifPanel(false)}
            />
          )}
        </div>

        <div className="hidden sm:block w-px h-10 bg-gray-200" />

        {/* User Profile */}
        <div className="flex items-center gap-4 cursor-pointer group" onClick={onProfileClick}>
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-base font-bold text-[#002442] leading-tight group-hover:text-[#fec330] transition-colors">{displayName}</p>
            <p className="text-sm text-gray-500 font-medium">{displayRole}</p>
          </div>
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=fec330&color=002442&bold=true`}
            alt="Profile"
            className="w-12 h-12 rounded-full border-2 border-white shadow-sm transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        
      </div>
    </header>
  )
}
