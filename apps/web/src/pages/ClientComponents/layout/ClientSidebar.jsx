import { useState } from 'react'
import Icon from '../../../components/Icon'

export const NAV_GROUPS = [
  {
    title: 'LAYANAN',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'shipments', label: 'Pengiriman', icon: 'local_shipping' },
      { id: 'tracking', label: 'Pelacakan', icon: 'location_on' },
      { id: 'history', label: 'Riwayat', icon: 'history' },
    ]
  },
  {
    title: 'TAGIHAN',
    items: [
      { id: 'invoices', label: 'Faktur', icon: 'receipt' },
    ]
  },
  {
    title: 'PENGATURAN',
    items: [
      { id: 'settings', label: 'Pengaturan', icon: 'settings' },
    ]
  }
]

function getGreeting() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return 'Selamat Pagi 🌤️'
  if (hour >= 11 && hour < 15) return 'Selamat Siang ☀️'
  if (hour >= 15 && hour < 18) return 'Selamat Sore 🌇'
  return 'Selamat Malam 🌙'
}

export default function ClientSidebar({
  sidebarOpen,
  setSidebarOpen,
  isMobile,
  activeNav,
  handleNavChange,
  handleLogout,
  onCreateShipment,
  userData
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Force expand on mobile
  const collapsed = isCollapsed && !isMobile
  
  const firstName = userData?.fullName?.split(' ')[0] || 'Klien'
  const greeting = getGreeting()

  return (
    <>
      {/* ═══ Mobile Overlay ═══ */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ═══ Sidebar ═══ */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen bg-[#002442] text-white flex flex-col z-50 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          collapsed ? 'w-20' : 'w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} shadow-2xl lg:shadow-[4px_0_24px_rgba(0,0,0,0.05)]`}
      >
        {/* Toggle Collapse Button (Desktop Only) */}
        {!isMobile && (
          <button
            onClick={() => setIsCollapsed(!collapsed)}
            className="absolute -right-3 top-8 w-6 h-6 bg-[#fec330] rounded-full text-[#002442] flex items-center justify-center shadow-md hover:scale-110 transition-transform z-10 border-2 border-[#002442]"
          >
            <Icon name={collapsed ? 'chevron_right' : 'chevron_left'} size={14} />
          </button>
        )}

        {/* Brand/Logo Header with Greeting */}
        <div className={`flex items-center ${collapsed ? 'justify-center px-0 py-8' : 'gap-4 px-6 py-6'} border-b border-white/10 transition-all duration-300 overflow-hidden`}>
          <img src="/mpl_logo_proto.svg" alt="MPL" className={`drop-shadow-xl transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-10 h-10' : 'w-12 h-12'}`} />
          
          <div className={`flex flex-col justify-center whitespace-nowrap transition-all duration-300 ${collapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
            <p className="text-[0.65rem] font-medium text-white/70 m-0 leading-tight">
              {greeting}
            </p>
            <p className="text-sm font-extrabold text-white m-0 mt-0.5 leading-tight truncate max-w-[130px]" title={firstName}>
              {firstName}
            </p>
          </div>
          
          {isMobile && (
            <button
              className="ml-auto text-white/70 hover:text-white transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <Icon name="close" size={24} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 flex flex-col gap-4 custom-scrollbar">
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={groupIdx} className="flex flex-col px-3 gap-1">
              {/* Group Title */}
              {!collapsed && (
                <p className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-widest px-4 mb-1">
                  {group.title}
                </p>
              )}
              {collapsed && <div className="h-4" /> /* spacer instead of title */}

              {group.items.map(item => {
                const isActive = activeNav === item.id;
                return (
                  <div key={item.id} className="relative group">
                    {/* Accent Pillar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-[#fec330] rounded-r-full transition-all duration-300 ${isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'}`} />
                    
                    <button
                      className={`relative w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                        isActive
                          ? 'bg-white/10 text-white'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                      onClick={() => handleNavChange(item.id)}
                    >
                      <Icon 
                        name={item.icon} 
                        size={22} 
                        className={`transition-transform duration-200 ${isActive ? 'text-[#fec330]' : 'group-hover:scale-110'}`} 
                      />
                      {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                    </button>

                    {/* Tooltip for collapsed mode */}
                    {collapsed && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-[#f8f9fa] text-[#002442] text-xs font-bold rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none before:content-[''] before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-1 before:border-4 before:border-transparent before:border-r-[#f8f9fa]">
                        {item.label}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Bottom CTA (Create Shipment & Logout) */}
        <div className="p-4 border-t border-white/10 flex flex-col gap-3 relative">
          
          {/* Create Shipment Button - Hidden per user request */}
          {false && (
            <button
              onClick={onCreateShipment}
              className={`flex items-center justify-center ${collapsed ? 'w-12 h-12 mx-auto rounded-full p-0' : 'gap-2 w-full py-3 px-4 rounded-xl'} bg-[#fec330] text-[#002442] text-sm font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md group/cta`}
            >
              <Icon name="add" size={20} className="flex-shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">Buat Pengiriman</span>}
              
              {/* Create Shipment Tooltip */}
              {collapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-1.5 bg-[#fec330] text-[#002442] text-xs font-bold rounded-lg shadow-xl opacity-0 invisible group-hover/cta:opacity-100 group-hover/cta:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none before:content-[''] before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-1 before:border-4 before:border-transparent before:border-r-[#fec330]">
                  Buat Pengiriman
                </div>
              )}
            </button>
          )}

          {/* System Online Status */}
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-2'} py-1`}>
            <div className="relative flex h-3 w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </div>
            
            <div className={`flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
              <span className="text-xs font-bold text-white leading-tight">Sistem Online</span>
              <span className="text-[0.65rem] text-gray-400">Semua layanan aktif</span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            className={`flex items-center ${collapsed ? 'justify-center w-12 mx-auto' : 'justify-center gap-2 w-full px-4'} py-3 rounded-xl bg-white/5 text-gray-300 text-sm font-bold hover:bg-red-500/10 hover:text-red-400 transition-colors group/logout relative`}
            onClick={handleLogout}
          >
            <Icon name="logout" size={18} className="flex-shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-300 ${collapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto block'}`}>Keluar</span>
            
            {/* Logout Tooltip */}
            {collapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 invisible group-hover/logout:opacity-100 group-hover/logout:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none before:content-[''] before:absolute before:top-1/2 before:-translate-y-1/2 before:-left-1 before:border-4 before:border-transparent before:border-r-red-500">
                Keluar Akun
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
