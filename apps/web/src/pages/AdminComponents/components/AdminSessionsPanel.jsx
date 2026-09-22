import { useState, useEffect, useCallback } from 'react'
import Icon from '../../../components/Icon'
import { authAPI } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

/**
 * "Where am I logged in" — the visible half of Phase 2e.
 *
 * This is the capability server-side sessions exist for and a token cannot offer: a JWT can
 * be neither listed nor revoked, you can only wait for it to expire. So without this panel
 * the session work is real but invisible.
 *
 * Shows two different things, deliberately labelled apart:
 *   Sessions        — browsers currently logged in AS you. Revoking one logs it out now.
 *   Trusted devices — browsers allowed to SKIP the emailed code for 7 days. Forgetting one
 *                     doesn't log it out; it just means the next login needs a code again.
 */

const fmt = (iso) => {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '-' }
}

/** Turn a user-agent into something a human can recognise. Best-effort, never throws. */
const describeAgent = (ua) => {
  if (!ua) return 'Perangkat tidak dikenal'
  const browser =
    /Edg\//.test(ua)     ? 'Edge'    :
    /OPR\//.test(ua)     ? 'Opera'   :
    /Chrome\//.test(ua)  ? 'Chrome'  :
    /Safari\//.test(ua)  ? 'Safari'  :
    /Firefox\//.test(ua) ? 'Firefox' : 'Browser'
  const os =
    /Windows/.test(ua)        ? 'Windows' :
    /Android/.test(ua)        ? 'Android' :
    /iPhone|iPad|iOS/.test(ua) ? 'iOS'     :
    /Mac OS X/.test(ua)       ? 'macOS'   :
    /Linux/.test(ua)          ? 'Linux'   : ''
  return os ? `${browser} · ${os}` : browser
}

export default function AdminSessionsPanel() {
  const { showToast } = useToast()
  const [sessions, setSessions] = useState([])
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await authAPI.adminSessions()
      setSessions(data.sessions || [])
      setDevices(data.trustedDevices || [])
    } catch (err) {
      console.error('Failed to load sessions:', err)
      showToast('Gagal memuat daftar sesi.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const revokeOne = async (id) => {
    setBusyId(id)
    try {
      await authAPI.adminRevokeSession(id)
      showToast('Sesi dihentikan.', 'success')
      await load()
    } catch (err) {
      showToast(err.message || 'Gagal menghentikan sesi.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const revokeAll = async () => {
    setBusyId('all')
    try {
      const res = await authAPI.adminRevokeAllSessions()
      // This also revokes the CURRENT session, so the next request 401s and api.js
      // redirects to login. That is the intended behaviour for a panic button — being
      // signed out here is the proof it worked.
      showToast(`${res.sessionsRevoked ?? 0} sesi dihentikan. Anda akan keluar.`, 'success')
      setTimeout(() => { window.location.href = '/admin' }, 1200)
    } catch (err) {
      showToast(err.message || 'Gagal menghentikan sesi.', 'error')
      setBusyId(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon name="devices" size={20} />
          <h3 className="text-lg font-bold text-[#002442]">Sesi Aktif</h3>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={revokeAll}
            disabled={busyId === 'all'}
            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
          >
            {busyId === 'all' ? 'Menghentikan...' : 'Keluar dari Semua'}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Perangkat yang sedang masuk ke akun Anda. Hentikan yang tidak Anda kenali.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Memuat...</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-400">Tidak ada sesi aktif.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                s.current ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {describeAgent(s.userAgent)}
                  {s.current && (
                    <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[0.6rem] font-bold uppercase tracking-wide">
                      Perangkat ini
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  Aktif terakhir {fmt(s.lastSeenAt)}
                  {s.ip ? ` · ${s.ip}` : ''}
                </p>
              </div>
              {/* No revoke button on your own session: use "Keluar" for that. Offering it
                  here just invites confusion about why the page suddenly logged out. */}
              {!s.current && (
                <button
                  onClick={() => revokeOne(s.id)}
                  disabled={busyId === s.id}
                  className="shrink-0 px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {busyId === s.id ? '...' : 'Hentikan'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {devices.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6 mb-1">
            <Icon name="verified_user" size={18} />
            <h4 className="text-sm font-bold text-[#002442]">Perangkat Terpercaya</h4>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Browser ini tidak diminta kode email saat login. Gunakan &ldquo;Keluar dari
            Semua&rdquo; untuk melupakan semuanya.
          </p>
          <div className="flex flex-col gap-2">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{describeAgent(d.userAgent)}</p>
                  <p className="text-xs text-gray-500">Berlaku sampai {fmt(d.expiresAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
