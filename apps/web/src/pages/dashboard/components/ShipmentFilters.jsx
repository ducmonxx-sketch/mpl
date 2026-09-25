import { useState, useRef, useEffect } from 'react'
import Icon from '../../../components/Icon'
import { SHIPMENT_STATUS_CONFIG, ACTIVE_STATUSES, getStatusBucket } from '../shipmentStatus'

// Quick-filter buckets replace the old "one tab per enum value" row (11 tabs was too
// long to scan). Aktif/Selesai/Dibatalkan cover the common case; the "Lainnya" dropdown
// below lets a client still drill into one specific in-flight stage when they need it.
const QUICK_FILTERS = [
  { key: 'all', label: 'Semua', dot: null },
  { key: 'active', label: 'Aktif', dot: 'bg-blue-500' },
  { key: 'done', label: 'Selesai', dot: 'bg-green-500' },
  { key: 'cancelled', label: 'Dibatalkan', dot: 'bg-red-500' },
]

export default function ShipmentFilters({ filter, onFilterChange, shipments }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  const drilledStatus = ACTIVE_STATUSES.includes(filter) ? filter : null

  const countFor = (bucketKey) => {
    if (bucketKey === 'all') return shipments.length
    return shipments.filter((s) => getStatusBucket(s.status) === bucketKey).length
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-6">
      {QUICK_FILTERS.map(({ key, label, dot }) => {
        const isActive = filter === key || (key === 'active' && drilledStatus)
        const count = countFor(key)
        const displayLabel = key === 'active' && drilledStatus ? SHIPMENT_STATUS_CONFIG[drilledStatus].label : label

        return (
          <button
            key={key}
            onClick={() => onFilterChange(key)}
            className={`inline-flex items-center gap-2 pl-3.5 pr-2.5 py-2 rounded-full text-sm font-bold border transition-colors ${
              isActive
                ? 'bg-[var(--dash-primary)] text-white border-[var(--dash-primary)]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
            }`}
          >
            {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-white' : dot}`} />}
            {displayLabel}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
              {count}
            </span>
          </button>
        )
      })}

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className={`inline-flex items-center gap-1 pl-3.5 pr-2.5 py-2 rounded-full text-sm font-bold border transition-colors ${
            drilledStatus
              ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] border-[var(--dash-primary)]/30'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          Lainnya
          <Icon name={menuOpen ? 'expand_less' : 'expand_more'} size={16} />
        </button>

        {menuOpen && (
          <div className="absolute z-20 mt-2 right-0 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5">
            {ACTIVE_STATUSES.map((key) => {
              const cfg = SHIPMENT_STATUS_CONFIG[key]
              const count = shipments.filter((s) => s.status === key).length
              const isActive = filter === key
              return (
                <button
                  key={key}
                  onClick={() => { onFilterChange(key); setMenuOpen(false) }}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-sm font-semibold text-left transition-colors ${
                    isActive ? 'bg-gray-50 text-[var(--dash-primary)]' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon name={cfg.icon} size={15} />
                    {cfg.label}
                  </span>
                  <span className="text-xs font-bold text-gray-400">{count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
