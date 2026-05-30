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
      <div className="adm-table-empty">
        <Icon name="search" size={32} />
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
          {columns.some(col => col.filterRender) && (
            <tr className="adm-table__filter-row" style={{ backgroundColor: 'rgba(254, 195, 48, 0.03)' }}>
              {columns.map((col) => (
                <th key={`filter-${col.key}`} style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 'normal' }}>
                  {col.filterRender ? col.filterRender() : null}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const rowId = row.id || idx
            const isExpanded = expandedRows.has(rowId)
            
            return (
              <Fragment key={rowId}>
                <tr
                  className={`adm-table__row ${isExpanded ? 'adm-table__row--expanded' : ''}`}
                  onClick={() => onRowClick?.(row)}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row, { toggleRow: (e) => toggleRow(rowId, e), isExpanded }) : row[col.key]}
                    </td>
                  ))}
                </tr>
                {expandableContent && isExpanded && (
                  <tr className="adm-table__expanded-row">
                    <td colSpan={columns.length} style={{ padding: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ padding: '1.25rem', borderLeft: '3px solid var(--dash-primary)' }}>
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
  )
}
