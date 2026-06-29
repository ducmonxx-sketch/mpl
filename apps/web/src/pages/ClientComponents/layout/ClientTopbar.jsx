import Icon from '../../../components/Icon'
import ClientNotificationPanel from '../components/ClientNotificationPanel'

export default function ClientTopbar({
  setSidebarOpen,
  searchWrapperRef,
  notifWrapperRef,
  searchQuery,
  setSearchQuery,
  showSearchDropdown,
  setShowSearchDropdown,
  searchResults,
  handleSearchSelect,
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
    <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-6 bg-[#f8f9fa]/80 backdrop-blur-xl border-b border-gray-200 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
      
      {/* ── Left side: Mobile menu & Search ── */}
      <div className="flex items-center gap-4 flex-1">
        <button 
          className="lg:hidden p-2 rounded-xl text-[#002442] hover:bg-[#002442]/5 transition-colors"
          onClick={() => setSidebarOpen(true)}
        >
          <Icon name="menu" size={28} />
        </button>

        {/* Search Input Box */}
        <div className="relative hidden md:block" ref={searchWrapperRef}>
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon name="search" size={18} />
          </span>
          <input
            type="text"
            placeholder="Cari pengiriman..."
            value={searchQuery}
            onFocus={() => setShowSearchDropdown(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 pl-12 pr-6 py-2.5 bg-white/50 border border-gray-200 focus:border-[#fec330] focus:bg-white focus:ring-4 focus:ring-[#fec330]/10 rounded-full text-sm font-medium outline-none transition-all"
          />

          {/* Search Dropdown Results */}
          {showSearchDropdown && searchQuery.trim() && (
            <div className="absolute top-[115%] left-0 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {searchResults.length > 0 ? (
                searchResults.map(res => (
                  <div 
                    key={res.id} 
                    onClick={() => handleSearchSelect(res.id)} 
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-b-0 transition-colors"
                  >
                    <Icon name="local_shipping" size={20} className="text-gray-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#002442] truncate m-0">{res.id}</p>
                      <p className="text-xs text-gray-500 truncate m-0">{res.packageType}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-4 text-center text-sm text-gray-400">Tidak ditemukan</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right side: Notifications ── */}
      <div className="flex items-center gap-6 lg:gap-8">
        
        {/* Notifications */}
        <div className="relative" ref={notifWrapperRef}>
          <button 
            className="relative p-3 rounded-full text-gray-400 hover:text-[#002442] hover:bg-gray-100 transition-colors"
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
            <ClientNotificationPanel
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
