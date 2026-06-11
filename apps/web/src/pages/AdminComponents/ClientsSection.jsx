import { useState, useEffect, useCallback } from 'react'
import Icon from '../../components/Icon'
import { useToast } from '../../contexts/ToastContext'
import AdminDataTable from './components/AdminDataTable'
import AdminPagination from './components/AdminPagination'
import AdminModal from './components/AdminModal'
import AdminFormField from './components/AdminFormField'
import { usersAPI } from '../../lib/api'

export default function ClientsSection() {
  const { showToast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [CLIENTS, setCLIENTS] = useState([])
  const [loading, setLoading] = useState(true)

  // Form state (controlled)
  const [formCompanyName, setFormCompanyName] = useState('')
  const [formPicName, setFormPicName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formNpwp, setFormNpwp] = useState('')

  const fetchClients = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const data = await usersAPI.listAll()
      const users = data.users || []
      // Show ALL users — no role filter (User model has no role field)
      const mapped = users.map(u => ({
        id: u.id,
        companyName: u.companyName || u.fullName,
        isActive: u.verificationStatus === 'VERIFIED',
        shipmentCount: u._count?.shipments || 0,
        pics: [{ name: u.fullName, phone: u.phoneNumber || '-', email: u.email }],
        notes: '',
        address: u.address || '-',
        city: u.city || '-',
        npwp: u.npwp || '-',
      }))
      setCLIENTS(mapped)
    } catch (err) {
      console.error('Failed to fetch clients:', err)
      showToast('Gagal memuat data klien.', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchClients()
    const interval = setInterval(() => fetchClients({ silent: true }), 8000)
    return () => clearInterval(interval)
  }, [fetchClients])

  const [isEditMode, setIsEditMode] = useState(false)
  const [editingClientId, setEditingClientId] = useState(null)

  const resetForm = () => {
    setIsEditMode(false)
    setEditingClientId(null)
    setFormCompanyName('')
    setFormPicName('')
    setFormPhone('')
    setFormEmail('')
    setFormCity('')
    setFormAddress('')
    setFormNpwp('')
  }

  const handleOpenEdit = (row) => {
    setIsEditMode(true)
    setEditingClientId(row.id)
    setFormCompanyName(row.companyName || '')
    setFormPicName(row.pics[0].name || '')
    setFormPhone(row.pics[0].phone || '')
    setFormEmail(row.pics[0].email || '')
    setFormCity(row.city || '')
    setFormAddress(row.address || '')
    setFormNpwp(row.npwp || '')
    setShowCreateModal(true)
  }

  const handleCreateClient = async () => {
    if (!formCompanyName.trim() || !formPicName.trim() || !formPhone.trim() || !formEmail.trim() || !formCity.trim() || !formAddress.trim() || !formNpwp.trim()) {
      showToast('Harap isi semua field yang wajib diisi.', 'error')
      return
    }
    try {
      const res = await usersAPI.createUser({
        fullName: formPicName,
        companyName: formCompanyName,
        email: formEmail,
        phoneNumber: formPhone,
        city: formCity,
        address: formAddress,
        npwp: formNpwp,
      })
      setShowCreateModal(false)
      resetForm()
      fetchClients()
      // The temp password is shown only once — keep the toast sticky (duration 0)
      // so the admin can copy it before dismissing. (Will be emailed/WA'd directly
      // to the client in a future update — see docs/credentials-delivery.md.)
      if (res?.temporaryPassword) {
        showToast(
          `Klien dibuat! Password sementara: ${res.temporaryPassword} — salin & bagikan ke klien sekarang (hanya ditampilkan sekali).`,
          'success',
          0,
        )
      } else {
        showToast('Klien baru berhasil ditambahkan!', 'success')
      }
    } catch (err) {
      showToast(err.message || 'Gagal menambah klien.', 'error')
    }
  }

  const handleUpdateClient = async () => {
    if (!formCompanyName.trim() || !formPicName.trim() || !formPhone.trim() || !formEmail.trim() || !formCity.trim() || !formAddress.trim() || !formNpwp.trim()) {
      showToast('Harap isi semua field yang wajib diisi.', 'error')
      return
    }
    try {
      await usersAPI.updateUser(editingClientId, {
        fullName: formPicName,
        companyName: formCompanyName,
        email: formEmail,
        phoneNumber: formPhone,
        city: formCity,
        address: formAddress,
        npwp: formNpwp,
      })
      showToast('Klien berhasil diperbarui!', 'success')
      setShowCreateModal(false)
      resetForm()
      fetchClients()
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui klien.', 'error')
    }
  }

  const handleDeleteClient = async (id, name) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus klien "${name}"? Semua data pengiriman dan faktur terkait juga akan terhapus.`)) {
      return
    }
    try {
      await usersAPI.deleteUser(id)
      showToast('Klien berhasil dihapus.', 'success')
      if (selectedClient?.id === id) {
        setSelectedClient(null)
      }
      fetchClients()
    } catch (err) {
      showToast(err.message || 'Gagal menghapus klien.', 'error')
    }
  }

  const filtered = CLIENTS.filter(c =>
    !searchQuery ||
    c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.pics.some(pic => pic.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const columns = [
    {
      key: 'expand',
      label: '',
      width: '40px',
      render: (_, __, { toggleRow, isExpanded }) => (
        <button
          className="adm-action-btn"
          onClick={toggleRow}
          style={{ padding: '0.2rem', margin: 0, width: 'auto', background: isExpanded ? 'rgba(254,195,48,0.1)' : 'transparent' }}
          title="Lihat semua PIC"
        >
          <Icon name={isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} size={20} />
        </button>
      ),
    },
    {
      key: 'companyName',
      label: 'Nama Perusahaan',
      render: (v) => <span className="adm-table__cell-main">{v}</span>,
    },
    { key: 'picName', label: 'PIC Utama', render: (_, row) => row.pics[0].name },
    { key: 'phone', label: 'Telepon', render: (_, row) => row.pics[0].phone },
    {
      key: 'email',
      label: 'Email',
      render: (_, row) => (
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{row.pics[0].email}</span>
      ),
    },
    {
      key: 'isActive',
      label: 'Aktif',
      render: (v) =>
        v ? (
          <span style={{ color: 'var(--dash-tertiary-light)', fontWeight: 700 }}>✅ Ya</span>
        ) : (
          <span style={{ color: 'var(--dash-error)', fontWeight: 700 }}>❌ Tidak</span>
        ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div className="adm-actions">
          <button
            className="adm-action-btn"
            title="Lihat Detail"
            onClick={(e) => { e.stopPropagation(); setSelectedClient(row) }}
          >
            <Icon name="visibility" size={16} />
          </button>
          <button
            className="adm-action-btn"
            title="Edit"
            onClick={(e) => { e.stopPropagation(); handleOpenEdit(row) }}
          >
            <Icon name="edit" size={16} />
          </button>
          <button
            className="adm-action-btn adm-action-btn--danger"
            title="Hapus"
            onClick={(e) => { e.stopPropagation(); handleDeleteClient(row.id, row.companyName) }}
          >
            <Icon name="delete" size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="dash-content">
      <section className="dash-header">
        <div>
          <h2 className="dash-header__title">Manajemen Klien</h2>
          <p className="dash-header__subtitle">Database klien korporat dengan kontak dan riwayat pengiriman.</p>
        </div>
        <div className="adm-section-actions">
          <button className="adm-create-btn" onClick={() => setShowCreateModal(true)}>
            <Icon name="group_add" size={18} /> Tambah Klien
          </button>
        </div>
      </section>

      <div className="adm-search-bar">
        <Icon name="search" size={18} />
        <input
          type="text"
          placeholder="Cari nama perusahaan atau PIC..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Memuat data klien...</div>
      ) : (
        <div style={{ marginTop: '1.25rem' }}>
          <AdminDataTable
            columns={columns}
            data={filtered}
            onRowClick={setSelectedClient}
            expandableContent={(row) => (
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--dash-primary)' }}>
                  Kontak Person In Charge (PIC)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {row.pics.map((pic, idx) => (
                    <div
                      key={idx}
                      style={{ padding: '0.75rem', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--dash-text)' }}>
                        {pic.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                        <Icon name="phone" size={12} /> {pic.phone}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Icon name="email" size={12} /> {pic.email}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          />
          <AdminPagination
            currentPage={currentPage}
            totalPages={1}
            totalItems={filtered.length}
            itemsPerPage={20}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Detail Panel */}
      {selectedClient && (
        <div className="adm-detail-panel glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--dash-primary)', margin: 0 }}>
                {selectedClient.companyName}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>
                PIC Utama: {selectedClient.pics[0].name}
              </p>
            </div>
            <button className="adm-action-btn" onClick={() => setSelectedClient(null)}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="adm-detail-grid">
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="business" size={16} /> Informasi Perusahaan</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Telepon</span><span className="adm-detail-value">{selectedClient.pics[0].phone}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Email</span><span className="adm-detail-value">{selectedClient.pics[0].email}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Alamat</span><span className="adm-detail-value">{selectedClient.address}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Kota</span><span className="adm-detail-value">{selectedClient.city}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">NPWP</span><span className="adm-detail-value">{selectedClient.npwp || '-'}</span></div>
            </div>
            <div className="adm-detail-section">
              <h4 className="adm-detail-section__title"><Icon name="local_shipping" size={16} /> Riwayat Pengiriman</h4>
              <div className="adm-detail-row"><span className="adm-detail-label">Total Pengiriman</span><span className="adm-detail-value">{selectedClient.shipmentCount}</span></div>
              <div className="adm-detail-row"><span className="adm-detail-label">Status Akun</span><span className="adm-detail-value">{selectedClient.isActive ? 'Terverifikasi' : 'Belum Terverifikasi'}</span></div>
              {selectedClient.notes && (
                <div className="adm-detail-row"><span className="adm-detail-label">Catatan</span><span className="adm-detail-value">{selectedClient.notes}</span></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <AdminModal
          title={isEditMode ? "Edit Klien" : "Tambah Klien Baru"}
          subtitle={isEditMode ? "Ubah data klien korporat." : "Masukkan data klien korporat."}
          onClose={() => { setShowCreateModal(false); resetForm() }}
          onSubmit={isEditMode ? handleUpdateClient : handleCreateClient}
          submitLabel={isEditMode ? "Simpan Perubahan" : "Simpan Klien"}
        >
          <div className="adm-form-grid">
            <AdminFormField label="Nama Perusahaan" required fullWidth>
              <input
                type="text"
                placeholder="Cth: PT Sinar Jaya"
                value={formCompanyName}
                onChange={(e) => setFormCompanyName(e.target.value)}
                required
              />
            </AdminFormField>
            <AdminFormField label="Nama PIC" required>
              <input
                type="text"
                placeholder="Cth: Budi Santoso"
                value={formPicName}
                onChange={(e) => setFormPicName(e.target.value)}
                required
              />
            </AdminFormField>
            <AdminFormField label="No. Telepon" required>
              <input
                type="text"
                placeholder="0812-xxxx-xxxx"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                required
              />
            </AdminFormField>
            <AdminFormField label="Email" required>
              <input
                type="email"
                placeholder="email@perusahaan.co.id"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
              />
            </AdminFormField>
            <AdminFormField label="Kota" required>
              <input
                type="text"
                placeholder="Cth: Jakarta"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                required
              />
            </AdminFormField>
            <AdminFormField label="Alamat" required fullWidth>
              <input
                type="text"
                placeholder="Alamat lengkap perusahaan"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                required
              />
            </AdminFormField>
            <AdminFormField label="NPWP" required>
              <input
                type="text"
                placeholder="01.234.567.8-901.000"
                value={formNpwp}
                onChange={(e) => setFormNpwp(e.target.value)}
                required
              />
            </AdminFormField>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
