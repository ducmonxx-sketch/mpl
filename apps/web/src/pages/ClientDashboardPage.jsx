import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import anime from 'animejs'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { shipmentsAPI } from '../lib/api'
import DashboardSection from './dashboard/DashboardSection'
import ShipmentsSection from './dashboard/ShipmentsSection'
import TrackingSection from './dashboard/TrackingSection'
import HistorySection from './dashboard/HistorySection'
import SettingsSection from './dashboard/SettingsSection'
import InvoicesSection from './dashboard/InvoicesSection'
import CreateShipmentModal from '../components/ClientComponents/CreateShipmentModal'
import ClientSidebar from './ClientComponents/layout/ClientSidebar'
import ClientTopbar from './ClientComponents/layout/ClientTopbar'
import './ClientDashboardPage.css'

const AnimatedSection = ({ children }) => {
  const containerRef = useRef(null)

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const wrapper = containerRef.current.firstElementChild;
    const targets = (wrapper && wrapper.children.length > 0) 
      ? Array.from(wrapper.children) 
      : containerRef.current;

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
  const [trackingId, setTrackingId] = useState('')
  const searchWrapperRef = useRef(null)

  // Refresh trigger for child sections after shipment creation
  const [refreshKey, setRefreshKey] = useState(0)

  // Notification state
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      category: 'shipment',
      title: 'Pengiriman Dalam Perjalanan',
      message: 'Pengiriman SHP-9821 sedang dalam perjalanan menuju gudang transit di Surabaya.',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      linkTo: 'tracking',
      linkId: 'SHP-9821'
    },
    {
      id: 2,
      category: 'invoice',
      title: 'Faktur Baru Terbit',
      message: 'Faktur INV-2026/05 telah terbit dan menunggu pembayaran.',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      linkTo: 'invoices',
      linkId: null
    },
    {
      id: 3,
      category: 'alert',
      title: 'Kendala Cuaca',
      message: 'Pengiriman SHP-1123 mengalami sedikit penundaan akibat cuaca buruk di area tujuan.',
      isRead: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      linkTo: 'tracking',
      linkId: 'SHP-1123'
    },
    {
      id: 4,
      category: 'tracking',
      title: 'Pengiriman Selesai',
      message: 'Pengiriman SHP-8472 telah berhasil diterima oleh Budi Santoso.',
      isRead: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      linkTo: 'history',
      linkId: 'SHP-8472'
    }
  ])

  const unreadCount = notifications.filter(n => !n.isRead).length

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const handleMarkRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  const handleDeleteNotif = async (id) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== id))
      showToast('Notifikasi berhasil dihapus', 'success')
    } catch {
      showToast('Gagal menghapus notifikasi', 'error')
    }
  }

  const handleNotifNavigate = (navId, linkId) => {
    if (linkId && navId === 'tracking') {
      navigateToTracking(linkId)
    } else {
      handleNavChange(navId)
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

  const handleNavChange = (id) => {
    setActiveNav(id)
    if (id !== 'tracking') setTrackingId('')
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

