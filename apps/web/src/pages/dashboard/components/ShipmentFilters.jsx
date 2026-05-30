export default function ShipmentFilters({ filter, onFilterChange, statusMap, shipments }) {
  return (
    <div className="ship-filters">
      {Object.entries(statusMap).map(([key, label]) => (
        <button
          key={key}
          className={`ship-filter-tab${filter === key ? ' ship-filter-tab--active' : ''}`}
          onClick={() => onFilterChange(key)}
        >
          {label}
          {key !== 'all' && (
            <span className="ship-filter-count">
              {shipments.filter(s => s.status === key).length}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
