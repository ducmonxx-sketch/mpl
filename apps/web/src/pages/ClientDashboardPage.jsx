import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { shipmentsAPI } from '../lib/api'
import Icon from '../components/Icon'
import DashboardSection from './dashboard/DashboardSection'
import ShipmentsSection from './dashboard/ShipmentsSection'
import TrackingSection from './dashboard/TrackingSection'
import HistorySection from './dashboard/HistorySection'
import SettingsSection from './dashboard/SettingsSection'
import InvoicesSection from './dashboard/InvoicesSection'
import CreateShipmentModal from '../components/ClientComponents/CreateShipmentModal'
import './ClientDashboardPage.css'

export default function ClientDashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [trackingId, setTrackingId] = useState('')
  const searchWrapperRef = useRef(null)

  // Refresh trigger for child sections after shipment creation
  const [refreshKey, setRefreshKey] = useState(0)

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Search shipments from API
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const data = await shipmentsAPI.list()
        const filtered = (data.shipments || []).filter(s =>
          s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.packageType.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 5)
        setSearchResults(filtered)
      } catch {
        setSearchResults([])
      }
    }, 300) // debounce

    return () => clearTimeout(timer)
  }, [searchQuery])

  const navItems = [
    { id: 'dashboard', label: 'Dasbor', icon: 'dashboard' },
    { id: 'invoices', label: 'Faktur', icon: 'receipt' },
    { id: 'shipments', label: 'Pengiriman', icon: 'local_shipping' },
    { id: 'tracking', label: 'Pelacakan', icon: 'location_on' },
    { id: 'history', label: 'Riwayat', icon: 'history' },
    { id: 'settings', label: 'Pengaturan', icon: 'settings' },
  ]

  const navigateToTracking = (id) => {
    setTrackingId(id)
    setActiveNav('tracking')
  }

  const handleShipmentCreated = () => {
    setCreateModalOpen(false)
    setRefreshKey(k => k + 1)
  }

  const renderSection = () => {
    switch (activeNav) {
      case 'dashboard': return <DashboardSection key={refreshKey} />
      case 'invoices': return <InvoicesSection />
      case 'shipments': return <ShipmentsSection key={refreshKey} onCreateShipment={() => setCreateModalOpen(true)} onTrackFull={navigateToTracking} onChangeNav={setActiveNav} />
      case 'tracking': return <TrackingSection initialSearchQuery={trackingId} />
      case 'history': return <HistorySection key={refreshKey} />
      case 'settings': return <SettingsSection />
      default: return <DashboardSection key={refreshKey} />
    }
  }

  const handleSearchSelect = (id) => {
    setShowSearchDropdown(false)
    setSearchQuery('')
    navigateToTracking(id)
  }

  const handleLogout = () => {
    logout('/client')
  }

  // Build display name from user data
  const displayName = user?.fullName || 'User'
  const displayRole = user?.companyName || 'Klien'

  return (
    <div className="dashboard-page">
      {/* ═══ Mobile Overlay ═══ */}
      <div
        className={`dash-overlay${sidebarOpen ? ' dash-overlay--visible' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* ═══ Sidebar ═══ */}
      <aside className={`dash-sidebar${sidebarOpen ? ' dash-sidebar--open' : ''}`}>
        <div className="dash-sidebar__brand">
          <img src="/mpl_logo_proto.svg" alt="PT Mahkota Putra Logistik" className="dash-sidebar__logo" />
          <div className="dash-sidebar__brand-text">
            <h1>PT Mahkota Putra Logistik</h1>
            <p>Dasbor Klien</p>
          </div>
        </div>

        <nav className="dash-sidebar__nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`dash-nav-link${activeNav === item.id ? ' dash-nav-link--active' : ''}`}
              onClick={() => {
                setActiveNav(item.id)
                if (item.id !== 'tracking') setTrackingId('')
                closeSidebar()
              }}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="dash-sidebar__cta" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button className="dash-sidebar__cta-btn" onClick={() => setCreateModalOpen(true)}>
            Buat Pengiriman
          </button>
          
          <button 
            className="dash-sidebar__logout-btn" 
            onClick={handleLogout}
          >
            <Icon name="logout" size={16} /> Keluar Akun
          </button>
        </div>
      </aside>

      {/* ═══ Main Content ═══ */}
      <main className="dash-main">
        {/* ── Top Bar ── */}
        <header className="dash-topbar">
          <div className="dash-topbar__left">
            <button className="dash-topbar__menu-btn" onClick={toggleSidebar}>
              <Icon name="menu" size={24} />
            </button>
            <div className="dash-topbar__search" ref={searchWrapperRef} style={{ position: 'relative' }}>
              <span className="dash-topbar__search-icon">
                <Icon name="search" size={16} />
              </span>
              <input
                type="text"
                placeholder="Cari pengiriman..."
                value={searchQuery}
                onFocus={() => setShowSearchDropdown(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {/* Search Dropdown */}
              {showSearchDropdown && searchQuery.trim() && (
                <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: 'var(--dash-surface)', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 50, border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                  {searchResults.length > 0 ? (
                    searchResults.map(res => (
                      <div key={res.id} onClick={() => handleSearchSelect(res.id)} style={{ cursor: 'pointer', padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.05)' }} className="search-result-item">
                        <Icon name="local_shipping" size={18} style={{ color: '#64748b' }} />
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: 'var(--dash-primary)' }}>{res.id}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{res.packageType}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>Tidak ditemukan</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="dash-topbar__right">
            {/* No Bell Here */}

            <div className="dash-topbar__divider" />
            <div className="dash-topbar__user" onClick={() => setActiveNav('settings')} style={{ cursor: 'pointer' }}>
              <div className="dash-topbar__user-info">
                <p>{displayName}</p>
                <p>{displayRole}</p>
              </div>
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=fec330&color=002442&bold=true`}
                alt="Foto profil pengguna"
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

      {/* Create Modal */}
      {isCreateModalOpen && <CreateShipmentModal onClose={() => setCreateModalOpen(false)} onCreated={handleShipmentCreated} />}
    </div>
  )
}
