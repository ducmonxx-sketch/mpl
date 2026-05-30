export default function HistoryTabs({ tabs, activeTab, onTabChange, history }) {
  return (
    <div className="hist-tabs">
      {Object.entries(tabs).map(([key, label]) => (
        <button
          key={key}
          className={`hist-tab${activeTab === key ? ' hist-tab--active' : ''}`}
          onClick={() => onTabChange(key)}
        >
          {label}
          {key !== 'all' && (
            <span className="hist-tab__count">{history.filter(h => h.status === key).length}</span>
          )}
        </button>
      ))}
    </div>
  )
}
