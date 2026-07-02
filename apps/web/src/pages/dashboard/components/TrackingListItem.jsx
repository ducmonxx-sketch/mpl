import Icon from '../../../components/Icon'
import AdminStatusBadge from '../../AdminComponents/components/AdminStatusBadge'

export default function TrackingListItem({ shipment, isSelected, onClick, index = 0 }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border-2 rounded-2xl p-5 transition-all duration-300 flex flex-col gap-3 group relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ${
        isSelected 
          ? 'border-[#002442] shadow-md ring-4 ring-[#002442]/5' 
          : 'border-transparent shadow-sm hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5'
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Background decoration for selected state */}
      {isSelected && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#002442]/5 to-transparent rounded-bl-full pointer-events-none" />
      )}

      {/* Header Info */}
      <div className="flex justify-between items-start w-full relative z-10">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">ID Pengiriman</span>
          <span className="text-base font-black text-[#002442]">{shipment.id}</span>
        </div>
        <AdminStatusBadge status={shipment.rawStatus} type="shipment" />
      </div>

      <div className="w-full h-px bg-gray-100 my-1 relative z-10" />

      {/* Package & Client Info */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 w-full relative z-10">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-gray-400">Muatan</span>
          <span className="text-sm font-bold text-gray-900">{shipment.package}</span>
        </div>
        <div className="flex flex-col sm:text-right">
          <span className="text-xs font-bold text-gray-400">Klien</span>
          <span className="text-sm font-bold text-gray-900">{shipment.client}</span>
        </div>
      </div>

      {/* Route & Progress */}
      <div className="flex flex-col gap-2 mt-2 w-full relative z-10">
        <div className="flex items-center justify-between text-sm font-medium text-gray-700 bg-gray-50 px-4 py-3 rounded-xl">
          <div className="flex items-center gap-2">
            <Icon name="location_on" size={16} className="text-[#fec330]" />
            <span className="line-clamp-1">{shipment.origin}</span>
          </div>
          <Icon name="arrow_forward" size={16} className="text-gray-400 shrink-0 mx-2" />
          <div className="flex items-center gap-2">
            <Icon name="flag" size={16} className="text-green-500" />
            <span className="line-clamp-1">{shipment.destination}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-1">
          <div 
            className="h-full bg-gradient-to-r from-[#fec330] to-[#eab308] rounded-full transition-all duration-1000 ease-out relative"
            style={{ width: `${shipment.progress}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite] -skew-x-12" />
          </div>
        </div>
      </div>
    </button>
  )
}
