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

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

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

  // Build headers
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  }

  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Make request
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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
    // Redirect to login if not already there
    if (!window.location.pathname.startsWith('/client') || window.location.pathname === '/client/dashboard') {
      window.location.href = '/client'
    }
    if (window.location.pathname.startsWith('/admin/dashboard')) {
      window.location.href = '/admin'
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
  get: (endpoint, params) => request(endpoint, { method: 'GET', params }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body }),
  patch: (endpoint, body) => request(endpoint, { method: 'PATCH', body }),
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

  /** Admin: verify a client */
  verify: (userId) =>
    api.patch(`/api/users/${userId}/verify`),

  /** Admin: reject a client */
  reject: (userId) =>
    api.patch(`/api/users/${userId}/reject`),
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

  /** List all vehicles */
  getVehicles: (params) =>
    api.get('/api/fleet/vehicles', params),

  /** Add a vehicle */
  addVehicle: (data) =>
    api.post('/api/fleet/vehicles', data),

  /** Update a vehicle */
  updateVehicle: (id, data) =>
    api.patch(`/api/fleet/vehicles/${id}`, data),
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

export default api
