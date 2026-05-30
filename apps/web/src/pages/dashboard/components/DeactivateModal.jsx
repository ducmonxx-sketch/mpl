import Icon from '../../../components/Icon'
import CloudflareTurnstile from '../../../components/CloudflareTurnstile'

export default function DeactivateModal({ consentChecked, captchaToken, onConsentChange, onCaptchaVerify, onCaptchaError, onSubmit, onCancel }) {
  return (
    <div className="dash-overlay dash-overlay--visible" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-card" style={{ background: 'var(--dash-surface)', padding: '2rem', width: '450px', maxWidth: '90%', borderRadius: '12px', animation: 'dashFadeUp 0.3s ease both' }}>
        <h3 style={{ color: '#ef4444', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon name="warning" size={24} /> Konfirmasi Penonaktifan
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          Anda akan mengirimkan permintaan ke Admin untuk menonaktifkan akun Anda. Pengiriman dan manifes historis akan dikunci. Apakah Anda yakin?
        </p>
        
        {/* Consent Checkbox */}
        <div style={{ padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
           <input 
             type="checkbox" 
             id="consent-check" 
             checked={consentChecked} 
             onChange={(e) => onConsentChange(e.target.checked)} 
             style={{ width: '20px', height: '20px', cursor: 'pointer', flexShrink: 0 }}
           />
           <label htmlFor="consent-check" style={{ fontSize: '0.9rem', color: '#334155', cursor: 'pointer', flex: 1, lineHeight: 1.4 }}>
             Saya mengerti dan menyetujui bahwa akun saya akan dinonaktifkan secara permanen beserta seluruh pengiriman.
           </label>
        </div>

        <CloudflareTurnstile onVerify={onCaptchaVerify} onError={onCaptchaError} />

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={onCancel}
            style={{ flex: 1, padding: '0.75rem', background: '#f1f5f9', border: 'none', borderRadius: '8px', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
          >
            Batal
          </button>
          <button 
            onClick={onSubmit}
            disabled={!consentChecked || !captchaToken}
            style={{ flex: 1, padding: '0.75rem', background: '#ef4444', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, cursor: (consentChecked && captchaToken) ? 'pointer' : 'not-allowed', opacity: (consentChecked && captchaToken) ? 1 : 0.5 }}
          >
            Kirim Permintaan
          </button>
        </div>
      </div>
    </div>
  )
}
