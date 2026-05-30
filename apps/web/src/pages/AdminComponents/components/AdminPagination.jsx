import Icon from '../../../components/Icon'

export default function AdminPagination({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange }) {
  const start = (currentPage - 1) * itemsPerPage + 1
  const end = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="adm-pagination">
      <span className="adm-pagination__info">
        Menampilkan {start}–{end} dari {totalItems}
      </span>
      <div className="adm-pagination__controls">
        <button
          className="adm-pagination__btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <Icon name="chevron_left" size={18} />
        </button>
        <span className="adm-pagination__page">Hal. {currentPage}</span>
        <button
          className="adm-pagination__btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <Icon name="chevron_right" size={18} />
        </button>
      </div>
    </div>
  )
}
