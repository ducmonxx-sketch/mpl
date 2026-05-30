import Icon from '../../../components/Icon'

export default function AdminKPICard({ icon, label, sublabel, value, trend, color = 'primary', delay = 0 }) {
  const colorMap = {
    primary: { bg: 'rgba(0,36,66,0.06)', fg: 'var(--dash-primary)' },
    gold: { bg: 'rgba(254,195,48,0.12)', fg: '#795900' },
    green: { bg: 'rgba(0,67,13,0.08)', fg: 'var(--dash-tertiary-light)' },
    red: { bg: 'rgba(186,26,26,0.08)', fg: 'var(--dash-error)' },
  }
  const c = colorMap[color] || colorMap.primary

  return (
    <div className="adm-kpi-card glass-card" style={{ animationDelay: `${delay}s` }}>
      <div className="adm-kpi-card__header">
        <div className="adm-kpi-card__icon" style={{ background: c.bg, color: c.fg }}>
          <Icon name={icon} size={22} />
        </div>
        {trend && (
          <span className="adm-kpi-card__trend" style={{ color: trend.startsWith('+') ? 'var(--dash-tertiary-light)' : 'var(--dash-error)' }}>
            {trend}
          </span>
        )}
      </div>
      <h3 className="adm-kpi-card__value">{value}</h3>
      <p className="adm-kpi-card__label">{label}</p>
      {sublabel && <p className="adm-kpi-card__sublabel">{sublabel}</p>}
    </div>
  )
}
