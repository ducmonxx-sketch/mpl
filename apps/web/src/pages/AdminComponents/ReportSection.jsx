import { useState, useRef } from 'react'
import ShipmentConditionChart from '../../components/charts/ShipmentConditionChart'
import ServiceLineSummary from './components/ServiceLineSummary'
import ConditionDetailPage from './components/ConditionDetailPage'

// Laporan — condition/success analytics for the shipment pipeline. Split out from
// Beranda into its own section so it can grow (more report cards) without crowding
// the Command Center overview. `range` (Bulan Ini/3 Bulan/YTD) is shared across both
// cards below so they always describe the same period. `chartRef` lets the summary
// card's PDF export grab a snapshot of the live chart (siblings, so the ref is owned
// here and threaded down to both). `drillDown` holds the clicked chart point (or null);
// when set, it SWAPS OUT the chart/summary for a full-page shipment list (not a popup)
// — `onNavigateToShipment` (passed down from AdminDashboardPage, same mechanism Overview
// already uses) lets a row jump into the real record in Pengiriman.
export default function ReportSection({ onNavigateToShipment }) {
  const [range, setRange] = useState('month')
  const [drillDown, setDrillDown] = useState(null) // { period, label, category } | null
  const chartRef = useRef(null)

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto w-full pb-10">
      <section className="flex flex-col gap-2 border-b border-gray-200 pb-6">
        <h2 className="text-2xl md:text-3xl font-black text-[#002442] tracking-tight">Laporan</h2>
        <p className="text-sm text-gray-500 font-medium">Ringkasan performa pengiriman: kondisi unit saat tiba per periode.</p>
      </section>

      {drillDown ? (
        <ConditionDetailPage
          period={drillDown.period}
          label={drillDown.label}
          category={drillDown.category}
          onBack={() => setDrillDown(null)}
          onNavigateToShipment={onNavigateToShipment}
        />
      ) : (
        <>
          <ShipmentConditionChart range={range} onRangeChange={setRange} chartRef={chartRef} onPointClick={setDrillDown} />
          <ServiceLineSummary range={range} chartRef={chartRef} />
        </>
      )}
    </div>
  )
}
