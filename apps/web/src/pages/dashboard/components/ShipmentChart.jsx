export default function ShipmentChart({ chart, activeTab }) {
  return (
    <div className="dash-chart-card glass-card">
      <div className="dash-chart-header">
        <h3>Statistik Pengiriman</h3>
        <div className="dash-chart-legend">
          <div className="dash-chart-legend__item">
            <span className="dash-chart-legend__dot" />
            <span className="dash-chart-legend__label">Armada Aktif</span>
          </div>
          <div className="dash-chart-metric">
            <p className="dash-chart-metric__value" key={`m-${activeTab}`}>{chart.metric}</p>
            <p className="dash-chart-metric__change" key={`c-${activeTab}`}>{chart.change}</p>
          </div>
        </div>
      </div>
      <div className="dash-chart-area" key={activeTab}>
        <svg viewBox="0 0 800 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="chartGradient" x1="400" y1="0" x2="400" y2="200" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fec330" />
              <stop offset="1" stopColor="#fec330" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={chart.fillPath} fill="url(#chartGradient)" fillOpacity="0.1" />
          <path className="chart-line" d={chart.linePath} stroke="#fec330" strokeWidth="4" strokeLinecap="round" />
        </svg>
        {chart.bars.map((h, i) => (
          <div
            key={i}
            className={`dash-chart-bar${i === chart.highlightIndex ? ' dash-chart-bar--highlight' : ''}`}
            style={{ height: h }}
          />
        ))}
      </div>
      <div className="dash-chart-labels" key={`labels-${activeTab}`}>
        {chart.labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  )
}
