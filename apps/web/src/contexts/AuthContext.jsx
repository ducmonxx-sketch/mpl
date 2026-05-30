import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  authAPI,
  usersAPI,
  getToken,
  setToken,
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

  // Derived
  const isAuthenticated = !!user && !!getToken()
  const isAdmin = userType === 'admin'

  // ── On mount: validate existing token ──────────────────────
  useEffect(() => {
    async function validateToken() {
      const token = getToken()
      const storedType = getStoredUserType()
      if (!token) {
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
          // Admin doesn't have a /me endpoint — keep stored data
          setUser(getStoredUser())
          setUserType('admin')
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
    setToken(data.token)
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
    setToken(data.token)
    setStoredUser(data.admin, 'admin')
    setUser(data.admin)
    setUserType('admin')
    return data
  }, [])

  // ── Logout ────────────────────────────────────────────────
  const logout = useCallback((redirectTo = '/') => {
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
