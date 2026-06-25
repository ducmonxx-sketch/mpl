import Icon from '../../../components/Icon'

export default function AdminModal({ title, subtitle, onClose, onSubmit, submitLabel = 'Simpan', children }) {
  return (
    <div className="fixed inset-0 bg-[#002442]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <form
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onSubmit?.() }}
      >
        <div className="flex justify-between items-start p-6 md:p-8 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-[#002442]">{title}</h3>
            {subtitle && <p className="text-sm font-medium text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <button 
            type="button" 
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" 
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          {children}
        </div>

        <div className="flex justify-end gap-3 p-6 md:p-8 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button 
            type="button" 
            className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors" 
            onClick={onClose}
          >
            Batal
          </button>
          <button 
            type="submit" 
            className="px-6 py-2.5 text-sm font-bold text-[#002442] bg-[#fec330] hover:bg-[#eab308] rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <Icon name="save" size={18} />
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
