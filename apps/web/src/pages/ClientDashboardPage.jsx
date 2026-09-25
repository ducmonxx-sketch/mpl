import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import anime from 'animejs'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { shipmentsAPI, notificationsAPI } from '../lib/api'
import DashboardSection from './dashboard/DashboardSection'
import ShipmentsSection from './dashboard/ShipmentsSection'
import HistorySection from './dashboard/HistorySection'
import SettingsSection from './dashboard/SettingsSection'
import CreateShipmentModal from '../components/ClientComponents/CreateShipmentModal'
import ClientSidebar from './ClientComponents/layout/ClientSidebar'
import ClientTopbar from './ClientComponents/layout/ClientTopbar'
import './ClientDashboardPage.css'

const AnimatedSection = ({ children }) => {
  const containerRef = useRef(null)

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const targets = Array.from(containerRef.current.children);
    if (targets.length === 0) return;

    anime.set(targets, { opacity: 0, translateY: 15 });

    anime({
      targets,
      opacity: [0, 1],
      translateY: [15, 0],
      easing: 'spring(1, 80, 10, 0)',
      delay: anime.stagger(75),
      duration: 1000
    });
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  )
}

export default function ClientDashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { showToast } = useToast() // Note: need to import useToast from context
  
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [highlightShipmentId, setHighlightShipmentId] = useState('')
  const searchWrapperRef = useRef(null)

  // Refresh trigger for child sections after shipment creation
  const [refreshKey, setRefreshKey] = useState(0)

  // Notification state
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  // There is no DELETE endpoint for notifications — "delete" only dismisses locally, so we
  // must filter dismissed ids out of every poll or they'd reappear on the next fetch.
  const dismissedIdsRef = useRef(new Set())

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const data = await notificationsAPI.list()
        const visible = (data.notifications || []).filter(n => !dismissedIdsRef.current.has(n.id))
        setNotifications(visible)
        setUnreadCount(visible.filter(n => !n.isRead).length)
      } catch (err) {
        console.error('Failed to fetch notifications:', err)
      }
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 8000)
    return () => clearInterval(interval)
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {}
  }

  const handleMarkRead = async (id) => {
    try {
      await notificationsAPI.markRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {}
  }

  const handleDeleteNotif = async (id) => {
    try {
      dismissedIdsRef.current.add(id)
      const removed = notifications.find(n => n.id === id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (removed && !removed.isRead) setUnreadCount(prev => Math.max(0, prev - 1))
      showToast('Notifikasi berhasil disembunyikan', 'success')
    } catch {
      showToast('Gagal menghapus notifikasi', 'error')
    }
  }

  const handleNotifNavigate = (navId, linkId) => {
    if (!navId) return
    // 'tracking' is a legacy notification link target (the nav was removed and folded
    // into Shipments) — remap it so any old, not-yet-migrated notification still resolves.
    const targetNav = navId === 'tracking' ? 'shipments' : navId
    if (linkId && targetNav === 'shipments') {
      navigateToShipment(linkId)
    } else {
      handleNavChange(targetNav)
    }
    setShowNotifPanel(false)
  }

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const notifWrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowSearchDropdown(false)
      }
      if (notifWrapperRef.current && !notifWrapperRef.current.contains(e.target)) {
        setShowNotifPanel(false)
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

  // Jumps to Shipments and auto-expands the given shipment's card — replaces the old
  // separate Tracking nav (removed 2026-09-25; its timeline view moved into ShipmentCard).
  const navigateToShipment = (id) => {
    setHighlightShipmentId(id)
    setActiveNav('shipments')
  }

  const handleShipmentCreated = () => {
    setCreateModalOpen(false)
    setRefreshKey(k => k + 1)
  }

  const renderSection = () => {
    switch (activeNav) {
      case 'dashboard': return <DashboardSection key={refreshKey} />
      case 'shipments': return <ShipmentsSection key={refreshKey} onCreateShipment={() => setCreateModalOpen(true)} highlightId={highlightShipmentId} />
      case 'history': return <HistorySection key={refreshKey} />
      case 'settings': return <SettingsSection />
      default: return <DashboardSection key={refreshKey} />
    }
  }

  const handleSearchSelect = (id) => {
    setShowSearchDropdown(false)
    setSearchQuery('')
    navigateToShipment(id)
  }

  const handleLogout = () => {
    logout('/client')
  }

  const handleNavChange = (id) => {
    setActiveNav(id)
    if (id !== 'shipments') setHighlightShipmentId('')
    if (isMobile) setSidebarOpen(false)
  }

  // Build display name from user data
  const displayName = user?.fullName || 'User'
  const displayRole = user?.companyName || 'Klien'

  return (
    <div className="flex h-screen bg-[#f8f9fa] font-display overflow-hidden text-[#333333]">
      <ClientSidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isMobile={isMobile}
        activeNav={activeNav}
        handleNavChange={handleNavChange}
        handleLogout={handleLogout}
        onCreateShipment={() => setCreateModalOpen(true)}
        userData={user}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <ClientTopbar 
          setSidebarOpen={setSidebarOpen}
          searchWrapperRef={searchWrapperRef}
          notifWrapperRef={notifWrapperRef}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showSearchDropdown={showSearchDropdown}
          setShowSearchDropdown={setShowSearchDropdown}
          searchResults={searchResults}
          handleSearchSelect={handleSearchSelect}
          showNotifPanel={showNotifPanel}
          setShowNotifPanel={setShowNotifPanel}
          unreadCount={unreadCount}
          notifications={notifications}
          handleMarkAllRead={handleMarkAllRead}
          handleMarkRead={handleMarkRead}
          handleDeleteNotif={handleDeleteNotif}
          handleNotifNavigate={handleNotifNavigate}
          displayName={displayName}
          displayRole={displayRole}
          onProfileClick={() => handleNavChange('settings')}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#f8f9fa] custom-scrollbar">
          <AnimatedSection key={activeNav}>
            {renderSection()}
          </AnimatedSection>
        </main>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && <CreateShipmentModal onClose={() => setCreateModalOpen(false)} onCreated={handleShipmentCreated} />}
    </div>
  )
}

