import { useEffect, useState } from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { shipmentsAPI } from '../../../lib/api'

// A validated darker gold for the data line itself — the raw brand gold (--dash-secondary,
// #fec330) is too light to read well as a thin stroke (fails a lightness/contrast check
// against a white card). Brand gold stays on buttons/tabs; this "chart gold" carries the mark.
const CHART_GOLD = '#b8860b'
const CHART_RED = '#f4978e'

// The gold Area (background wash) and gold Line share a dataKey, which would otherwise
// duplicate "Kondisi Sempurna" in the tooltip — keep only the last entry per dataKey
// (the Line's, so the swatch shows the real line color, not the transparent area fill).
function ConditionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const rows = Object.values(
    payload.reduce((acc, p) => ({ ...acc, [p.dataKey]: p }), {})
  )
  return (
    <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12, background: '#fff', padding: '8px 12px' }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: '#002442' }}>{label}</p>
      {rows.map(r => (
        <p key={r.dataKey} style={{ margin: 0, color: '#374151' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: r.color, marginRight: 6 }} />
          {r.name}: <span style={{ fontWeight: 700 }}>{r.value ?? '-'}</span>
        </p>
      ))}
    </div>
  )
}

// Custom active-dot renderer so a point stays clickable even when isDense hides the
// static `dot` — Recharts still renders `activeDot` on hover/touch regardless of `dot`.
// Future (null-value) points get a non-interactive cursor since there's nothing to drill into.
// A point near the top/bottom edge of the plot is easy to miss with just the visible 5px
// dot, so a larger transparent circle carries the actual click/hit target underneath it —
// same trick as widening a small icon button's tap area without changing how it looks.
function makeActiveDot(color, onClick) {
  return function ActiveDot(props) {
    const { cx, cy, payload } = props
    if (cx == null || cy == null) return null
    const clickable = payload?.unitsPerfect != null
    return (
      <g style={{ cursor: clickable ? 'pointer' : 'default' }} onClick={() => clickable && onClick(payload)}>
        <circle cx={cx} cy={cy} r={14} fill="transparent" />
        <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2} pointerEvents="none" />
      </g>
    )
  }
}

const RANGES = [
  { value: 'month', label: 'Bulan Ini' },
  { value: 'quarter', label: '3 Bulan' },
  { value: 'ytd', label: 'YTD' },
]

// Matches Shipment.shippingCategory values ('Unit' | 'Cargo' | 'Container') used
// throughout ShipmentsSection.jsx — labels are Indonesian, values stay in English.
const CATEGORIES = [
  { value: 'all', label: 'Semua' },
  { value: 'Unit', label: 'Unit' },
  { value: 'Cargo', label: 'Kargo' },
  { value: 'Container', label: 'Container' },
]

// Perfect vs. defective unit counts for DELIVERED shipments, bucketed by month,
// filterable by service line (Unit/Kargo/Container). A "defective" unit covers
// both the bike and its equipment together (single arrival-condition flag ticked
// by Kepala Gudang at handover).
export default function ShipmentConditionChart({ range, onRangeChange, chartRef, onPointClick }) {
  const [category, setCategory] = useState('all')
  const [buckets, setBuckets] = useState([])
  const [loading, setLoading] = useState(true)

  const handleDotClick = (bucket) => onPointClick?.({ period: bucket.period, label: bucket.label, category })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    shipmentsAPI.getConditionAnalytics(range, category)
      .then(data => { if (!cancelled) setBuckets(data.buckets || []) })
      .catch(() => { if (!cancelled) setBuckets([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [range, category])

  const totalPerfect = buckets.reduce((sum, b) => sum + (b.unitsPerfect || 0), 0)
  const totalDefective = buckets.reduce((sum, b) => sum + (b.unitsDefective || 0), 0)
  const totalUnits = totalPerfect + totalDefective
  const perfectRate = totalUnits > 0 ? Math.round((totalPerfect / totalUnits) * 100) : null

  // Daily buckets (month/quarter) can run to ~90 points — thin the x-axis labels and
  // drop per-point dots so the line stays readable instead of a wall of overlapping text.
  const isDense = buckets.length > 15
  const tickInterval = isDense ? Math.ceil(buckets.length / 10) - 1 : 0

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-6 md:p-8 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-[#002442] flex items-center gap-2">
            Kondisi Unit Terkirim
            {perfectRate !== null && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#fec330]/15 text-[#a3790a]">{perfectRate}% Sempurna</span>
            )}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Sempurna vs. rusak (unit &amp; perlengkapan), berdasarkan tanggal selesai. Klik titik pada grafik untuk lihat detail pengiriman.</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
          {RANGES.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => onRangeChange(r.value)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                range === r.value ? 'bg-[#002442] text-white' : 'text-gray-500 hover:text-[#002442]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1 w-fit">
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              category === c.value ? 'bg-[#fec330] text-[#002442]' : 'text-gray-500 hover:text-[#002442]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Memuat data...</div>
      ) : totalUnits === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Belum ada pengiriman selesai pada periode ini.</div>
      ) : (
        <div className="h-96 w-full mt-2" ref={chartRef}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={buckets} margin={{ top: 24, right: 12, left: 0, bottom: 14 }}>
              <defs>
                <linearGradient id="conditionGoldWash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_GOLD} stopOpacity={0.16} />
                  <stop offset="95%" stopColor={CHART_GOLD} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#f0f2f5" />
              <XAxis dataKey="label" interval={tickInterval} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
              <YAxis allowDecimals={false} domain={[0, (dataMax) => Math.ceil(dataMax * 1.2)]} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ConditionTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="unitsPerfect" name="Kondisi Sempurna" stroke="none" fill="url(#conditionGoldWash)" legendType="none" activeDot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="unitsPerfect" name="Kondisi Sempurna" stroke={CHART_GOLD} strokeWidth={2.5} dot={isDense ? false : { r: 3.5, strokeWidth: 0, fill: CHART_GOLD }} activeDot={makeActiveDot(CHART_GOLD, handleDotClick)} connectNulls={false} />
              <Line type="monotone" dataKey="unitsDefective" name="Rusak" stroke={CHART_RED} strokeWidth={2.5} dot={isDense ? false : { r: 3.5, strokeWidth: 0, fill: CHART_RED }} activeDot={makeActiveDot(CHART_RED, handleDotClick)} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
