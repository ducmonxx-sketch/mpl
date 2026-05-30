import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute — wraps pages that require authentication.
 *
 * Props:
 *   requiredType — 'user' | 'admin'  (which user type can access)
 *   children     — the page component to render
 *
 * Behavior:
 *   - While validating token: shows a loading spinner
 *   - If not authenticated: redirects to the login page
 *   - If authenticated but wrong type: redirects to their correct dashboard
 */
export default function ProtectedRoute({ children, requiredType = 'user' }) {
  const { isAuthenticated, userType, loading } = useAuth()

  // Still validating token on mount
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid #e2e8f0',
            borderTopColor: '#fec330',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Memvalidasi sesi...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  // Not authenticated → redirect to login
  if (!isAuthenticated) {
    const loginPath = requiredType === 'admin' ? '/admin' : '/client'
    return <Navigate to={loginPath} replace />
  }

  // Authenticated but wrong type
  if (requiredType === 'admin' && userType !== 'admin') {
    return <Navigate to="/client/dashboard" replace />
  }
  if (requiredType === 'user' && userType !== 'user') {
    return <Navigate to="/admin/dashboard" replace />
  }

  return children
}
