import { useState, useEffect } from 'react'
import Icon from '../../../components/Icon'
import { trackingAPI } from '../../../lib/api'
import { getStatusConfig } from '../shipmentStatus'

function formatEventTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const EVENT_DOT_CLASS = {
  DONE: 'bg-green-500',
  ACTIVE: 'bg-[#fec330]',
  UPCOMING: 'bg-gray-300',
}

export default function ShipmentCard({ shipment, isExpanded, onToggleExpand }) {
  const s = shipment
  const status = getStatusConfig(s.status)

  const [events, setEvents] = useState(null)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState(false)

  // Lazy-load the full real tracking timeline the first time the card expands, instead
  // of the fake canned per-status text this card used to show (and instead of a separate
  // Tracking page — that nav was removed 2026-09-25, its content compressed in here).
  useEffect(() => {
    if (!isExpanded || events || eventsLoading) return
    let cancelled = false
    setEventsLoading(true)
    setEventsError(false)
    trackingAPI.getTimeline(s.id)
      .then(data => { if (!cancelled) setEvents(data.events || []) })
      .catch(() => { if (!cancelled) setEventsError(true) })
      .finally(() => { if (!cancelled) setEventsLoading(false) })
    return () => { cancelled = true }
  }, [isExpanded, s.id, events, eventsLoading])

  return (
    <div id={`ship-card-${s.id}`} className={`bg-white border border-gray-200 border-l-4 ${status.accent} shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-2xl p-5 md:p-6 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300`}>
      <div className="flex items-start justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#002442]/5 text-[#002442] flex items-center justify-center flex-shrink-0">
            <Icon name="local_shipping" size={20} />
          </div>
          <div>
            <p className="text-sm font-extrabold text-[#002442] m-0">{s.id}</p>
            <p className="text-xs text-gray-500 mt-0.5 m-0">{s.desc}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-wider ${status.pill}`}>
          <Icon name={status.icon} size={13} />
          {status.label}
        </span>
      </div>

      <div className="flex items-center py-4 border-y border-gray-100">
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="w-3 h-3 rounded-full bg-[#002442] ring-4 ring-white flex-shrink-0" />
          <div>
            <p className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-wider m-0">Asal</p>
            <p className="text-sm font-bold text-[#002442] m-0">{s.origin}</p>
          </div>
        </div>
        <div className="flex-1 h-[3px] bg-gray-100 rounded-full mx-[-6px] overflow-hidden relative z-[1]">
          <div className="h-full bg-[#fec330] rounded-full shadow-[0_0_8px_rgba(254,195,48,0.4)] transition-[width] duration-1000" style={{ width: `${s.progress}%` }} />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="w-3 h-3 rounded-full bg-[#fec330] ring-4 ring-white flex-shrink-0" />
          <div>
            <p className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-wider m-0">Tujuan</p>
            <p className="text-sm font-bold text-[#002442] m-0">{s.dest}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5 mt-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Icon name="calendar_today" size={14} className="text-gray-400" />
          <span>{s.date}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Icon name="local_shipping" size={14} className="text-gray-400" />
          <span>{s.service}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Icon name="package" size={14} className="text-gray-400" />
          <span>{s.weight}</span>
        </div>
        <button
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-[#002442] hover:text-[#fec330] transition-colors"
          onClick={onToggleExpand}
        >
          {isExpanded ? 'Tutup' : 'Detail'} <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={16} />
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-dashed border-gray-200" style={{ animation: 'dashFadeUp 0.3s ease both' }}>
          <p className="text-xs font-bold text-[#002442] mb-3">Riwayat Perjalanan</p>
          {eventsLoading ? (
            <p className="text-xs text-gray-400">Memuat riwayat...</p>
          ) : eventsError ? (
            <p className="text-xs text-gray-400">Gagal memuat riwayat pelacakan.</p>
          ) : !events || events.length === 0 ? (
            <p className="text-xs text-gray-400">Belum ada checkpoint tercatat untuk pengiriman ini.</p>
          ) : (
            <div className="flex flex-col">
              {events.map((e, i) => (
                <div key={e.id} className="flex gap-3">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1 ${EVENT_DOT_CLASS[e.status] || 'bg-gray-300'}`} />
                    {i < events.length - 1 && <span className="w-px flex-1 bg-gray-200" />}
                  </div>
                  <div className={`pb-4 ${e.status === 'UPCOMING' ? 'opacity-50' : ''}`}>
                    <p className="text-sm font-bold text-[#002442] m-0">{e.stepName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 m-0">{e.location} · {formatEventTime(e.eventTimestamp)}</p>
                    {e.driverNotes && <p className="text-xs text-gray-400 mt-1 m-0">{e.driverNotes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
