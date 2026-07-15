import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import WhatsAppButton from './components/WhatsAppButton'
import ProtectedRoute from './components/ProtectedRoute'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import PageLoader from './components/PageLoader'

const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const ClientAuthPage = lazy(() => import('./pages/ClientAuthPage'))
const VerificationPage = lazy(() => import('./pages/VerificationPage'))
const ClientDashboardPage = lazy(() => import('./pages/ClientDashboardPage'))
const AdminAuthPage = lazy(() => import('./pages/AdminAuthPage'))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'))
const MagicLinkPage = lazy(() => import('./pages/MagicLinkPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))

function AppContent() {
  const location = useLocation()
  const hiddenPaths = ['/client/dashboard', '/admin']
  const hideWhatsApp = hiddenPaths.some(p => location.pathname.startsWith(p))

  return (
    <>
      <Suspense fallback={<PageLoader />}>
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
          <Route path="/auth/register/:token" element={<MagicLinkPage />} />
          <Route path="/auth/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
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
