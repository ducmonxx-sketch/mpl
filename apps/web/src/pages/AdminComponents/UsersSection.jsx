import { useState, useEffect, useMemo } from 'react'
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

const COMPANIES = ['PT Sinar Jaya', 'CV Maju Bersama', 'PT Nusantara Lestari', 'PT Karya Mandiri', 'CV Sejahtera', 'PT Abadi Sentosa']

export default function UsersSection() {
  const { showToast } = useToast()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  
  const [USERS, setUSERS] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter toggle
  const [userType, setUserType] = useState('all') // 'all', 'internal', 'client'

  // Form states
  const [formRole, setFormRole] = useState('')
  const [formCompany, setFormCompany] = useState('')

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true)
      try {
        const data = await usersAPI.listAll()
        const mapped = (data.users || []).map(u => ({
          id: u.id,
          name: u.fullName,
          email: u.email,
          role: u.role.toLowerCase(),
          company: u.companyName || 'PT Mahkota Putra Logistik',
          isActive: u.status === 'ACTIVE',
          lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
          createdAt: new Date(u.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        }))
        setUSERS(mapped)
      } catch (err) {
        console.error('Failed to fetch users:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    if (userType === 'internal') return USERS.filter(u => u.role !== 'client')
    if (userType === 'client') return USERS.filter(u => u.role === 'client')
    return USERS
  }, [userType, USERS])

  // Company count check
  const getCompanyUserCount = (companyName) => {
    return USERS.filter(u => u.role === 'client' && u.company === companyName).length
  }

  const columns = [
    { key: 'name', label: 'Nama', render: (v, row) => (
      <div>
        <span className="adm-table__cell-main">{v}</span>
        {row.role === 'client' && <div className="adm-table__cell-sub"><Icon name="business" size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }}/>{row.company}</div>}
      </div>
    )},
    { key: 'email', label: 'Email', render: (v) => <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{v}</span> },
    { key: 'role', label: 'Role', render: (v) => (
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: v === 'client' ? '#00430d' : 'var(--dash-primary)', background: v === 'client' ? 'rgba(0,67,13,0.06)' : 'rgba(0,36,66,0.06)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
        {ROLE_LABELS[v] || v}
      </span>
    )},
    { key: 'isActive', label: 'Aktif', render: (v) => <AdminStatusBadge status={v ? 'active' : 'inactive'} type="user" /> },
    { key: 'lastLogin', label: 'Login Terakhir', render: (v) => <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{v}</span> },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="adm-actions">
        <button className="adm-action-btn" title="Detail" onClick={(e) => { e.stopPropagation(); setSelectedUser(row) }}>
          <Icon name="edit" size={16} />
        </button>
        <button className="adm-action-btn" title="Reset Password" onClick={(e) => { e.stopPropagation(); showToast(`Password untuk ${row.name} telah direset.`, 'success') }}>
          <Icon name="key" size={16} />
        </button>
        {row.role !== 'super_admin' && (
          <button className="adm-action-btn adm-action-btn--danger" title="Nonaktifkan" onClick={(e) => { e.stopPropagation(); showToast(`${row.name} telah dinonaktifkan.`, 'info') }}>
            <Icon name="block" size={16} />
          </button>
        )}
      </div>
    )},
  ]

  const handleCreateUser = (e) => {
    e.preventDefault()
    if (formRole === 'client' && formCompany) {
      const count = getCompanyUserCount(formCompany)
      if (count >= 2) {
        showToast(`Gagal: ${formCompany} sudah mencapai batas maksimal 2 akun pengguna.`, 'error')
        return
      }
    }
    showToast('Pengguna baru berhasil dibuat! Password sementara telah disiapkan.', 'success')
    setShowCreateModal(false)
    setFormRole('')
    setFormCompany('')
  }

  const handleGenerateMagicLink = () => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const magicLink = `https://dashboard.mpl.co.id/admin/register?token=${token}`
    showToast(`Magic Link: ${magicLink} (Tersalin ke clipboard. Berlaku 1x pakai)`, 'success')
    navigator.clipboard.writeText(magicLink).catch(() => {})
  }

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Manajemen Pengguna</h2>
          <p className="dash-header__subtitle">Kelola akses staf internal dan akun klien (Maks. 2 akun per klien).</p>
        </div>
        <div className="adm-section-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="adm-action-btn" onClick={handleGenerateMagicLink} style={{ padding: '0.6rem 1rem', background: '#eab308', color: '#fff', borderRadius: '8px', fontWeight: 700, border: 'none' }}>
            <Icon name="link" size={18} style={{ marginRight: '6px' }} /> Magic Button
          </button>
          <button className="adm-create-btn" onClick={() => setShowCreateModal(true)}>
            <Icon name="group_add" size={18} /> Tambah Pengguna
          </button>
        </div>
      </section>

      <div className="adm-filters" style={{ marginTop: '1.5rem' }}>
        <button className={`adm-filter-tab ${userType === 'all' ? 'adm-filter-tab--active' : ''}`} onClick={() => setUserType('all')}>Semua <span className="adm-filter-count">{USERS.length}</span></button>
        <button className={`adm-filter-tab ${userType === 'internal' ? 'adm-filter-tab--active' : ''}`} onClick={() => setUserType('internal')}>Internal <span className="adm-filter-count">{USERS.filter(u => u.role !== 'client').length}</span></button>
        <button className={`adm-filter-tab ${userType === 'client' ? 'adm-filter-tab--active' : ''}`} onClick={() => setUserType('client')}>Klien <span className="adm-filter-count">{USERS.filter(u => u.role === 'client').length}</span></button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <AdminDataTable columns={columns} data={filteredUsers} onRowClick={setSelectedUser} />
      </div>

      {/* Detail Panel */}
      {selectedUser && (
        <div className="adm-detail-panel glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--dash-primary)', margin: 0 }}>{selectedUser.name}</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>{ROLE_LABELS[selectedUser.role]} • {selectedUser.company}</p>
            </div>
            <button className="adm-action-btn" onClick={() => setSelectedUser(null)}><Icon name="close" size={18} /></button>
          </div>
          <div className="adm-detail-grid">
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="account_circle" size={16} /> Informasi Akun</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Email</span><span className="adm-detail-value">{selectedUser.email}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Role</span><span className="adm-detail-value">{ROLE_LABELS[selectedUser.role]}</span></div>
              {selectedUser.role === 'client' && <div className="adm-detail-row"><span className="adm-detail-label">Perusahaan</span><span className="adm-detail-value">{selectedUser.company}</span></div>}
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

      {/* Create Modal */}
      {showCreateModal && (
        <AdminModal title="Tambah Pengguna Baru" subtitle="Akun baru akan memerlukan ganti password pada login pertama." onClose={() => setShowCreateModal(false)} onSubmit={handleCreateUser} submitLabel="Buat Akun">
          <div className="adm-form-grid">
            <AdminFormField label="Nama Lengkap" required><input type="text" placeholder="Cth: Rudi Hartono" required /></AdminFormField>
            <AdminFormField label="Email" required><input type="email" placeholder="nama@perusahaan.com" required /></AdminFormField>
            <AdminFormField label="Role / Jabatan" required>
              <select value={formRole} onChange={(e) => setFormRole(e.target.value)} required>
                <option value="" disabled>Pilih Role...</option>
                <option value="client">Klien (Akses Eksternal)</option>
                <option value="ops">Operasional (Internal)</option>
                <option value="finance">Keuangan (Internal)</option>
                <option value="cs">Layanan Pelanggan (Internal)</option>
                <option value="super_admin">Super Admin (Internal)</option>
              </select>
            </AdminFormField>

            {formRole === 'client' && (
              <AdminFormField label="Perusahaan Klien" required>
                <select value={formCompany} onChange={(e) => setFormCompany(e.target.value)} required>
                  <option value="" disabled>Pilih Perusahaan...</option>
                  {COMPANIES.map(c => {
                    const count = getCompanyUserCount(c)
                    const isFull = count >= 2
                    return (
                      <option key={c} value={c} disabled={isFull}>
                        {c} ({count}/2 Akun) {isFull ? '- PENUH' : ''}
                      </option>
                    )
                  })}
                </select>
              </AdminFormField>
            )}

            <AdminFormField label="Password Sementara" required={false} className={formRole === 'client' ? "adm-form-field--full" : ""}>
              <input type="text" placeholder="Akan di-generate otomatis jika kosong" />
            </AdminFormField>
          </div>
          <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'rgba(254,195,48,0.06)', borderRadius: '10px', border: '1px solid rgba(254,195,48,0.12)' }}>
            <p style={{ fontSize: '0.75rem', color: '#795900', margin: 0, lineHeight: 1.6 }}>
              <strong>⚠️ Catatan:</strong> Bagikan credential melalui WhatsApp. Setiap klien maksimal <strong>2 akun pengguna</strong> yang berwenang.
            </p>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
