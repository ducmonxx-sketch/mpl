import { useState } from 'react'
import Icon from '../../../components/Icon'

export default function TrackingDetail({ shipment, showToast, isAdmin }) {
  const [manualStatus, setManualStatus] = useState('picked')
  const [manualLocation, setManualLocation] = useState('')

  return (
    <div className="track-detail glass-card">
      <div className="track-panel__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
        
        {/* Left Column: Timeline */}
        <div>
          <h3 className="track-panel__section-title">
            <Icon name="route" size={16} />
            Rincian Perjalanan
          </h3>
          <div className="track-timeline">
            {shipment.timeline.map((t, i) => (
              <div key={i} className={`track-timeline__item${t.status === 'upcoming' ? ' track-timeline__item--dim' : ''}`}>
                {i < shipment.timeline.length - 1 && (
                  <div className={`track-timeline__line${t.status === 'done' ? ' track-timeline__line--done' : ''}`} />
                )}
                <div className={`track-timeline__dot track-timeline__dot--${t.status}`}>
                  {t.status === 'done' && <Icon name="check" size={12} />}
                  {t.status === 'active' && <Icon name="local_shipping" size={12} />}
                </div>
                <div className="track-timeline__content">
                  <p className="track-timeline__step">{t.step}</p>
                  <p className="track-timeline__meta">{t.location} • {t.date}</p>
                  {t.note && (
                    <div className="track-timeline__note">
                      <p>{t.note}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Driver & Action */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="track-driver">
            <h4 className="track-driver__title">Personel Ditugaskan</h4>
            <div className="track-driver__card">
              <div className="track-driver__avatar-placeholder">
                <Icon name="person" size={24} />
              </div>
              <div className="track-driver__info">
                <p className="track-driver__name">{shipment.driver.name}</p>
                <div className="track-driver__vehicle">
                  <Icon name="local_shipping" size={12} />
                  <span>{shipment.driver.vehicle}</span>
                </div>
              </div>
              <div className="track-driver__actions">
                <button className="track-driver__btn" aria-label="Telepon" onClick={() => showToast(`Mensimulasikan panggilan ke ${shipment.driver.name}...`, 'info')}><Icon name="call" size={18} /></button>
                <button className="track-driver__btn track-driver__btn--primary" aria-label="Chat" onClick={() => showToast(`Membuka obrolan aman dengan ${shipment.driver.name}...`, 'success')}><Icon name="chat" size={18} /></button>
              </div>
            </div>
          </div>

          <div className="track-panel__footer" style={{ padding: 0, background: 'none' }}>
            <button className="track-panel__download" style={{ width: '100%', justifyContent: 'center' }} onClick={() => showToast(`Manifes untuk ${shipment.id} sedang diunduh.`, 'success')}>
              <Icon name="description" size={18} />
              <span>Unduh Manifes (PDF)</span>
            </button>
          </div>

          {isAdmin && (
            <div className="track-admin-update" style={{ marginTop: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--dash-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="edit_location" size={16} /> Update Status Manual
              </h4>
              <select value={manualStatus} onChange={e => setManualStatus(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '0.75rem', fontSize: '0.8rem', outline: 'none' }}>
                <option value="" disabled>Pilih Status...</option>
                {shipment.timeline.map((t, idx) => (
                  <option key={idx} value={t.step}>{t.step}</option>
                ))}
              </select>
              <input type="text" placeholder="Lokasi / Keterangan..." value={manualLocation} onChange={e => setManualLocation(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '0.75rem', fontSize: '0.8rem', outline: 'none' }} />
              
              {/* Attachment Input */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Bukti Pengiriman (Opsional)</label>
                <input type="file" accept="image/*" style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '0.75rem', outline: 'none', background: '#fff' }} />
              </div>

              <button 
                className="adm-action-btn" 
                style={{ background: 'var(--dash-primary)', color: '#fff', width: '100%', padding: '0.6rem', borderRadius: '6px', fontWeight: 700, display: 'flex', justifyContent: 'center' }}
                onClick={() => {
                  if (!manualStatus) {
                     showToast('Silakan pilih status terlebih dahulu', 'error')
                     return
                  }
                  showToast(`Status berhasil diupdate ke: ${manualStatus}`, 'success')
                  setManualLocation('')
                }}
              >
                Update Status
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
