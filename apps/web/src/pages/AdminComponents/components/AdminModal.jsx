import Icon from '../../../components/Icon'

export default function AdminModal({ title, subtitle, onClose, onSubmit, submitLabel = 'Simpan', children }) {
  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <form
        className="adm-modal glass-card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onSubmit?.() }}
      >
        <div className="adm-modal__header">
          <div>
            <h3 className="adm-modal__title">{title}</h3>
            {subtitle && <p className="adm-modal__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="adm-modal__close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="adm-modal__body">
          {children}
        </div>

        <div className="adm-modal__footer">
          <button type="button" className="adm-modal__btn adm-modal__btn--cancel" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="adm-modal__btn adm-modal__btn--submit">
            <Icon name="save" size={16} />
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
