import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import ClientAuthPage from './pages/ClientAuthPage'
import VerificationPage from './pages/VerificationPage'
import ClientDashboardPage from './pages/ClientDashboardPage'
import AdminAuthPage from './pages/AdminAuthPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import WhatsAppButton from './components/WhatsAppButton'
import ProtectedRoute from './components/ProtectedRoute'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'

function AppContent() {
  const location = useLocation()
  const hiddenPaths = ['/client/dashboard', '/admin']
  const hideWhatsApp = hiddenPaths.some(p => location.pathname.startsWith(p))

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/client" element={<ClientAuthPage />} />
        <Route path="/client/verification" element={<VerificationPage />} />
        <Route
          path="/client/dashboard"
          element={
            <ClientDashboardPage />
          }
        />
        <Route path="/admin" element={<AdminAuthPage />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requiredType="admin">
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {!hideWhatsApp && <WhatsAppButton />}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
