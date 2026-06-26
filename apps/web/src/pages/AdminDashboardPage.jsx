import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import anime from 'animejs'
import { useAuth } from '../contexts/AuthContext'
import { notificationsAPI, adminNotificationsAPI, fleetAPI, invoicesAPI } from '../lib/api'
import { useToast } from '../contexts/ToastContext'

// Layout Components
import AdminSidebar from './AdminComponents/layout/AdminSidebar'
import AdminTopbar from './AdminComponents/layout/AdminTopbar'

// Admin sections
import OverviewSection from './AdminComponents/OverviewSection'
import ShipmentsSection from './AdminComponents/ShipmentsSection'
import ClientsSection from './AdminComponents/ClientsSection'
import DriversSection from './AdminComponents/DriversSection'
import ArmadaSection from './AdminComponents/ArmadaSection'
import InvoicesSection from './AdminComponents/InvoicesSection'
import UsersSection from './AdminComponents/UsersSection'
import AdminProfileSection from './AdminComponents/AdminProfileSection'
import TrackingSection from './dashboard/TrackingSection'

// Styles (Kept for inner section components like Tables, KPI Cards)
import './ClientDashboardPage.css'
import './AdminDashboardPage.css'

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

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  
  const [activeNav, setActiveNav] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024)
  const [searchQuery, setSearchQuery] = useState('')
  const [trackingId, setTrackingId] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [shipmentHighlightId, setShipmentHighlightId] = useState('')
  const [readAlertIds, setReadAlertIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('read_alert_ids') || '[]')
    } catch {
      return []
    }
  })
  
  const searchWrapperRef = useRef(null)
  const notifWrapperRef = useRef(null)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifWrapperRef.current && !notifWrapperRef.current.contains(e.target)) {
        setShowNotifPanel(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Fetch notifications and scan for dynamic alerts
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const [notifData, driversData, vehiclesData, invoicesData] = await Promise.all([
          adminNotificationsAPI.list().catch(() => ({ notifications: [], unreadCount: 0 })),
          fleetAPI.getDrivers().catch(() => ({ drivers: [] })),
          fleetAPI.getVehicles().catch(() => ({ vehicles: [] })),
          invoicesAPI.list().catch(() => ({ invoices: [] }))
        ])

        const dbNotifs = notifData.notifications || []
        const now = new Date()
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(now.getDate() + 30)

        // 1. Driver SIM Expiry Alerts
        const driverAlerts = (driversData.drivers || []).filter(d => {
          if (!d.licenseExpiry) return false
          const expiry = new Date(d.licenseExpiry)
          return expiry >= now && expiry <= thirtyDaysFromNow
        }).map(d => ({
          id: `expiry-driver-${d.id}`,
          category: 'driver',
          title: 'Perpanjang SIM',
          message: `${d.fullName} SIM kedaluwarsa pd ${new Date(d.licenseExpiry).toLocaleDateString('id-ID')}`,
          linkTo: 'drivers',
          linkId: d.id,
          isRead: readAlertIds.includes(`expiry-driver-${d.id}`),
          createdAt: d.licenseExpiry,
        }))

        // 2. Armada KIR/STNK Expiry Alerts
        const vehicleAlerts = (vehiclesData.vehicles || []).filter(v => {
          const hasStnkExp = v.stnkExpiry && new Date(v.stnkExpiry) >= now && new Date(v.stnkExpiry) <= thirtyDaysFromNow
          const hasKirExp = v.kirExpiry && new Date(v.kirExpiry) >= now && new Date(v.kirExpiry) <= thirtyDaysFromNow
          return hasStnkExp || hasKirExp
        }).map(v => {
          const isKirExp = v.kirExpiry && new Date(v.kirExpiry) >= now && new Date(v.kirExpiry) <= thirtyDaysFromNow
          const date = isKirExp ? v.kirExpiry : v.stnkExpiry
          const type = isKirExp ? 'KIR' : 'STNK'
          return {
            id: `expiry-vehicle-${v.id}-${type}`,
            category: 'armada',
            title: `Perpanjang ${type}`,
            message: `${v.licensePlate} (${v.type}) ${type} kedaluwarsa pd ${new Date(date).toLocaleDateString('id-ID')}`,
            linkTo: 'armada',
            linkId: v.id,
            isRead: readAlertIds.includes(`expiry-vehicle-${v.id}-${type}`),
            createdAt: date,
          }
        })

        // 3. Invoice Approaching Due Date Alerts
        const sevenDaysFromNow = new Date()
        sevenDaysFromNow.setDate(now.getDate() + 7)
        const invoiceAlerts = (invoicesData.invoices || []).filter(inv => {
          const isUnresolved = ['draft', 'sent'].includes(inv.status.toLowerCase())
          const dueDate = new Date(inv.dueDate)
          return isUnresolved && dueDate >= now && dueDate <= sevenDaysFromNow
        }).map(inv => ({
          id: `approaching-invoice-${inv.id}`,
          category: 'invoice',
          title: 'Faktur Jatuh Tempo',
          message: `${inv.invoiceNumber} jatuh tempo pd ${new Date(inv.dueDate).toLocaleDateString('id-ID')}`,
          linkTo: 'invoices',
          linkId: inv.id,
          isRead: readAlertIds.includes(`approaching-invoice-${inv.id}`),
          createdAt: inv.dueDate,
        }))

        // Merge alerts and db notifications, sort chronologically
        const merged = [...driverAlerts, ...vehicleAlerts, ...invoiceAlerts, ...dbNotifs].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )

        setNotifications(merged)
        setUnreadCount(merged.filter(n => !n.isRead).length)
      } catch (err) {
        console.error('Failed to fetch/scan notifications:', err)
      }
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 8000)
    return () => clearInterval(interval)
  }, [readAlertIds])

  const handleMarkAllRead = async () => {
    try {
      await adminNotificationsAPI.markAllRead().catch(() => {})
      const newReadIds = [...readAlertIds]
      notifications.forEach(n => {
        if (n.id.toString().startsWith('expiry-') || n.id.toString().startsWith('approaching-')) {
          if (!newReadIds.includes(n.id)) newReadIds.push(n.id)
        }
      })
      localStorage.setItem('read_alert_ids', JSON.stringify(newReadIds))
      setReadAlertIds(newReadIds)
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {}
  }

  const handleMarkRead = async (id) => {
    try {
      if (id.toString().startsWith('expiry-') || id.toString().startsWith('approaching-')) {
        const newReadIds = [...readAlertIds, id]
        localStorage.setItem('read_alert_ids', JSON.stringify(newReadIds))
        setReadAlertIds(newReadIds)
      } else {
        await adminNotificationsAPI.markRead(id).catch(() => {})
      }
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
      case 'profile': return <AdminProfileSection />
      case 'tracking': return <TrackingSection initialSearchQuery={trackingId} isAdmin={true} />
      default: return <OverviewSection onChangeNav={handleNavChange} onNavigateToShipment={navigateToShipment} />
    }
  }

  const displayName = user?.fullName || 'Admin Utama'
  const displayRole = user?.role || 'Super Admin'

  return (
    <div className="flex h-screen bg-[#f8f9fa] font-display overflow-hidden text-[#333333]">
      <AdminSidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isMobile={isMobile}
        activeNav={activeNav}
        handleNavChange={handleNavChange}
        handleLogout={handleLogout}
      />
      
      <div className="flex flex-col flex-1 min-w-0">
        <AdminTopbar 
          setSidebarOpen={setSidebarOpen}
          searchWrapperRef={searchWrapperRef}
          notifWrapperRef={notifWrapperRef}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showNotifPanel={showNotifPanel}
          setShowNotifPanel={setShowNotifPanel}
          unreadCount={unreadCount}
          notifications={notifications}
          handleMarkAllRead={handleMarkAllRead}
          handleMarkRead={handleMarkRead}
          handleNotifNavigate={handleNotifNavigate}
          displayName={displayName}
          displayRole={displayRole}
          onProfileClick={() => handleNavChange('profile')}
        />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#f8f9fa] custom-scrollbar">
          {/* Main content wrapper with premium staggered entrance animation */}
          <AnimatedSection key={activeNav}>
            {renderSection()}
          </AnimatedSection>
        </main>
      </div>
    </div>
  )
}
