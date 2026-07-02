import Icon from '../../../components/Icon'

export default function AdminKPICard({ icon, label, sublabel, value, trend, color = 'primary', delay = 0, onClick }) {
  const colorMap = {
    primary: { iconBg: 'bg-[#002442]/5', iconFg: 'text-[#002442]' },
    gold: { iconBg: 'bg-[#fec330]/15', iconFg: 'text-[#795900]' },
    green: { iconBg: 'bg-green-500/10', iconFg: 'text-green-700' },
    red: { iconBg: 'bg-red-500/10', iconFg: 'text-red-700' },
  }
  const c = colorMap[color] || colorMap.primary

  return (
    <div 
      className={`bg-white border border-gray-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-2xl p-6 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col justify-between group ${onClick ? 'cursor-pointer hover:border-[#fec330]' : ''}`}
      style={{ animation: `dashFadeUp 0.5s ${delay}s both` }}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-6">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${c.iconBg} ${c.iconFg}`}>
          <Icon name={icon} size={24} />
        </div>
        {trend && (
          <span className={`px-2.5 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-wider border ${trend.startsWith('+') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-4xl font-black text-[#002442] tracking-tight mb-2 leading-none">{value}</h3>
        <p className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-1 font-medium">{sublabel}</p>}
      </div>
    </div>
  )
}
