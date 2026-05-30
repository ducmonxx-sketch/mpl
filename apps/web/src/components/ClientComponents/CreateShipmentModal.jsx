import { useState } from 'react'
import Icon from '../Icon'
import { useToast } from '../../contexts/ToastContext'
import { shipmentsAPI } from '../../lib/api'

export default function CreateShipmentModal({ onClose, onCreated }) {
  const { showToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    originComplete: '',
    originZip: '',
    originProv: '',
    destComplete: '',
    destZip: '',
    destProv: '',
    type: '',
    metricType: 'weight',
    metricValue: '',
    notes: ''
  })
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Build API payload
      const originLocation = [formData.originComplete, formData.originZip, formData.originProv].filter(Boolean).join(', ')
      const destinationLocation = [formData.destComplete, formData.destZip, formData.destProv].filter(Boolean).join(', ')
      
      await shipmentsAPI.create({
        packageType: formData.type,
        weightKg: parseFloat(formData.metricValue) || 0,
        serviceLevel: formData.metricType === 'weight' ? 'Darat' : 'Darat',
        originLocation,
        destinationLocation,
        specialNotes: formData.notes || null,
      })

      showToast('Pengiriman berhasil dibuat dan masuk antrean!', 'success')
      
      if (onCreated) {
        onCreated()
      } else {
        onClose()
      }
    } catch (err) {
      showToast(err.message || 'Gagal membuat pengiriman. Silakan coba lagi.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const ReqAsterisk = () => <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
  
  // Block "e", "-", ".", "+" for zipcode & numeric inputs
  const blockSymbols = (e) => {
    if (["e", "E", "+", "-", "."].includes(e.key)) {
      e.preventDefault()
    }
  }

  return (
    <div className="dash-overlay dash-overlay--visible" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <form className="glass-card shipment-form-card" style={{ width: '700px', maxWidth: '95%', padding: '2rem', animation: 'dashFadeUp 0.3s ease both', pointerEvents: 'auto', background: 'var(--dash-surface)', maxHeight: '90vh', overflowX: 'hidden', overflowY: 'auto' }} onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--dash-primary)', fontSize: '1.5rem', fontWeight: 800 }}>Buat Pengiriman Baru</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Masukkan spesifikasi dan detail alamat pengiriman Anda.</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: '#e2e8f0', borderRadius: '50%', width:'32px', height:'32px', border: 'none', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="close" size={18} /></button>
        </div>

        <div className="shipment-form-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
          
          {/* Asal */}
          <div style={{ gridColumn: 'span 2', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="location_on" size={18} />
            <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--dash-primary)', fontWeight: 800 }}>Alamat Asal</h4>
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--dash-primary)' }}>Alamat Lengkap<ReqAsterisk/></label>
            <input required type="text" name="originComplete" placeholder="Cth: Jl. Sudirman No 123, Blok A, Kota Administrasi" value={formData.originComplete} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--dash-primary)' }}>Kode Pos<ReqAsterisk/></label>
            <input required type="number" onKeyDown={blockSymbols} name="originZip" placeholder="Cth: 10220" value={formData.originZip} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--dash-primary)' }}>Provinsi<ReqAsterisk/></label>
            <input required type="text" name="originProv" placeholder="Cth: DKI Jakarta" value={formData.originProv} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit' }} />
          </div>

          {/* Tujuan */}
          <div style={{ gridColumn: 'span 2', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="golf_course" size={18} />
            <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--dash-primary)', fontWeight: 800 }}>Alamat Tujuan</h4>
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--dash-primary)' }}>Alamat Lengkap<ReqAsterisk/></label>
            <input required type="text" name="destComplete" placeholder="Cth: Jl. Raya Darmo No 45, Kompleks Ruko" value={formData.destComplete} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--dash-primary)' }}>Kode Pos<ReqAsterisk/></label>
            <input required type="number" onKeyDown={blockSymbols} name="destZip" placeholder="Cth: 60241" value={formData.destZip} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--dash-primary)' }}>Provinsi<ReqAsterisk/></label>
            <input required type="text" name="destProv" placeholder="Cth: Jawa Timur" value={formData.destProv} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit' }} />
          </div>

          {/* Sifat Barang */}
          <div style={{ gridColumn: 'span 2', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="inventory_2" size={18} />
            <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--dash-primary)', fontWeight: 800 }}>Detail Barang</h4>
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--dash-primary)' }}>Spesifikasi / Jenis Barang<ReqAsterisk/></label>
            <input required type="text" name="type" placeholder="Cth: Komponen Elektronik / Mesin Fotokopi" value={formData.type} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--dash-primary)' }}>Metrik Pengukuran<ReqAsterisk/></label>
            <select name="metricType" value={formData.metricType} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit', background: '#fff' }}>
              <option value="weight">Berat Total (kg)</option>
              <option value="qty">Jumlah Barang (pcs)</option>
            </select>
          </div>
           <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--dash-primary)' }}>Masukan Nilai {formData.metricType === 'weight' ? '(kg)' : '(pcs)'}<ReqAsterisk/></label>
            <input required type="number" onKeyDown={blockSymbols} name="metricValue" min="1" placeholder={formData.metricType === 'weight' ? "Cth: 150" : "Cth: 12"} value={formData.metricValue} onChange={handleChange} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit', background: '#fff' }} />
          </div>
          
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--dash-primary)' }}>Instruksi / Catatan Tambahan (Opsional)</label>
            <textarea name="notes" placeholder="Cth: Harap berhati-hati, barang mudah pecah atau butuh penanganan khusus." value={formData.notes} onChange={handleChange} rows="3" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical', outline: 'none', fontFamily: 'inherit', background: '#fff' }}></textarea>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%', padding: '1rem', background: 'var(--dash-secondary)', color: 'var(--dash-primary)', border: 'none', borderRadius: '8px', fontWeight: 900, fontSize: '0.95rem', cursor: submitting ? 'not-allowed' : 'pointer', marginTop: '2rem', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(254, 195, 48, 0.4)',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? (
            <>
              <div style={{ width: 18, height: 18, border: '2px solid rgba(0,36,66,0.3)', borderTopColor: 'var(--dash-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              MENGIRIM...
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </>
          ) : (
            <>
              <Icon name="send" size={18} /> BUAT PENGIRIMAN
            </>
          )}
        </button>
      </form>
    </div>
  )
}
