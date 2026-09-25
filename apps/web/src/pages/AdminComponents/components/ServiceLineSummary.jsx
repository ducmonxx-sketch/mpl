import { useEffect, useState } from 'react'
import Icon from '../../../components/Icon'
import Loader from '../../../components/Loader'
import { shipmentsAPI } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

// Matches Shipment.shippingCategory values — same vocabulary as ShipmentConditionChart.
// Colors are the dataviz skill's validated categorical slots 1-3 (blue/orange/aqua),
// deliberately NOT the gold/red used for the condition line chart above — those are
// reserved "status" colors (perfect/defective) and shouldn't double as category identity.
const CATEGORIES = [
  { value: 'Unit', label: 'Unit', color: '#2a78d6' },
  { value: 'Cargo', label: 'Kargo', color: '#eb6834' },
  { value: 'Container', label: 'Container', color: '#1baf7a' },
]

const RANGE_LABELS = { month: 'Bulan Ini', quarter: '3 Bulan', ytd: 'YTD' }

// Rasterize an <svg> element (Recharts renders pure SVG) to a PNG data URL by
// serializing it, loading it into an offscreen Image, then drawing it onto a canvas
// at 2x for crispness in the PDF. Same technique already used for the sidebar logo
// in ShipmentsSection.jsx's Surat Jalan generator — jsPDF has no native SVG support.
function svgToPngDataUrl(svgEl, scale = 2) {
  return new Promise((resolve, reject) => {
    const rect = svgEl.getBoundingClientRect()
    const xml = new XMLSerializer().serializeToString(svgEl)
    const svg64 = btoa(unescape(encodeURIComponent(xml)))
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = rect.width * scale
        canvas.height = rect.height * scale
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff' // the SVG itself has a transparent background
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve({ dataUrl: canvas.toDataURL('image/png'), width: rect.width, height: rect.height })
      } catch (err) { reject(err) }
    }
    img.onerror = reject
    img.src = 'data:image/svg+xml;base64,' + svg64
  })
}

function rasterizeLogo(url, size = 240) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = size; c.height = size
        c.getContext('2d').drawImage(img, 0, 0, size, size)
        resolve(c.toDataURL('image/png'))
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// Overall perfect-condition rate + each service line's share of total shipped units,
// for the same period the condition chart above is showing (shared `range`).
export default function ServiceLineSummary({ range, chartRef }) {
  const { showToast } = useToast()
  const [totals, setTotals] = useState(null) // { Unit: {perfect,defective}, Cargo: {...}, Container: {...} }
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all(CATEGORIES.map(c => shipmentsAPI.getConditionAnalytics(range, c.value)))
      .then(results => {
        if (cancelled) return
        const next = {}
        results.forEach((data, i) => {
          const buckets = data.buckets || []
          next[CATEGORIES[i].value] = {
            perfect: buckets.reduce((sum, b) => sum + (b.unitsPerfect || 0), 0),
            defective: buckets.reduce((sum, b) => sum + (b.unitsDefective || 0), 0),
          }
        })
        setTotals(next)
      })
      .catch(() => { if (!cancelled) setTotals(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [range])

  const grandTotal = totals ? Object.values(totals).reduce((s, t) => s + t.perfect + t.defective, 0) : 0
  const grandPerfect = totals ? Object.values(totals).reduce((s, t) => s + t.perfect, 0) : 0
  const perfectRate = grandTotal > 0 ? Math.round((grandPerfect / grandTotal) * 100) : null

  const shares = CATEGORIES.map(c => {
    const t = totals?.[c.value] ?? { perfect: 0, defective: 0 }
    const total = t.perfect + t.defective
    const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0
    return { ...c, total, pct }
  })

  // Branded, single-page PDF: MPL letterhead (same as the Surat Jalan generator),
  // the hero % + a snapshot of the live line chart, then a summary table — a
  // presentable report rather than a raw data dump.
  const handleDownloadPdf = async () => {
    const svgEl = chartRef?.current?.querySelector('svg')
    setExporting(true)
    try {
      const [{ jsPDF }, { default: autoTable }, logoPng, chartPng] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
        rasterizeLogo(`${window.location.origin}/mpl_logo_proto.svg`, 240),
        svgEl ? svgToPngDataUrl(svgEl) : Promise.resolve(null),
      ])

      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const pageW = doc.internal.pageSize.getWidth()
      const M = 14
      const contentW = pageW - M * 2
      let y = M

      if (logoPng) { try { doc.addImage(logoPng, 'PNG', M, y, 20, 20) } catch { /* skip logo */ } }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(0)
      doc.text('PT. MAHKOTA PUTRA LOGISTIK', pageW / 2, y + 7, { align: 'center' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
      doc.text('Jl. Cakung Cilincing No. 35 Cakung Barat, Cakung, Kota ADM Jakarta Timur, DKI Jakarta', pageW / 2, y + 12, { align: 'center' })
      y += 20
      doc.setLineWidth(0.6); doc.line(M, y, pageW - M, y)
      y += 5

      doc.setFillColor(229, 229, 229); doc.setDrawColor(0); doc.setLineWidth(0.2)
      doc.rect(M, y, contentW, 8, 'FD')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
      doc.text('LAPORAN KONDISI PENGIRIMAN', pageW / 2, y + 5.6, { align: 'center' })
      y += 13

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0)
      doc.text(`Periode: ${RANGE_LABELS[range]}`, M, y)
      doc.text(`Dibuat: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageW - M, y, { align: 'right' })
      y += 8

      doc.setFont('helvetica', 'bold'); doc.setFontSize(28); doc.setTextColor(0, 36, 66)
      doc.text(perfectRate !== null ? `${perfectRate}%` : '—', M, y + 10)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90)
      doc.text('Kondisi Sempurna Keseluruhan (Unit + Kargo + Container)', M, y + 16)
      y += 22

      if (chartPng) {
        const imgW = contentW
        const imgH = (chartPng.height / chartPng.width) * imgW
        doc.addImage(chartPng.dataUrl, 'PNG', M, y, imgW, imgH)
        y += imgH + 6
      }

      autoTable(doc, {
        startY: y, margin: { left: M, right: M }, theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2.2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: 20, valign: 'middle' },
        headStyles: { fillColor: [0, 36, 66], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
        head: [['Kategori', 'Total Unit', 'Kondisi Sempurna', 'Rusak', '% dari Total']],
        body: [
          ...shares.map(s => [s.label, String(s.total), String(totals[s.value].perfect), String(totals[s.value].defective), `${s.pct.toFixed(1)}%`]),
          ['Total', String(grandTotal), String(grandPerfect), String(grandTotal - grandPerfect), '100%'],
        ],
        columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
        didParseCell: (data) => { if (data.row.index === shares.length) data.cell.styles.fontStyle = 'bold' },
      })

      doc.save(`Laporan-Kondisi-${range}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      showToast('Gagal membuat laporan PDF.', 'error')
      console.error('Condition report PDF failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
      <div className="p-6 md:p-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#002442]">Distribusi Layanan</h3>
            <p className="text-xs text-gray-500 mt-0.5">Pangsa Unit/Kargo/Container & kondisi sempurna keseluruhan — {RANGE_LABELS[range]}.</p>
            <p className="text-5xl font-black text-[#002442] mt-3">{perfectRate !== null ? `${perfectRate}%` : '—'}</p>
          </div>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={loading || exporting || !totals || grandTotal === 0}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[#002442] bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-200 rounded-xl transition-colors shrink-0"
          >
            <Icon name={exporting ? 'progress_activity' : 'download'} size={16} className={exporting ? 'animate-spin' : ''} />
            {exporting ? 'Membuat PDF...' : 'Unduh Laporan'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 h-16 text-gray-400 text-sm">
            <Loader size="sm" />
            Memuat data...
          </div>
        ) : grandTotal === 0 ? (
          <div className="flex items-center justify-center h-16 text-gray-400 text-sm">Belum ada pengiriman selesai pada periode ini.</div>
        ) : (
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            {shares.map(s => (
              <div key={s.value} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  {s.label}
                </div>
                <span className="text-xl font-black text-[#002442]">{s.pct.toFixed(0).padStart(2, '0')}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {grandTotal > 0 && (
        <div className="bg-gray-50 border-t border-gray-100 px-6 md:px-8 py-6">
          <div className="w-full h-4 rounded-full bg-gray-200 overflow-hidden flex">
            {shares.map(s => (
              s.pct > 0 && (
                <div
                  key={s.value}
                  title={`${s.label}: ${s.pct.toFixed(1)}%`}
                  style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                  className="h-full first:rounded-l-full last:rounded-r-full border-r-2 border-gray-50 last:border-r-0"
                />
              )
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
