import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { notificationsAPI, adminNotificationsAPI } from '../lib/api'
import AdminNotificationPanel from './AdminComponents/components/AdminNotificationPanel'
import Icon from '../components/Icon'
import { useToast } from '../contexts/ToastContext'

// Admin sections
import OverviewSection from './AdminComponents/OverviewSection'
import ShipmentsSection from './AdminComponents/ShipmentsSection'
import ClientsSection from './AdminComponents/ClientsSection'
import DriversSection from './AdminComponents/DriversSection'
import ArmadaSection from './AdminComponents/ArmadaSection'
import InvoicesSection from './AdminComponents/InvoicesSection'
import UsersSection from './AdminComponents/UsersSection'
import TrackingSection from './dashboard/TrackingSection'

// Styles
import './ClientDashboardPage.css'
import './AdminDashboardPage.css'

const NAV_ITEMS = [
  { id: 'overview', label: 'Beranda', icon: 'dashboard' },
  { id: 'shipments', label: 'Pengiriman', icon: 'local_shipping' },
  { id: 'clients', label: 'Klien', icon: 'people' },
  { id: 'drivers', label: 'Driver', icon: 'person' },
  { id: 'armada', label: 'Armada', icon: 'directions_car' },
  { id: 'invoices', label: 'Faktur', icon: 'receipt' },
  { id: 'users', label: 'Pengguna', icon: 'admin_panel_settings' },
  { id: 'tracking', label: 'Pelacakan', icon: 'location_on' },
]

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const [activeNav, setActiveNav] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [searchQuery, setSearchQuery] = useState('')
  const [trackingId, setTrackingId] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [shipmentHighlightId, setShipmentHighlightId] = useState('')
  const searchWrapperRef = useRef(null)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Fetch notification count
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const data = await adminNotificationsAPI.list()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      } catch {
        // fallback
      }
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 8000)
    return () => clearInterval(interval)
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await adminNotificationsAPI.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {}
  }

  const handleMarkRead = async (id) => {
    try {
      await adminNotificationsAPI.markRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {}
  }

  const handleNotifNavigate = (linkTo, linkId) => {
    setShowNotifPanel(false)
    if (linkTo) {
      setActiveNav(linkTo)
      if (linkTo === 'shipments' && linkId) setShipmentHighlightId(linkId)
    }
  }

  const handleNavChange = (id) => {
    setActiveNav(id)
    if (id !== 'tracking') setTrackingId('')
    if (id !== 'shipments') setShipmentHighlightId('')
    if (isMobile) setSidebarOpen(false)
  }

  const navigateToTracking = (id) => {
    setTrackingId(id)
    setActiveNav('tracking')
  }

  const navigateToShipment = (id) => {
    setShipmentHighlightId(id)
    setActiveNav('shipments')
  }

  const handleLogout = () => {
    showToast('Berhasil keluar dari panel admin.', 'success')
    logout('/admin')
  }

  const renderSection = () => {
    switch (activeNav) {
      case 'overview': return <OverviewSection onChangeNav={handleNavChange} onNavigateToShipment={navigateToShipment} />
      case 'shipments': return <ShipmentsSection onTrackFull={navigateToTracking} highlightShipmentId={shipmentHighlightId} />
      case 'clients': return <ClientsSection />
      case 'drivers': return <DriversSection />
      case 'armada': return <ArmadaSection />
      case 'invoices': return <InvoicesSection />
      case 'users': return <UsersSection />
      case 'tracking': return <TrackingSection initialSearchQuery={trackingId} isAdmin={true} />
      default: return <OverviewSection onChangeNav={handleNavChange} onNavigateToShipment={navigateToShipment} />
    }
  }

  const displayName = user?.fullName || 'Admin Utama'
  const displayRole = user?.role || 'Super Admin'

  return (
    <div className="dashboard-page">
      {/* ═══ Mobile Overlay ═══ */}
      <div
        className={`dash-overlay${sidebarOpen ? ' dash-overlay--visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ═══ Sidebar ═══ */}
      <aside className={`dash-sidebar${sidebarOpen ? ' dash-sidebar--open' : ''}`}>
        <div className="dash-sidebar__brand">
          <img src="/mpl_logo_proto.svg" alt="MPL" className="dash-sidebar__logo" />
          <div className="dash-sidebar__brand-text">
            <h1>PT Mahkota Putra</h1>
            <p>Panel Administrasi</p>
          </div>
          {isMobile && (
            <button className="dash-sidebar__close" onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', marginLeft: 'auto', cursor: 'pointer' }}>
              <Icon name="close" size={20} />
            </button>
          )}
        </div>

        <nav className="dash-sidebar__nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`dash-nav-link${activeNav === item.id ? ' dash-nav-link--active' : ''}`}
              onClick={() => handleNavChange(item.id)}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="dash-sidebar__cta" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button className="dash-sidebar__logout-btn" onClick={handleLogout}>
            <Icon name="logout" size={16} /> Keluar Akun
          </button>
        </div>
      </aside>

      {/* ═══ Main Area ═══ */}
      <main className="dash-main">
        {/* ── Top Bar ── */}
        <header className="dash-topbar">
          <div className="dash-topbar__left">
            <button className="dash-topbar__menu-btn" onClick={() => setSidebarOpen(true)}>
              <Icon name="menu" size={24} />
            </button>
            <div className="dash-topbar__search" ref={searchWrapperRef} style={{ position: 'relative' }}>
              <span className="dash-topbar__search-icon">
                <Icon name="search" size={16} />
              </span>
              <input
                type="text"
                placeholder="Cari..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="dash-topbar__right">
            <button className="dash-topbar__icon-btn" onClick={() => setShowNotifPanel(prev => !prev)} style={{ position: 'relative' }}>
              <Icon name="notifications" size={20} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '2px', right: '2px',
                  minWidth: '18px', height: '18px', padding: '0 4px',
                  background: '#ef4444', borderRadius: '9px',
                  border: '2px solid var(--dash-surface)',
                  fontSize: '0.65rem', fontWeight: 800, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
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
            <div className="dash-topbar__divider" />
            <div className="dash-topbar__user" style={{ cursor: 'pointer' }}>
              <div className="dash-topbar__user-info">
                <p>{displayName}</p>
                <p>{displayRole}</p>
              </div>
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=fec330&color=002442&bold=true`}
                alt="Profile"
                className="dash-topbar__avatar"
              />
            </div>
          </div>
        </header>

        {/* ── Section Content ── */}
        <div key={activeNav}>
          {renderSection()}
        </div>
      </main>
    </div>
  )
}
