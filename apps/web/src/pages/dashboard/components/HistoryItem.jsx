import Icon from '../../../components/Icon'

const STATUS_LABEL = { delivered: 'Terkirim', failed: 'Gagal', cancelled: 'Dibatalkan' }
const STATUS_CLASS = { delivered: 'hist-status--delivered', failed: 'hist-status--failed', cancelled: 'hist-status--cancelled' }

export default function HistoryItem({ item, onViewReceipt }) {
  const h = item

  return (
    <div className="hist-item glass-card">
      <div className="hist-item__left">
        <div className="hist-item__icon">
          <Icon name={h.status === 'delivered' ? 'check_circle' : h.status === 'failed' ? 'warning' : 'close'} size={20} />
        </div>
        <div className="hist-item__info">
          <div className="hist-item__top-row">
            <p className="hist-item__id">{h.id}</p>
            <span className={`hist-status ${STATUS_CLASS[h.status]}`}>{STATUS_LABEL[h.status]}</span>
          </div>
          <p className="hist-item__desc">{h.desc}</p>
          <div className="hist-item__route-row">
            <span>{h.origin}</span>
            <Icon name="arrow_forward" size={14} />
            <span>{h.dest}</span>
          </div>
        </div>
      </div>
      <div className="hist-item__right">
        <div className="hist-item__date-block">
          <p className="hist-item__date-label">Selesai</p>
          <p className="hist-item__date-value">{h.completedAt}</p>
        </div>
        <div className="hist-item__date-block">
          <p className="hist-item__date-label">Durasi</p>
          <p className="hist-item__date-value">{h.duration}</p>
        </div>
        <button className="hist-item__view-btn" onClick={() => onViewReceipt(h.id)}>
          <Icon name="receipt_long" size={16} />
          <span>Lihat</span>
        </button>
      </div>
    </div>
  )
}
