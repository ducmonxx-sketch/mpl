import { useState, useEffect, useCallback } from 'react'
import Icon from '../../components/Icon'
import Loader from '../../components/Loader'
import { useToast } from '../../contexts/ToastContext'
import AdminDataTable from './components/AdminDataTable'
import AdminModal from './components/AdminModal'
import AdminFormField from './components/AdminFormField'
import { adminsAPI } from '../../lib/api'

const ROLE_LABELS = {
  SUPERADMIN: 'Super Admin',
  OPERATIONS: 'Operasional',
  SUPPORT: 'Layanan Pelanggan',
  KEPALA_ARMADA: 'Kepala Armada',
  PIC_PABRIK: 'PIC Pabrik',
  PIC_GUDANG: 'PIC Gudang',
}

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))

export default function UsersSection() {
  const { showToast } = useToast()

  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState(null)

  // Create form state (controlled)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState('OPERATIONS')

  // Create success state
  const [createSuccess, setCreateSuccess] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState({ email: '', password: '' })
  const [credentialsCopied, setCredentialsCopied] = useState(false)

  // Reset Password Modal State
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetPasswordCopied, setResetPasswordCopied] = useState(false)

  const fetchAdmins = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const data = await adminsAPI.list()
      const mapped = (data.admins || []).map(a => ({
        id: a.id,
        name: a.fullName,
        email: a.email,
        role: a.role,
        createdAt: a.createdAt
          ? new Date(a.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
          : '-',
      }))
      setAdmins(mapped)
    } catch (err) {
      console.error('Failed to fetch admins:', err)
      showToast('Gagal memuat data admin.', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchAdmins()
    const interval = setInterval(() => fetchAdmins({ silent: true }), 8000)
    return () => clearInterval(interval)
  }, [fetchAdmins])

  useEffect(() => {
    if (!loading) {
      import('animejs').then(animeModule => {
        const anime = animeModule.default
        anime({
          targets: '.adm-kpi-card',
          translateY: [20, 0],
          opacity: [0, 1],
          easing: 'easeOutElastic(1, .8)',
          duration: 800,
          delay: anime.stagger(100)
        })
      })
    }
  }, [loading])

  useEffect(() => {
    if (selectedAdmin) {
      import('animejs').then(animeModule => {
        const anime = animeModule.default
        anime({
          targets: '.adm-detail-panel',
          translateX: [50, 0],
          opacity: [0, 1],
          easing: 'easeOutExpo',
          duration: 400
        })
      })
    }
  }, [selectedAdmin])

  const resetModal = () => {
    setFormName('')
    setFormEmail('')
    setFormRole('OPERATIONS')
    setCreateSuccess(false)
    setCreatedCredentials({ email: '', password: '' })
    setCredentialsCopied(false)
  }

  const handleCreateAdmin = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      showToast('Nama Lengkap dan Email wajib diisi.', 'error')
      return
    }
    try {
      const res = await adminsAPI.create({
        fullName: formName,
        email: formEmail,
        role: formRole,
      })
      setCreatedCredentials({
        email: formEmail,
        password: res.tempPassword || '(auto-generated)',
      })
      setCreateSuccess(true)
      fetchAdmins()
    } catch (err) {
      showToast(err.message || 'Gagal membuat admin.', 'error')
    }
  }

  const handleResetPassword = async (admin) => {
    try {
      const res = await adminsAPI.resetPassword(admin.id)
      setResetPassword(res.tempPassword || '')
      setResetTarget(admin)
      setShowResetModal(true)
      setResetPasswordCopied(false)
    } catch (err) {
      showToast(err.message || 'Gagal mereset password admin', 'error')
    }
  }

  const handleCopyResetPassword = () => {
    navigator.clipboard.writeText(resetPassword).catch(() => {})
    setResetPasswordCopied(true)
    setTimeout(() => setResetPasswordCopied(false), 2000)
  }

  const handleCopyCredentials = () => {
    const text = `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`
    navigator.clipboard.writeText(text).catch(() => {})
    setCredentialsCopied(true)
    setTimeout(() => setCredentialsCopied(false), 2000)
  }

  const handleModalSubmit = () => {
    if (createSuccess) {
      setShowCreateModal(false)
      resetModal()
    } else {
      handleCreateAdmin()
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Nama',
      render: (v) => <span className="adm-table__cell-main">{v}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      render: (v) => <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{v}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      render: (v) => (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--dash-primary)',
            background: 'rgba(0,36,66,0.06)',
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
          }}
        >
          {ROLE_LABELS[v] || v}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Dibuat Pada',
      render: (v) => <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{v}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="adm-actions">
          <button
            className="adm-action-btn"
            title="Detail"
            onClick={(e) => { e.stopPropagation(); setSelectedAdmin(row) }}
          >
            <Icon name="edit" size={16} />
          </button>
          <button
            className="adm-action-btn"
            title="Reset Password"
            onClick={(e) => { e.stopPropagation(); handleResetPassword(row) }}
          >
            <Icon name="key" size={16} />
          </button>
        </div>
      ),
    },
  ]

  const statsTotal = admins.length
  const statsSuperAdmin = admins.filter(a => a.role === 'SUPERADMIN').length
  const statsPipeline = admins.filter(a => ['KEPALA_ARMADA', 'PIC_PABRIK', 'PIC_GUDANG'].includes(a.role)).length

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Daftar Admin</h2>
          <p className="dash-header__subtitle">Kelola akses staf internal dan PIC.</p>
        </div>
        <div className="adm-section-actions">
          <button className="adm-create-btn" onClick={() => { resetModal(); setShowCreateModal(true) }}>
            <Icon name="group_add" size={18} /> Tambah Admin
          </button>
        </div>
      </section>

      {/* KPI Grid */}
      <div className="adm-kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="adm-kpi-card glass-card opacity-0">
          <div className="adm-kpi-card__icon"><Icon name="group" size={24} /></div>
          <div className="adm-kpi-card__info">
            <h3 className="adm-kpi-card__title">Total Admin</h3>
            <p className="adm-kpi-card__value">{statsTotal}</p>
          </div>
        </div>
        <div className="adm-kpi-card glass-card opacity-0">
          <div className="adm-kpi-card__icon" style={{ color: 'var(--dash-accent, #4a6d55)', background: 'color-mix(in srgb, var(--dash-accent, #4a6d55) 10%, transparent)' }}><Icon name="local_shipping" size={24} /></div>
          <div className="adm-kpi-card__info">
            <h3 className="adm-kpi-card__title">Tim Pipeline (PIC)</h3>
            <p className="adm-kpi-card__value">{statsPipeline}</p>
          </div>
        </div>
        <div className="adm-kpi-card glass-card opacity-0">
          <div className="adm-kpi-card__icon" style={{ color: 'var(--dash-primary)', background: 'color-mix(in srgb, var(--dash-primary) 10%, transparent)' }}><Icon name="admin_panel_settings" size={24} /></div>
          <div className="adm-kpi-card__info">
            <h3 className="adm-kpi-card__title">Super Admin</h3>
            <p className="adm-kpi-card__value">{statsSuperAdmin}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
          <Loader size="lg" />
          <p className="text-sm font-medium">Memuat data admin...</p>
        </div>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <AdminDataTable columns={columns} data={admins} onRowClick={setSelectedAdmin} />
        </div>
      )}

      {/* Detail Panel */}
      {selectedAdmin && (
        <div className="adm-detail-panel glass-card opacity-0">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div
                style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'var(--dash-secondary)',
                  color: 'var(--dash-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', fontWeight: 900, boxShadow: '0 4px 15px color-mix(in srgb, var(--dash-secondary) 30%, transparent)',
                  flexShrink: 0
                }}
              >
                {(selectedAdmin.name || 'A').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--dash-primary)', margin: 0 }}>
                  {selectedAdmin.name}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>
                  {ROLE_LABELS[selectedAdmin.role] || selectedAdmin.role}
                </p>
              </div>
            </div>
            <button className="adm-action-btn" onClick={() => setSelectedAdmin(null)}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="adm-detail-grid">
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="account_circle" size={16} /> Informasi Akun</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Email</span><span className="adm-detail-value">{selectedAdmin.email}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Role</span><span className="adm-detail-value">{ROLE_LABELS[selectedAdmin.role] || selectedAdmin.role}</span></div>
            </div>
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="history" size={16} /> Aktivitas</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Dibuat Pada</span><span className="adm-detail-value">{selectedAdmin.createdAt}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <AdminModal
          title="Tambah Admin Baru"
          subtitle={createSuccess ? 'Kredensial admin baru.' : 'Isi data akun staf internal atau PIC.'}
          onClose={() => { setShowCreateModal(false); resetModal() }}
          onSubmit={handleModalSubmit}
          submitLabel={createSuccess ? 'Selesai' : 'Buat Akun'}
        >
          {createSuccess ? (
            <div>
              <div
                style={{
                  padding: '1.5rem',
                  background: 'rgba(22,163,74,0.06)',
                  border: '1px solid rgba(22,163,74,0.2)',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <Icon name="check_circle" size={40} style={{ color: '#16a34a', marginBottom: '0.75rem' }} />
                <h4 style={{ margin: '0 0 0.5rem', color: 'var(--dash-primary)', fontWeight: 800 }}>
                  Admin Berhasil Dibuat!
                </h4>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem' }}>
                  Simpan kredensial berikut sebelum menutup.
                </p>
                <div
                  style={{
                    padding: '0.75rem',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.82rem',
                    textAlign: 'left',
                    lineHeight: 1.8,
                    color: '#334155',
                  }}
                >
                  <div><strong>Email:</strong> {createdCredentials.email}</div>
                  <div><strong>Password:</strong> {createdCredentials.password}</div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.55rem 1.25rem',
                    marginTop: '1rem',
                    background: credentialsCopied ? '#16a34a' : '#f1f5f9',
                    color: credentialsCopied ? '#fff' : 'var(--dash-primary)',
                    border: '1px solid ' + (credentialsCopied ? '#16a34a' : '#cbd5e1'),
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <Icon name={credentialsCopied ? 'check' : 'content_copy'} size={16} />
                  {credentialsCopied ? 'Tersalin!' : 'Salin Kredensial'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="adm-form-grid">
                <AdminFormField label="Nama Lengkap" required>
                  <input
                    type="text"
                    placeholder="Cth: Rudi Hartono"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </AdminFormField>
                <AdminFormField label="Email" required>
                  <input
                    type="email"
                    placeholder="nama@mpl.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </AdminFormField>
                <AdminFormField label="Role" required>
                  <select value={formRole} onChange={(e) => setFormRole(e.target.value)}>
                    {ROLE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </AdminFormField>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#78716c', margin: '1rem 0 0', lineHeight: 1.6 }}>
                ℹ️ Password sementara akan dibuat otomatis dan ditampilkan setelah akun dibuat.
              </p>
            </div>
          )}
        </AdminModal>
      )}

      {/* Reset Password Modal */}
      {showResetModal && resetTarget && (
        <AdminModal
          title="Reset Password Admin"
          subtitle={`Password baru untuk ${resetTarget.name}. Bagikan secara aman.`}
          onClose={() => { setShowResetModal(false); setResetPassword(''); setResetTarget(null) }}
          onSubmit={() => { setShowResetModal(false); setResetPassword(''); setResetTarget(null) }}
          submitLabel="Selesai"
        >
          <div
            style={{
              padding: '1.5rem',
              background: 'linear-gradient(135deg, rgba(242,184,36,0.05) 0%, rgba(242,184,36,0.15) 100%)',
              border: '1px solid rgba(242,184,36,0.3)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(242,184,36,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--dash-secondary)', color: 'var(--dash-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="key" size={18} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--dash-primary)' }}>
                Password Sementara
              </span>
            </div>

            <div>
              <div
                style={{
                  padding: '0.75rem',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  wordBreak: 'break-all',
                  color: '#334155',
                  marginBottom: '0.75rem',
                  lineHeight: 1.5,
                }}
              >
                {resetPassword}
              </div>
              <button
                type="button"
                onClick={handleCopyResetPassword}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.5rem 1rem',
                  background: resetPasswordCopied ? '#16a34a' : '#f1f5f9',
                  color: resetPasswordCopied ? '#fff' : 'var(--dash-primary)',
                  border: '1px solid ' + (resetPasswordCopied ? '#16a34a' : '#cbd5e1'),
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Icon name={resetPasswordCopied ? 'check' : 'content_copy'} size={16} />
                {resetPasswordCopied ? 'Tersalin!' : 'Salin Password'}
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#78716c', margin: '0.75rem 0 0', lineHeight: 1.6 }}>
              ℹ️ Admin harus mengganti password ini setelah login pertama.
            </p>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
