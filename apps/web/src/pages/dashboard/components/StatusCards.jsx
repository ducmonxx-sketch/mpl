import { useEffect, useRef } from 'react'
import anime from 'animejs'
import Icon from '../../../components/Icon'

export default function StatusCards({ apiStats }) {
  const deliveredRef = useRef(null)

  useEffect(() => {
    if (apiStats?.delivered !== undefined && deliveredRef.current) {
      anime({
        targets: deliveredRef.current,
        innerHTML: [0, apiStats.delivered],
        round: 1,
        easing: 'easeOutExpo',
        duration: 1500
      })
    }
  }, [apiStats?.delivered])

  const failedCount = apiStats?.failed || 0

  return (
    <div className="dash-status-column">
      <div className="dash-status-card glass-card">
        <div className="dash-status-card__header">
          <div>
            <p className="dash-status-card__label dash-status-card__label--transit">Dalam Perjalanan</p>
            <h4 className="dash-status-card__title">Pengiriman Berjalan</h4>
          </div>
          <div className="dash-status-card__icon dash-status-card__icon--transit icon-spin-slow">
            <Icon name="sync" size={22} />
          </div>
        </div>
        <div className="dash-progress">
          <div className="dash-progress__info">
            <span>{apiStats?.transit || 0} Pengiriman</span>
            <span>{apiStats?.total ? Math.round(((apiStats.transit || 0) / apiStats.total) * 100) : 0}%</span>
          </div>
          <div className="dash-progress__bar">
            <div className="dash-progress__fill" style={{ '--progress-percent': `${apiStats?.total ? Math.round(((apiStats.transit || 0) / apiStats.total) * 100) : 0}%` }} />
          </div>
        </div>
      </div>

      <div className="dash-status-card glass-card">
        <div className="dash-status-card__header">
          <div>
            <p className="dash-status-card__label dash-status-card__label--done">Terkirim</p>
            <h4 className="dash-status-card__title">Pengiriman Selesai</h4>
          </div>
          <div className="dash-status-card__icon dash-status-card__icon--done">
            <Icon name="check_circle" size={22} />
          </div>
        </div>
        <div className="dash-status-card__metric">
          <span className="dash-status-card__metric-value" ref={deliveredRef}>{apiStats?.delivered || 0}</span>
          <span className="dash-status-card__metric-label">Selesai {apiStats?.period === 'daily' ? 'hari ini' : 'periode ini'}</span>
        </div>
      </div>

      <div className="dash-status-card glass-card">
        <div className="dash-status-card__header">
          <div>
            <p className="dash-status-card__label dash-status-card__label--failed">Perlu Perhatian</p>
            <h4 className="dash-status-card__title">Pengiriman Gagal</h4>
          </div>
          <div className={`dash-status-card__icon dash-status-card__icon--failed ${failedCount > 0 ? 'icon-pulse-error' : ''}`}>
            <Icon name="warning" size={22} />
          </div>
        </div>
        <div className="dash-status-card__metric" style={{ marginTop: '0.75rem' }}>
          <span className="dash-status-card__metric-value" style={{ color: failedCount > 0 ? 'var(--dash-error)' : 'var(--dash-primary)' }}>
            {failedCount}
          </span>
          <span className="dash-status-card__metric-label">Paket bermasalah</span>
        </div>
        {failedCount > 0 && (
          <button className="dash-status-card__action-link">
            Tinjau Masalah <Icon name="arrow_forward" size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
