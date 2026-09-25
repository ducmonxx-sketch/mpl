import { useEffect, useState } from 'react'
import Icon from '../../../components/Icon'
import Loader from '../../../components/Loader'
import AdminDataTable from './AdminDataTable'
import { shipmentsAPI } from '../../../lib/api'

const CHART_GOLD = '#b8860b'
const CHART_RED = '#f4978e'
const CATEGORY_LABELS = { Unit: 'Unit', Cargo: 'Kargo', Container: 'Container' }

// Full-page drill-down for a single point on ShipmentConditionChart — replaces the
// chart/summary cards in ReportSection (not a popup) while active. Uses the same
// AdminDataTable component ShipmentsSection/OverviewSection render their lists with.
// Clicking a row's ID expands it in place (AdminDataTable's built-in expandableContent)
// to show that shipment's unit-by-unit condition — the data is already in the fetched
// response, no extra request needed. A link inside the expanded row still offers the
// full jump into the real record via onNavigateToShipment (the same cross-section jump
// Overview already uses) for anyone who wants the complete detail panel.
export default function ConditionDetailPage({ period, label, category, onBack, onNavigateToShipment }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    shipmentsAPI.getConditionDetail(period, category)
      .then(res => { if (!cancelled) setData(res) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [period, category])

  const shipments = data?.shipments ?? []
  const totalPerfect = shipments.reduce((s, r) => s + r.unitsPerfect, 0)
  const totalDefective = shipments.reduce((s, r) => s + r.unitsDefective, 0)

  const columns = [
    {
      key: 'id',
      label: 'ID Order',
      render: (v, _row, { toggleRow, isExpanded } = {}) => (
        <span
          className="inline-flex items-center gap-1.5 cursor-pointer underline"
          style={{ color: 'var(--dash-primary)' }}
          onClick={toggleRow}
          title="Klik untuk lihat rincian unit"
        >
          <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={16} />
          {v}
        </span>
      ),
    },
    { key: 'client', label: 'Klien' },
    { key: 'destination', label: 'Tujuan' },
    {
      key: 'shippingCategory',
      label: 'Kategori',
      render: (v) => (
        <span className="text-xs font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
          {CATEGORY_LABELS[v] || v || '-'}
        </span>
      ),
    },
    {
      key: 'unitsPerfect',
      label: 'Sempurna',
      render: (v) => <span className="font-bold" style={{ color: CHART_GOLD }}>{v}</span>,
    },
    {
      key: 'unitsDefective',
      label: 'Rusak',
      render: (v) => <span className="font-bold" style={{ color: CHART_RED }}>{v}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 w-fit text-sm font-bold text-gray-500 hover:text-[#002442] transition-colors"
      >
        <Icon name="arrow_back" size={16} /> Kembali ke Laporan
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h3 className="text-xl font-bold text-[#002442]">{label}</h3>
          {!loading && !error && (
            <p className="text-sm font-medium text-gray-500 mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_GOLD }} />
                {totalPerfect} sempurna
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_RED }} />
                {totalDefective} rusak
              </span>
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 h-32 text-gray-400 text-sm">
          <Loader size="sm" />
          Memuat data...
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Gagal memuat detail pengiriman.</div>
      ) : (
        <>
          <AdminDataTable
            columns={columns}
            data={shipments}
            emptyMessage="Tidak ada pengiriman selesai pada periode ini."
            expandableContent={(row) => (
              <div className="flex flex-col gap-3">
                {row.units?.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {row.units.map((u, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-bold">{u.tipeMotor || '-'}</span>
                          {u.noRangka && <span className="text-gray-400"> &middot; Rangka {u.noRangka}</span>}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {u.arrivedDefective ? (
                            <span className="text-xs font-bold" style={{ color: CHART_RED }}>
                              Rusak{u.arrivalNote ? ` — ${u.arrivalNote}` : ''}
                            </span>
                          ) : (
                            <span className="text-xs font-bold" style={{ color: CHART_GOLD }}>Sempurna</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Tidak ada rincian unit untuk pengiriman ini.</p>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateToShipment?.(row.id)}
                  className="flex items-center gap-1.5 w-fit text-xs font-bold text-[#002442] hover:underline"
                >
                  Lihat detail lengkap di Pengiriman <Icon name="arrow_forward" size={14} />
                </button>
              </div>
            )}
          />
          {data && data.total > shipments.length && (
            <p className="text-xs text-gray-400 text-center">
              Menampilkan {shipments.length} dari {data.total} pengiriman.
            </p>
          )}
        </>
      )}
    </div>
  )
}
