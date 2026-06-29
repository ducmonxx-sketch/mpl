import { useState, useRef, useEffect, Fragment } from 'react'
import Icon from '../../../components/Icon'

export default function AdminDataTable({ columns, data, onRowClick, emptyMessage = 'Tidak ada data ditemukan.', expandableContent }) {
  const [expandedRowId, setExpandedRowId] = useState(null)
  const rowRefs = useRef({})

  const [hasAnimated, setHasAnimated] = useState(false)

  const toggleRow = (id, e) => {
    e?.stopPropagation()
    setExpandedRowId(prev => (prev === id ? null : id))
  }

  useEffect(() => {
    // Row entrance animation
    if (data && data.length > 0 && !hasAnimated) {
      import('animejs').then((animeModule) => {
        const anime = animeModule.default
        anime({
          targets: '.adm-table-row',
          translateY: [10, 0],
          opacity: [0, 1],
          easing: 'easeOutExpo',
          duration: 400,
          delay: anime.stagger(50, { start: 100 })
        })
        setHasAnimated(true)
      })
    }
  }, [data, hasAnimated])

  useEffect(() => {
    if (expandedRowId !== null && rowRefs.current[expandedRowId]) {
      // Allow DOM to update layout before scrolling
      setTimeout(() => {
        if (rowRefs.current[expandedRowId]) {
          rowRefs.current[expandedRowId].scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }, [expandedRowId])

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-400 gap-3 border border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
        <Icon name="search" size={32} />
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200">
              {columns.map((col) => (
                <th key={col.key} style={col.width ? { width: col.width } : undefined} className="py-3 px-5 text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">
                  {col.label}
                </th>
              ))}
            </tr>
            {columns.some(col => col.filterRender) && (
              <tr style={{ backgroundColor: 'color-mix(in srgb, var(--dash-secondary) 5%, transparent)' }} className="border-b border-gray-200">
                {columns.map((col) => (
                  <th key={`filter-${col.key}`} className="py-2 px-5 font-normal">
                    {col.filterRender ? col.filterRender() : null}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, idx) => {
              const rowId = row.id || idx
              const isExpanded = expandedRowId === rowId
              
              return (
                <Fragment key={rowId}>
                  <tr
                    ref={el => rowRefs.current[rowId] = el}
                    className={`adm-table-row transition-colors duration-200 ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}
                    onClick={() => onRowClick?.(row)}
                    style={onRowClick ? { cursor: 'pointer' } : undefined}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="py-4 px-5 text-sm font-medium text-[var(--neutral-dark)] align-middle">
                        {col.render ? col.render(row[col.key], row, { toggleRow: (e) => toggleRow(rowId, e), isExpanded }) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                  {expandableContent && isExpanded && (
                    <tr>
                      <td colSpan={columns.length} className="p-0 bg-gray-50 border-b border-gray-200">
                        <div className="p-6 border-l-4" style={{ borderColor: 'var(--dash-primary)' }}>
                          {expandableContent(row)}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
