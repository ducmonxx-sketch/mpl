import Icon from '../../../components/Icon'

const STATUS_MAP = {
  all: 'Semua',
  transit: 'Dalam Perjalanan',
  delivered: 'Terkirim',
  failed: 'Gagal',
  pending: 'Menunggu',
}

const STATUS_COLORS = {
  transit: 'ship-status--transit',
  delivered: 'ship-status--delivered',
  failed: 'ship-status--failed',
  pending: 'ship-status--pending',
}

export default function ShipmentCard({ shipment, isExpanded, onToggleExpand, onChangeNav, onTrackFull }) {
  const s = shipment

  return (
    <div className="ship-card glass-card">
      <div className="ship-card__top">
        <div className="ship-card__id-row">
          <div className="ship-card__icon-wrap">
            <Icon name="local_shipping" size={20} />
          </div>
          <div>
            <p className="ship-card__id">{s.id}</p>
            <p className="ship-card__desc">{s.desc}</p>
          </div>
        </div>
        <span className={`ship-status ${STATUS_COLORS[s.status]}`}>
          {STATUS_MAP[s.status]}
        </span>
      </div>

      <div className="ship-card__route">
        <div className="ship-card__point">
          <span className="ship-card__point-dot ship-card__point-dot--origin" />
          <div>
            <p className="ship-card__point-label">Asal</p>
            <p className="ship-card__point-value">{s.origin}</p>
          </div>
        </div>
        <div className="ship-card__route-line">
          <div className="ship-card__route-progress" style={{ width: `${s.progress}%` }} />
        </div>
        <div className="ship-card__point">
          <span className="ship-card__point-dot ship-card__point-dot--dest" />
          <div>
            <p className="ship-card__point-label">Tujuan</p>
            <p className="ship-card__point-value">{s.dest}</p>
          </div>
        </div>
      </div>

      <div className="ship-card__meta">
        <div className="ship-card__meta-item">
          <Icon name="calendar_today" size={14} />
          <span>{s.date}</span>
        </div>
        <div className="ship-card__meta-item">
          <Icon name="local_shipping" size={14} />
          <span>{s.service}</span>
        </div>
        <div className="ship-card__meta-item">
          <Icon name="package" size={14} />
          <span>{s.weight}</span>
        </div>
        <button className="ship-card__detail-btn" onClick={onToggleExpand}>
          {isExpanded ? 'Tutup' : 'Detail'} <Icon name={isExpanded ? "expand_less" : "expand_more"} size={16} />
        </button>
      </div>
      
      {isExpanded && (
        <div className="ship-expanded-detail" style={{ animation: 'dashFadeUp 0.3s ease both', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--dash-primary)', marginBottom: '0.5rem' }}>Informasi Tambahan & Log</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#475569' }}>
            {s.status === 'transit' && <p><Icon name="info" size={14} style={{verticalAlign:'middle', marginRight:'4px'}} />Update terakhir: Kendaraan termonitor melintasi checkpoint 2.</p>}
            {s.status === 'delivered' && <p><Icon name="check_circle" size={14} style={{verticalAlign:'middle', marginRight:'4px', color: 'var(--dash-tertiary-light)'}} />Penerima: Bpk. Rudi (Security)</p>}
            {s.status === 'failed' && <p><Icon name="warning" size={14} style={{verticalAlign:'middle', marginRight:'4px', color: 'var(--dash-error)'}} />Alasan: Penerima tidak di tempat. Jadwal ulang besok.</p>}
            {s.status === 'pending' && <p><Icon name="schedule" size={14} style={{verticalAlign:'middle', marginRight:'4px'}} />Menunggu penjadwalan armada.</p>}
            <button className="ship-card__detail-btn" style={{ marginLeft: 'auto', color: 'var(--dash-secondary-hover)', padding: '4px 8px', borderRadius: '4px', background: 'rgba(254, 195, 48, 0.1)' }} onClick={() => onTrackFull(s.id)}>Lacak Penuh</button>
          </div>
        </div>
      )}
    </div>
  )
}
