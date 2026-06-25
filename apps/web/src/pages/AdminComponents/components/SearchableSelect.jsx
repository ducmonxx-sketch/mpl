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
    <div className={`adm-searchable-select ${className}`} style={style} ref={containerRef}>
      <button 
        type="button"
        className="adm-searchable-select__trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{ borderBottomColor: isOpen ? 'var(--dash-secondary)' : 'transparent', background: isOpen ? '#fff' : '#f3f4f5' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={18} style={{ color: '#94a3b8', flexShrink: 0, marginLeft: '8px' }} />
      </button>

      {isOpen && (
        <div className="adm-searchable-select__dropdown">
          <div className="adm-searchable-select__search">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          
          <div className="adm-searchable-select__options">
            {allLabel && (
              <button
                type="button"
                onClick={() => { onChange('all'); setIsOpen(false) }}
                className={`adm-searchable-select__option ${value === 'all' ? 'adm-searchable-select__option--selected' : ''}`}
                style={{ width: '100%', textAlign: 'left', border: 'none', display: 'block' }}
              >
                {allLabel}
              </button>
            )}
            
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>
                Tidak ditemukan
              </div>
            ) : (
              filteredOptions.map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false) }}
                  className={`adm-searchable-select__option ${value === opt.value ? 'adm-searchable-select__option--selected' : ''}`}
                  style={{ width: '100%', textAlign: 'left', border: 'none', display: 'block' }}
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
