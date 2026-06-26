import { useState } from 'react'

export default function ShipmentChart({ chart, activeTab }) {
  const [hoverIndex, setHoverIndex] = useState(null)

  // Chart dimensions
  const width = 800
  const height = 200
  const padding = 20 // side padding
  const graphWidth = width - padding * 2
  const maxBarHeight = height - 40 // space for labels/glow

  // Calculate points for the bezier curve
  const points = (chart.dataPoints || []).map((dp, i) => {
    const x = padding + (i / Math.max(1, chart.dataPoints.length - 1)) * graphWidth
    // heightPercent is out of 100
    const y = height - (dp.heightPercent / 100) * maxBarHeight
    return { x, y, value: dp.value }
  })

  // Generate smooth cubic bezier path
  const generatePath = (pts) => {
    if (pts.length === 0) return ''
    if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`
    let d = `M${pts[0].x},${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i]
      const p2 = pts[i + 1]
      // Control points for smooth horizontal curve
      const cp1x = p1.x + (p2.x - p1.x) / 2
      const cp1y = p1.y
      const cp2x = p1.x + (p2.x - p1.x) / 2
      const cp2y = p2.y
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
    }
    return d
  }

  const linePath = generatePath(points)
  
  // Fill path closes to the bottom
  let fillPath = ''
  if (points.length > 0) {
    fillPath = `${linePath} V${height} H${padding} Z`
  }

  return (
    <div className="dash-chart-card glass-card">
      <div className="dash-chart-header">
        <h3>Statistik Pengiriman</h3>
        <div className="dash-chart-legend">
          <div className="dash-chart-legend__item">
            <span className="dash-chart-legend__dot" />
            <span className="dash-chart-legend__label">Volume Pengiriman</span>
          </div>
          <div className="dash-chart-metric">
            <p className="dash-chart-metric__value" key={`m-${activeTab}`}>{chart.metric}</p>
            <p className="dash-chart-metric__change" key={`c-${activeTab}`}>{chart.change}</p>
          </div>
        </div>
      </div>
      
      <div className="dash-chart-area" key={activeTab}>
        <svg viewBox={`0 0 ${width} ${height}`} fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fec330" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#fec330" stopOpacity="0" />
            </linearGradient>
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#fec330" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#cbd5e1" strokeOpacity="0.3" strokeDasharray="4 4" />
          <line x1="0" y1={height * 0.50} x2={width} y2={height * 0.50} stroke="#cbd5e1" strokeOpacity="0.3" strokeDasharray="4 4" />
          <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#cbd5e1" strokeOpacity="0.3" strokeDasharray="4 4" />

          {/* Fill area */}
          <path d={fillPath} fill="url(#chartGradient)" className="chart-fill" />
          
          {/* Glowing Line */}
          <path className="chart-line" d={linePath} stroke="#fec330" strokeWidth="4" strokeLinecap="round" filter="url(#neonGlow)" />
          
          {/* Interactive Data Points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 6 : 4}
              fill="#fff"
              stroke="#fec330"
              strokeWidth="3"
              style={{ transition: 'all 0.2s', filter: hoverIndex === i ? 'drop-shadow(0 0 8px rgba(254,195,48,0.8))' : 'none' }}
            />
          ))}
        </svg>
        
        {/* Hover overlay areas (columns) */}
        <div className="dash-chart-interactions">
          {points.map((p, i) => (
            <div
              key={i}
              className="dash-chart-interact-col"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{
                left: `${(i / Math.max(1, points.length - 1)) * 100}%`,
                width: `${100 / Math.max(1, points.length - 1)}%`,
                transform: 'translateX(-50%)'
              }}
            >
              <div className={`dash-chart-bar-hover ${hoverIndex === i || i === chart.highlightIndex ? 'active' : ''}`} />
              
              {/* Tooltip */}
              <div className={`dash-chart-tooltip ${hoverIndex === i ? 'visible' : ''}`}>
                <p className="tooltip-label">{chart.labels[i]}</p>
                <p className="tooltip-value">{p.value} Pengiriman</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="dash-chart-labels" key={`labels-${activeTab}`}>
        {chart.labels.map((l, i) => (
          <span key={i} className={hoverIndex === i ? 'active-label' : ''}>{l}</span>
        ))}
      </div>
    </div>
  )
}
