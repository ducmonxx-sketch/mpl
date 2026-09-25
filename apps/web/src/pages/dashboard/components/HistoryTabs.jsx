// Status dot color per tab key — same hue family as HISTORY_STATUS_CONFIG's pills.
// Gagal and Dibatalkan share a color (both red) since they're kept as distinct labels,
// not distinct severities.
const DOT_COLORS = {
  delivered: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-red-500',
}

export default function HistoryTabs({ tabs, activeTab, onTabChange, history }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Object.entries(tabs).map(([key, label]) => {
        const count = key === 'all' ? history.length : history.filter(h => h.status === key).length
        const isActive = activeTab === key
        const dot = DOT_COLORS[key]

        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`inline-flex items-center gap-2 pl-3.5 pr-2.5 py-2 rounded-full text-sm font-bold border transition-colors ${
              isActive
                ? 'bg-[var(--dash-primary)] text-white border-[var(--dash-primary)]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
            }`}
          >
            {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-white' : dot}`} />}
            {label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
