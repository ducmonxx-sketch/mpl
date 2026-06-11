import { useState, useRef, useEffect } from 'react'
import Icon from '../../../components/Icon'

export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  allLabel = 'Semua',
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

  const selectedLabel = value === 'all' ? allLabel : options.find(o => o.value === value)?.label || placeholder

  return (
    <div className="adm-searchable-select" ref={containerRef} style={style}>
      <div 
        className="adm-searchable-select__trigger" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '0.5rem 0.75rem', 
          borderRadius: '8px', 
          border: '1px solid #cbd5e1', 
          fontSize: '0.85rem', 
          minWidth: '200px',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>{selectedLabel}</span>
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={18} />
      </div>

      {isOpen && (
        <div 
          className="adm-searchable-select__dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            zIndex: 50,
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.5rem',
                fontSize: '0.8rem',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                outline: 'none'
              }}
              autoFocus
            />
          </div>
          
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <div 
              onClick={() => { onChange('all'); setIsOpen(false) }}
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                background: value === 'all' ? '#f1f5f9' : 'transparent',
                borderBottom: '1px solid #f1f5f9'
              }}
              className="adm-searchable-select__option"
            >
              {allLabel}
            </div>
            
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
                Tidak ditemukan
              </div>
            ) : (
              filteredOptions.map(opt => (
                <div 
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false) }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    background: value === opt.value ? '#f1f5f9' : 'transparent',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                  className="adm-searchable-select__option"
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
