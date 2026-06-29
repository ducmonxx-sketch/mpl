import { useState, useRef, useEffect } from 'react'
import Icon from '../../../components/Icon'

export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  allLabel = null,
  className = '',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  )

  const selectedLabel = (value === 'all' && allLabel) ? allLabel : options.find(o => o.value === value)?.label || placeholder

  return (
    <div className={`relative ${className}`} style={style} ref={containerRef}>
      <button 
        type="button"
        className={`w-full px-4 py-2.5 bg-white border rounded-xl text-sm flex items-center justify-between outline-none transition-all ${isOpen ? 'border-dash-secondary ring-2 ring-dash-secondary/20' : 'border-gray-300 hover:border-gray-400'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate font-medium text-gray-700">{selectedLabel}</span>
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={18} className="text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-full bg-white border border-gray-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] rounded-xl z-[60] overflow-hidden flex flex-col max-h-[300px] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50/50 shrink-0">
            <Icon name="search" size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none text-sm outline-none text-gray-700 placeholder-gray-400"
              autoFocus
            />
          </div>
          
          <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
            {allLabel && (
              <button
                type="button"
                onClick={() => { onChange('all'); setIsOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors mb-1 ${value === 'all' ? 'bg-dash-secondary/15 text-dash-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {allLabel}
              </button>
            )}
            
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center text-gray-400">
                Tidak ditemukan
              </div>
            ) : (
              filteredOptions.map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${value === opt.value ? 'bg-dash-secondary/15 text-dash-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
