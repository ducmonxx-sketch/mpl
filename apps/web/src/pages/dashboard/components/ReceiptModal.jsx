import Icon from '../../../components/Icon'

const STATUS_LABEL = { delivered: 'Terkirim', failed: 'Gagal', cancelled: 'Dibatalkan' }
const STATUS_CLASS = { delivered: 'hist-status--delivered', failed: 'hist-status--failed', cancelled: 'hist-status--cancelled' }

export default function ReceiptModal({ item, onClose, onDownload }) {
  const h = item

  return (
    <div className="dash-overlay dash-overlay--visible" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div className="glass-card" style={{ width: '400px', padding: '2rem', animation: 'dashFadeUp 0.3s ease both', pointerEvents: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: 'var(--dash-primary)' }}>Manifes Pengiriman</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Icon name="close" size={20} /></button>
        </div>
        <p style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '4px' }}>{h.id}</p>
        <p style={{ color: '#475569', fontSize: '0.85rem', marginBottom: '1rem' }}>{h.desc}</p>
        
        <div style={{ background: 'rgba(255,255,255,0.5)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Status</span>
            <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }} className={STATUS_CLASS[h.status]}>{STATUS_LABEL[h.status]}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Asal</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{h.origin}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Tujuan</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{h.dest}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Waktu Selesai</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{h.completedAt}</span>
          </div>
        </div>
        
        <button onClick={onDownload} style={{ width: '100%', padding: '0.75rem', background: 'var(--dash-secondary)', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--dash-primary)' }}>
          <Icon name="download" size={16} /> Unduh PDF
        </button>
      </div>
    </div>
  )
}
