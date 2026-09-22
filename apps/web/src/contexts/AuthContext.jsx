import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  authAPI,
  usersAPI,
  clearToken,
  getStoredUser,
  setStoredUser,
  getStoredUserType,
  ApiError,
} from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const navigate = useNavigate()

  // State
  const [user, setUser] = useState(getStoredUser)       // client user object
  const [userType, setUserType] = useState(getStoredUserType) // 'user' | 'admin'
  const [loading, setLoading] = useState(true)           // initial token check

  // Derived.
  // Deliberately NOT `&& !!getToken()` any more: with cookie auth the token is httpOnly and
  // unreadable by design, so that check would make isAuthenticated permanently false. The
  // server is the authority — if /me returned a profile, we are logged in.
  const isAuthenticated = !!user
  const isAdmin = userType === 'admin'

  // ── On mount: validate existing token ──────────────────────
  useEffect(() => {
    async function validateToken() {
      // `mpl_user_type` is only a hint about WHICH /me to call — it is not a credential, so
      // it stays in localStorage even after the token goes away. Without a hint we do not
      // probe: a /me call while logged out would 401, and the api.js 401 handler redirects.
      const storedType = getStoredUserType()
      if (!storedType) {
        setLoading(false)
        return
      }

      try {
        if (storedType === 'user') {
          const { user: profile } = await usersAPI.getMe()
          setUser(profile)
          setUserType('user')
          setStoredUser(profile, 'user')
        } else if (storedType === 'admin') {
          // /api/auth/admin/me exists now, so ask the server rather than trusting whatever
          // was cached locally. That is the whole point of cookie auth: the session, not
          // localStorage, decides whether you are logged in.
          const { admin } = await authAPI.getAdminMe()
          setUser(admin)
          setUserType('admin')
          setStoredUser(admin, 'admin')
        }
      } catch {
        // Token invalid — clear everything
        clearToken()
        setUser(null)
        setUserType(null)
      } finally {
        setLoading(false)
      }
    }

    validateToken()
  }, [])

  // ── Client login ──────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const data = await authAPI.login(email, password)
    setStoredUser(data.user, 'user')
    setUser(data.user)
    setUserType('user')
    return data
  }, [])

  // ── Client register ───────────────────────────────────────
  const register = useCallback(async (formData) => {
    const data = await authAPI.register(formData)
    return data
  }, [])

  // ── Admin login ───────────────────────────────────────────
  const adminLogin = useCallback(async (email, password) => {
    const data = await authAPI.adminLogin(email, password)
    // With email 2FA on, step 1 succeeds but returns no token — just
    // { otpRequired: true, challengeId }. Returning early matters: without this the
    // lines below would store an undefined token and a null admin, leaving the app
    // in a half-logged-in state. The caller collects the code and calls
    // adminVerifyOtp() to finish.
    if (data?.otpRequired) return data
    setStoredUser(data.admin, 'admin')
    setUser(data.admin)
    setUserType('admin')
    return data
  }, [])

  // Step 2 of admin login. Additive — nothing else in the app calls this, and the
  // client-side flow is untouched.
  const adminVerifyOtp = useCallback(async (challengeId, code) => {
    const data = await authAPI.adminVerifyOtp(challengeId, code)
    setStoredUser(data.admin, 'admin')
    setUser(data.admin)
    setUserType('admin')
    return data
  }, [])

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback(async (redirectTo = '/') => {
    // Tell the server to revoke the session. Previously logout only wiped localStorage,
    // which left the credential valid server-side for its full lifetime.
    await authAPI.logout().catch(() => {})
    clearToken()
    setUser(null)
    setUserType(null)
    navigate(redirectTo)
  }, [navigate])

  // ── Refresh user profile ──────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (userType !== 'user') return
    try {
      const { user: profile } = await usersAPI.getMe()
      setUser(profile)
      setStoredUser(profile, 'user')
    } catch {
      // Silently fail — user can still use cached data
    }
  }, [userType])

  const value = {
    user,
    userType,
    loading,
    isAuthenticated,
    isAdmin,
    login,
    register,
    adminLogin,
    adminVerifyOtp,
    logout,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
