import { useState, Fragment } from 'react'
import Icon from '../../../components/Icon'

export default function AdminDataTable({ columns, data, onRowClick, emptyMessage = 'Tidak ada data ditemukan.', expandableContent }) {
  const [expandedRows, setExpandedRows] = useState(new Set())

  const toggleRow = (id, e) => {
    e?.stopPropagation()
    const next = new Set(expandedRows)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedRows(next)
  }

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
              <tr className="bg-[#fec330]/5 border-b border-gray-200">
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
              const isExpanded = expandedRows.has(rowId)
              
              return (
                <Fragment key={rowId}>
                  <tr
                    className={`transition-colors duration-200 ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}
                    onClick={() => onRowClick?.(row)}
                    style={onRowClick ? { cursor: 'pointer' } : undefined}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="py-4 px-5 text-sm font-medium text-[#333333] align-middle">
                        {col.render ? col.render(row[col.key], row, { toggleRow: (e) => toggleRow(rowId, e), isExpanded }) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                  {expandableContent && isExpanded && (
                    <tr>
                      <td colSpan={columns.length} className="p-0 bg-gray-50 border-b border-gray-200">
                        <div className="p-6 border-l-4 border-[#002442]">
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
