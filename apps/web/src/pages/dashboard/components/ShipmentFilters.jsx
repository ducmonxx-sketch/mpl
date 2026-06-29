export default function ShipmentFilters({ filter, onFilterChange, statusMap, shipments }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-px mt-6">
      {Object.entries(statusMap).map(([key, label]) => {
        const isActive = filter === key
        return (
          <button
            key={key}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${isActive ? 'border-dash-primary text-dash-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => onFilterChange(key)}
          >
            {label}
            {key !== 'all' && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-dash-primary/10 text-dash-primary' : 'bg-gray-100 text-gray-500'}`}>
                {shipments.filter(s => s.status === key).length}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
