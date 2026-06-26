import { useRef, useEffect, useState } from 'react'

export default function HistoryTabs({ tabs, activeTab, onTabChange, history }) {
  const containerRef = useRef(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const activeEl = containerRef.current.querySelector('[data-active="true"]')
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth
      })
    }
  }, [activeTab, tabs])

  return (
    <div className="relative inline-flex p-1.5 bg-white/40 backdrop-blur-md rounded-xl border border-white/50 shadow-sm" ref={containerRef}>
      {/* Sliding Indicator */}
      <div 
        className="absolute top-1.5 bottom-1.5 bg-white rounded-lg shadow-sm transition-all duration-300 ease-out"
        style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
      />
      
      {Object.entries(tabs).map(([key, label]) => {
        const count = key !== 'all' ? history.filter(h => h.status === key).length : 0
        const isActive = activeTab === key
        
        return (
          <button
            key={key}
            data-active={isActive}
            onClick={() => onTabChange(key)}
            className={`relative z-10 flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg transition-colors duration-200 ${
              isActive ? 'text-[var(--dash-primary)]' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
            {key !== 'all' && (
              <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[0.65rem] rounded-full transition-colors ${
                isActive ? 'bg-[var(--dash-secondary)] text-[var(--dash-primary)]' : 'bg-slate-200/80 text-slate-600'
              }`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
