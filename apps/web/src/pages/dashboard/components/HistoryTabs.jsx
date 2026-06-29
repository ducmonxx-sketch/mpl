import { useState } from 'react'

export default function HistoryTabs({ tabs, activeTab, onTabChange, history }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-px">
      
      {Object.entries(tabs).map(([key, label]) => {
        const count = key !== 'all' ? history.filter(h => h.status === key).length : 0
        const isActive = activeTab === key
        
        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${isActive ? 'border-dash-primary text-dash-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            {label}
            {key !== 'all' && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-dash-primary/10 text-dash-primary' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
