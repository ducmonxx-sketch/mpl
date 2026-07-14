/**
 * api.js — Centralized API Client
 *
 * Wraps fetch() with:
 *  - Base URL from VITE_API_BASE_URL
 *  - Automatic Bearer token attachment from localStorage
 *  - JSON request/response handling
 *  - 401 handling (clears token, redirects to login)
 *
 * Usage:
 *   import { authAPI, shipmentsAPI } from '../lib/api'
 *   const { token, user } = await authAPI.login(email, password)
 *   const { shipments } = await shipmentsAPI.list()
 */

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

// ─── Token helpers ──────────────────────────────────────────
export function getToken() {
  return localStorage.getItem('mpl_token')
}

export function setToken(token) {
  localStorage.setItem('mpl_token', token)
}

export function clearToken() {
  localStorage.removeItem('mpl_token')
  localStorage.removeItem('mpl_user')
  localStorage.removeItem('mpl_user_type')
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('mpl_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredUser(user, type) {
  localStorage.setItem('mpl_user', JSON.stringify(user))
  localStorage.setItem('mpl_user_type', type)
}

export function getStoredUserType() {
  return localStorage.getItem('mpl_user_type') // 'user' | 'admin'
}

// ─── Core fetch wrapper ─────────────────────────────────────
async function request(endpoint, options = {}) {
  const { method = 'GET', body, params, headers: customHeaders } = options

  // Build URL with query params
  let url = `${BASE_URL}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val)
      }
    })
    const qs = searchParams.toString()
    if (qs) url += `?${qs}`
  }

  // Build headers. FormData carries its own multipart Content-Type (with boundary),
  // so don't force application/json — let the browser set it.
  const isForm = body instanceof FormData
  const headers = { ...customHeaders }
  if (!isForm) headers['Content-Type'] = 'application/json'

  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Make request
  const res = await fetch(url, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })

  // Parse JSON response
  let data
  try {
    data = await res.json()
  } catch {
    data = {}
  }

  // Handle auth failures
  if (res.status === 401) {
    clearToken()
    const path = window.location.pathname
    // Redirect to login if not already there
    if (path.startsWith('/admin/')) {
      window.location.href = '/admin'
    } else if (path.startsWith('/client/')) {
      window.location.href = '/client'
    }
    
    throw new ApiError(data.message || 'Session expired. Please log in again.', res.status, data)
  }

  // Throw on error responses
  if (!res.ok) {
    throw new ApiError(data.message || `Request failed (${res.status})`, res.status, data)
  }

  return data
}

// Custom error class for API errors
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

// Shorthand methods
const api = {
  get:    (endpoint, params) => request(endpoint, { method: 'GET', params }),
  post:   (endpoint, body)   => request(endpoint, { method: 'POST', body }),
  patch:  (endpoint, body)   => request(endpoint, { method: 'PATCH', body }),
  delete: (endpoint)         => request(endpoint, { method: 'DELETE' }),
}

// ─── Auth API ───────────────────────────────────────────────
export const authAPI = {
  /** Client registration */
  register: (data) =>
    api.post('/api/auth/register', data),

  /** Client login → { token, user } */
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),

  /** Admin login → { token, admin } */
  adminLogin: (email, password) =>
    api.post('/api/auth/admin/login', { email, password }),

  /** Admin: change own password (self-service; verifies current password) */
  changeAdminPassword: (data) =>
    api.patch('/api/auth/admin/me/password', data),

  /** Admin: own profile (includes avatarUrl) */
  getAdminMe: () =>
    api.get('/api/auth/admin/me'),

  /** Admin: upload profile picture (multipart, field `file`) → { avatarUrl } */
  uploadAdminAvatar: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/api/auth/admin/me/avatar', fd)
  },
}

// ─── Users API ──────────────────────────────────────────────
export const usersAPI = {
  /** Get current user's profile + settings */
  getMe: () =>
    api.get('/api/users/me'),

  /** Update current user's profile */
  updateMe: (data) =>
    api.patch('/api/users/me', data),

  /** Update notification/theme settings */
  updateSettings: (data) =>
    api.patch('/api/users/me/settings', data),

  /** Admin: list all clients */
  listAll: (params) =>
    api.get('/api/users', params),

  /** Admin: create a new user account */
  createUser: (data) =>
    api.post('/api/users', data),

  /** Admin: verify a client */
  verify: (userId) =>
    api.patch(`/api/users/${userId}/verify`),

  /** Admin: reject a client */
  reject: (userId) =>
    api.patch(`/api/users/${userId}/reject`),

  /** Admin: update a user/client account */
  updateUser: (userId, data) =>
    api.patch(`/api/users/${userId}`, data),

  /** Admin: delete a user/client account */
  deleteUser: (userId) =>
    api.delete(`/api/users/${userId}`),
  /** Admin: get distinct company names */
  getCompanies: () =>
    api.get('/api/users/companies'),

  /** Admin: generate magic link for registration */
  generateMagicLink: (data) =>
    api.post('/api/users/magic-link', data),

  /** Public: validate magic link token */
  validateMagicLink: (token) =>
    api.get(`/api/users/magic-link/${token}`),

  /** Public: register via magic link */
  registerViaMagicLink: (token, data) =>
    api.post(`/api/users/magic-link/${token}/register`, data),

  /** Admin: generate reset password link */
  generateResetLink: (userId) =>
    api.post('/api/users/reset-password-link', { userId }),

  /** Public: validate reset password token */
  validateResetLink: (token) =>
    api.get(`/api/users/reset-password/${token}`),

  /** Public: reset password */
  resetPassword: (token, data) =>
    api.post(`/api/users/reset-password/${token}`, data),
}

// ─── Shipments API ──────────────────────────────────────────
export const shipmentsAPI = {
  /** List shipments (client: own, admin: all) */
  list: (params) =>
    api.get('/api/shipments', params),

  /** Dashboard stats by period */
  getStats: (period = 'monthly') =>
    api.get('/api/shipments/stats', { period }),

  /** Single shipment detail */
  getById: (id) =>
    api.get(`/api/shipments/${encodeURIComponent(id)}`),

  /** Create a new shipment */
  create: (data) =>
    api.post('/api/shipments', data),

  /** Admin: assign driver & vehicle */
  assign: (id, data) =>
    api.patch(`/api/shipments/${encodeURIComponent(id)}/assign`, data),

  /** Admin: update status & progress */
  updateStatus: (id, data) =>
    api.patch(`/api/shipments/${encodeURIComponent(id)}/status`, data),

  /** Admin: Pengurus Pabrik check */
  plantCheck: (id, data) =>
    api.patch(`/api/shipments/${encodeURIComponent(id)}/plant-check`, data),

  /** Admin: Kepala Gudang handover */
  handover: (id, data) =>
    api.patch(`/api/shipments/${encodeURIComponent(id)}/handover`, data),

  /** Admin: send WhatsApp assignment notification to the assigned driver (via OpenWA) */
  notifyDriver: (id) =>
    api.post(`/api/shipments/${encodeURIComponent(id)}/notify-driver`),

  /** Admin: get pickup plants */
  getPickupPlants: () =>
    api.get('/api/shipments/pickup-plants'),
}

// ─── Tracking API ───────────────────────────────────────────
export const trackingAPI = {
  /** Full tracking timeline for a shipment */
  getTimeline: (shipmentId) =>
    api.get(`/api/tracking/${encodeURIComponent(shipmentId)}`),

  /** Admin: add checkpoint event */
  addEvent: (shipmentId, data) =>
    api.post(`/api/tracking/${encodeURIComponent(shipmentId)}/events`, data),

  /** Admin: update checkpoint event */
  updateEvent: (eventId, data) =>
    api.patch(`/api/tracking/events/${eventId}`, data),
}

// ─── Fleet API ──────────────────────────────────────────────
export const fleetAPI = {
  /** List all drivers */
  getDrivers: (params) =>
    api.get('/api/fleet/drivers', params),

  /** Add a driver */
  addDriver: (data) =>
    api.post('/api/fleet/drivers', data),

  /** Update a driver */
  updateDriver: (id, data) =>
    api.patch(`/api/fleet/drivers/${id}`, data),

  /** Delete a driver */
  deleteDriver: (id) =>
    api.delete(`/api/fleet/drivers/${id}`),

  /** List all vehicles */
  getVehicles: (params) =>
    api.get('/api/fleet/vehicles', params),

  /** Add a vehicle */
  addVehicle: (data) =>
    api.post('/api/fleet/vehicles', data),

  /** Update a vehicle */
  updateVehicle: (id, data) =>
    api.patch(`/api/fleet/vehicles/${id}`, data),

  /** Delete a vehicle */
  deleteVehicle: (id) =>
    api.delete(`/api/fleet/vehicles/${id}`),

  /** Pair a primary driver to a vehicle */
  pairDriver: (vehicleId, driverId) =>
    api.patch(`/api/fleet/vehicles/${vehicleId}/pair-driver`, { driverId }),

  /** Remove the primary driver from a vehicle */
  unpairDriver: (vehicleId) =>
    api.patch(`/api/fleet/vehicles/${vehicleId}/unpair-driver`),

  /** List selectable vehicle brands */
  getBrands: () =>
    api.get('/api/fleet/brands'),

  /** Add a vehicle brand */
  addBrand: (name) =>
    api.post('/api/fleet/brands', { name }),

  /** List selectable vehicle colors */
  getColors: () =>
    api.get('/api/fleet/colors'),

  /** Add a vehicle color */
  addColor: (name) =>
    api.post('/api/fleet/colors', { name }),
}

// ─── Notifications API ──────────────────────────────────────
export const notificationsAPI = {
  /** Get my notifications */
  list: () =>
    api.get('/api/notifications'),

  /** Mark one notification as read */
  markRead: (id) =>
    api.patch(`/api/notifications/${id}/read`),

  /** Mark all as read */
  markAllRead: () =>
    api.patch('/api/notifications/read-all'),
}

// ─── Invoices API ───────────────────────────────────────────
export const invoicesAPI = {
  /** List invoices (client: own, admin: all) */
  list: (params) =>
    api.get('/api/invoices', params),

  /** Single invoice detail */
  getById: (id) =>
    api.get(`/api/invoices/${id}`),

  /** Admin: create a new invoice */
  create: (data) =>
    api.post('/api/invoices', data),

  /** Admin: send invoice to client */
  send: (id) =>
    api.patch(`/api/invoices/${id}/send`),

  /** Admin: mark invoice as paid */
  markPaid: (id) =>
    api.patch(`/api/invoices/${id}/paid`),

  /** Admin: cancel invoice */
  cancel: (id) =>
    api.patch(`/api/invoices/${id}/cancel`),
}

// ─── Audit Logs API (SUPERADMIN only) ───────────────────────
export const auditLogsAPI = {
  /** Admin activity feed. params: { scope: 'normal'|'all', adminId, limit, offset } */
  list: (params) =>
    api.get('/api/audit-logs', params),
}

// ─── Admins API (SUPERADMIN only) ───────────────────────────
export const adminsAPI = {
  /** List admin accounts */
  list: () =>
    api.get('/api/admins'),
}

// ─── Admin Notifications API ────────────────────────────────
export const adminNotificationsAPI = {
  /** List admin notifications */
  list: () =>
    api.get('/api/admin/notifications'),

  /** Mark single notification as read */
  markRead: (id) =>
    api.patch(`/api/admin/notifications/${id}/read`),

  /** Mark all admin notifications as read */
  markAllRead: () =>
    api.patch('/api/admin/notifications/read-all'),
}

export default api
