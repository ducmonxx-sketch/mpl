import Icon from '../../../components/Icon'

export default function TrackingSearchBar({ searchQuery, onSearchChange }) {
  return (
    <div className="track-search-bar glass-card">
      <Icon name="search" size={18} />
      <input
        type="text"
        placeholder="Cari berdasarkan ID pengiriman atau nama paket..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        id="tracking-search"
      />
    </div>
  )
}
