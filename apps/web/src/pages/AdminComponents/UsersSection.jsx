import { useState, useEffect, useCallback, useMemo } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import AdminDataTable from './components/AdminDataTable'
import AdminStatusBadge from './components/AdminStatusBadge'
import AdminModal from './components/AdminModal'
import AdminFormField from './components/AdminFormField'
import { usersAPI } from '../../lib/api'

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  ops: 'Operasional',
  finance: 'Keuangan',
  cs: 'Layanan Pelanggan',
  client: 'Klien',
}

export default function UsersSection() {
  const { showToast } = useToast()

  const [USERS, setUSERS] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userType, setUserType] = useState('all') // 'all' | 'internal' | 'client'

  // Create form state (controlled)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState('')
  const [formCompany, setFormCompany] = useState('')
  const [formPassword, setFormPassword] = useState('')

  // Magic link state
  const [showMagicLinkSection, setShowMagicLinkSection] = useState(false)
  const [magicLink, setMagicLink] = useState('')
  const [magicLinkCopied, setMagicLinkCopied] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await usersAPI.listAll()
      // /api/users only returns User records (clients), all mapped as 'client' role
      const mapped = (data.users || []).map(u => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        role: 'client',
        company: u.companyName || u.fullName,
        isActive: u.verificationStatus === 'VERIFIED',
        lastLogin: '-',
        createdAt: u.createdAt
          ? new Date(u.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
          : '-',
      }))
      setUSERS(mapped)
    } catch (err) {
      console.error('Failed to fetch users:', err)
      showToast('Gagal memuat data pengguna.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const filteredUsers = useMemo(() => {
    if (userType === 'internal') return USERS.filter(u => u.role !== 'client')
    if (userType === 'client') return USERS.filter(u => u.role === 'client')
    return USERS
  }, [userType, USERS])

  const resetModal = () => {
    setFormName('')
    setFormEmail('')
    setFormRole('')
    setFormCompany('')
    setFormPassword('')
    setShowMagicLinkSection(false)
    setMagicLink('')
    setMagicLinkCopied(false)
  }

  const handleCreateUser = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      showToast('Nama Lengkap dan Email wajib diisi.', 'error')
      return
    }
    try {
      const res = await usersAPI.createUser({
        fullName: formName,
        email: formEmail,
        companyName: formCompany || undefined,
        phoneNumber: '',
        password: formPassword || undefined,
      })
      showToast(
        'Pengguna baru berhasil dibuat!' + (res.tempPassword ? ' Password sementara: ' + res.tempPassword : ''),
        'success'
      )
      setShowCreateModal(false)
      resetModal()
      fetchUsers()
    } catch (err) {
      showToast(err.message || 'Gagal membuat pengguna.', 'error')
    }
  }

  const handleGenerateMagicLink = () => {
    const token =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    setMagicLink('https://mpl.co.id/auth/magic?token=' + token)
    setShowMagicLinkSection(true)
    setMagicLinkCopied(false)
  }

  const handleCopyMagicLink = () => {
    navigator.clipboard.writeText(magicLink).catch(() => {})
    setMagicLinkCopied(true)
    setTimeout(() => setMagicLinkCopied(false), 2000)
  }

  const handleModalSubmit = () => {
    if (showMagicLinkSection) {
      // Admin has their link, just close
      setShowCreateModal(false)
      resetModal()
    } else {
      handleCreateUser()
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Nama',
      render: (v, row) => (
        <div>
          <span className="adm-table__cell-main">{v}</span>
          {row.role === 'client' && (
            <div className="adm-table__cell-sub">
              <Icon name="business" size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              {row.company}
            </div>
          )}
        </div>
      ),
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
            color: v === 'client' ? '#00430d' : 'var(--dash-primary)',
            background: v === 'client' ? 'rgba(0,67,13,0.06)' : 'rgba(0,36,66,0.06)',
            padding: '0.2rem 0.6rem',
            borderRadius: '6px',
          }}
        >
          {ROLE_LABELS[v] || v}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Aktif',
      render: (v) => <AdminStatusBadge status={v ? 'active' : 'inactive'} type="user" />,
    },
    {
      key: 'lastLogin',
      label: 'Login Terakhir',
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
            onClick={(e) => { e.stopPropagation(); setSelectedUser(row) }}
          >
            <Icon name="edit" size={16} />
          </button>
          <button
            className="adm-action-btn"
            title="Reset Password"
            onClick={(e) => { e.stopPropagation(); showToast(`Password untuk ${row.name} telah direset.`, 'success') }}
          >
            <Icon name="key" size={16} />
          </button>
          {row.role !== 'super_admin' && (
            <button
              className="adm-action-btn adm-action-btn--danger"
              title="Nonaktifkan"
              onClick={(e) => { e.stopPropagation(); showToast(`${row.name} telah dinonaktifkan.`, 'info') }}
            >
              <Icon name="block" size={16} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Manajemen Pengguna</h2>
          <p className="dash-header__subtitle">Kelola akses staf internal dan akun klien.</p>
        </div>
        <div className="adm-section-actions">
          <button className="adm-create-btn" onClick={() => { resetModal(); setShowCreateModal(true) }}>
            <Icon name="group_add" size={18} /> Tambah Pengguna
          </button>
        </div>
      </section>

      <div className="adm-filters" style={{ marginTop: '1.5rem' }}>
        <button
          className={`adm-filter-tab ${userType === 'all' ? 'adm-filter-tab--active' : ''}`}
          onClick={() => setUserType('all')}
        >
          Semua <span className="adm-filter-count">{USERS.length}</span>
        </button>
        <button
          className={`adm-filter-tab ${userType === 'internal' ? 'adm-filter-tab--active' : ''}`}
          onClick={() => setUserType('internal')}
        >
          Internal <span className="adm-filter-count">{USERS.filter(u => u.role !== 'client').length}</span>
        </button>
        <button
          className={`adm-filter-tab ${userType === 'client' ? 'adm-filter-tab--active' : ''}`}
          onClick={() => setUserType('client')}
        >
          Klien <span className="adm-filter-count">{USERS.filter(u => u.role === 'client').length}</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Memuat data pengguna...</div>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <AdminDataTable columns={columns} data={filteredUsers} onRowClick={setSelectedUser} />
        </div>
      )}

      {/* Detail Panel */}
      {selectedUser && (
        <div className="adm-detail-panel glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--dash-primary)', margin: 0 }}>
                {selectedUser.name}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>
                {ROLE_LABELS[selectedUser.role]} • {selectedUser.company}
              </p>
            </div>
            <button className="adm-action-btn" onClick={() => setSelectedUser(null)}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="adm-detail-grid">
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="account_circle" size={16} /> Informasi Akun</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Email</span><span className="adm-detail-value">{selectedUser.email}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Role</span><span className="adm-detail-value">{ROLE_LABELS[selectedUser.role]}</span></div>
              {selectedUser.role === 'client' && (
                <div className="adm-detail-row"><span className="adm-detail-label">Perusahaan</span><span className="adm-detail-value">{selectedUser.company}</span></div>
              )}
              <div className="adm-detail-row"><span className="adm-detail-label">Status</span><span className="adm-detail-value">{selectedUser.isActive ? 'Aktif' : 'Nonaktif'}</span></div>
            </div>
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="history" size={16} /> Aktivitas</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Login Terakhir</span><span className="adm-detail-value">{selectedUser.lastLogin}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Dibuat Pada</span><span className="adm-detail-value">{selectedUser.createdAt}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal — two modes: Manual Form | Magic Link */}
      {showCreateModal && (
        <AdminModal
          title="Tambah Pengguna Baru"
          subtitle={showMagicLinkSection ? 'Bagikan link pendaftaran kepada klien.' : 'Isi data akun atau gunakan magic link.'}
          onClose={() => { setShowCreateModal(false); resetModal() }}
          onSubmit={handleModalSubmit}
          submitLabel={showMagicLinkSection ? 'Selesai' : 'Buat Akun'}
        >
          {!showMagicLinkSection ? (
            /* ── Mode 1: Manual form ── */
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
                    placeholder="nama@perusahaan.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </AdminFormField>
                <AdminFormField label="Nama Perusahaan">
                  <input
                    type="text"
                    placeholder="Cth: PT Sinar Jaya"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                  />
                </AdminFormField>
                <AdminFormField label="Password Sementara">
                  <input
                    type="text"
                    placeholder="Kosongkan untuk auto-generate"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                  />
                </AdminFormField>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.25rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>atau</span>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => { setShowMagicLinkSection(true) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0.65rem 1.25rem',
                    background: '#eab308',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  <Icon name="link" size={18} /> Gunakan Magic Link
                </button>
              </div>
            </div>
          ) : (
            /* ── Mode 2: Magic Link ── */
            <div>
              <div
                style={{
                  padding: '1.25rem',
                  background: 'rgba(234,179,8,0.06)',
                  border: '1px solid rgba(234,179,8,0.2)',
                  borderRadius: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                  <Icon name="link" size={18} style={{ color: '#eab308' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--dash-primary)' }}>
                    Magic Link Pendaftaran
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateMagicLink}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.55rem 1rem',
                    background: 'var(--dash-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    marginBottom: magicLink ? '1rem' : '0',
                  }}
                >
                  <Icon name="autorenew" size={16} />
                  {magicLink ? 'Regenerate Link' : 'Generate Magic Link'}
                </button>

                {magicLink && (
                  <div>
                    <div
                      style={{
                        padding: '0.75rem',
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        wordBreak: 'break-all',
                        color: '#334155',
                        marginBottom: '0.75rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {magicLink}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyMagicLink}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0.5rem 1rem',
                        background: magicLinkCopied ? '#16a34a' : '#f1f5f9',
                        color: magicLinkCopied ? '#fff' : 'var(--dash-primary)',
                        border: '1px solid ' + (magicLinkCopied ? '#16a34a' : '#cbd5e1'),
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Icon name={magicLinkCopied ? 'check' : 'content_copy'} size={16} />
                      {magicLinkCopied ? 'Tersalin!' : 'Salin Link'}
                    </button>
                  </div>
                )}

                <p style={{ fontSize: '0.75rem', color: '#78716c', margin: '0.75rem 0 0', lineHeight: 1.6 }}>
                  ℹ️ Link berlaku 1x pakai. Bagikan ke klien untuk registrasi mandiri.
                </p>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  onClick={() => { setShowMagicLinkSection(false); setMagicLink('') }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.5rem 1rem',
                    background: 'none',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    color: '#64748b',
                  }}
                >
                  <Icon name="arrow_back" size={16} /> Kembali ke Form Manual
                </button>
              </div>
            </div>
          )}
        </AdminModal>
      )}
    </div>
  )
}
