import Icon from '../../../components/Icon'

export default function TrackingSearchBar({ value, onChange }) {
  return (
    <div className="relative w-full sm:w-96">
      <Icon name="search" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        placeholder="Cari ID pengiriman atau nama paket..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        id="tracking-search"
        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330] transition-all placeholder:text-gray-400"
      />
    </div>
  )
}
