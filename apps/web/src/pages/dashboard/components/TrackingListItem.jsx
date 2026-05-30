import Icon from '../../../components/Icon'
import TrackingDetail from './TrackingDetail'

export default function TrackingListItem({ shipment, isActive, onSelect, showToast, isAdmin }) {
  return (
    <div className={`track-list__wrapper ${isActive ? 'track-list__wrapper--active' : ''}`}>
      <button
        className={`track-list__item glass-card${isActive ? ' track-list__item--active' : ''}`}
        onClick={onSelect}
        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
      >
        <span className="track-list__item-status-pill">{shipment.status}</span>
        <p className="track-list__item-id" style={{ marginTop: '0.75rem' }}>{shipment.id}</p>
        <p className="track-list__item-pkg">{shipment.package}</p>
        <div className="track-list__item-route">
          <span>{shipment.origin}</span>
          <Icon name="arrow_forward" size={14} style={{ color: 'var(--dash-secondary)' }} />
          <span>{shipment.destination}</span>
        </div>
        <div className="track-panel__route-track" style={{ marginTop: 'auto', width: '100%', paddingTop: '1rem' }}>
          <div className="track-panel__route-fill" style={{ width: `${shipment.progress}%` }} />
        </div>
      </button>

      {/* ── Inline Detail Panel ── */}
      {isActive && (
        <TrackingDetail shipment={shipment} showToast={showToast} isAdmin={isAdmin} />
      )}
    </div>
  )
}
