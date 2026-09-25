import Icon from './Icon'

export default function KPICard({ icon, label, sublabel, value, trend, color = 'primary', delay = 0, onClick, hero = false }) {
  const colorMap = {
    primary: { iconBg: 'bg-[#002442]/5', iconFg: 'text-[#002442]' },
    gold: { iconBg: 'bg-[#fec330]/15', iconFg: 'text-[#795900]' },
    green: { iconBg: 'bg-green-500/10', iconFg: 'text-green-700' },
    red: { iconBg: 'bg-red-500/10', iconFg: 'text-red-700' },
  }
  const c = colorMap[color] || colorMap.primary

  if (hero) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl p-6 flex flex-col justify-between text-white bg-gradient-to-br from-[#002442] via-[#003a66] to-[#045089] shadow-[0_12px_28px_-12px_rgba(0,36,66,0.55)] transition-transform duration-300 ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
        style={{ animation: `dashFadeUp 0.5s ${delay}s both` }}
        onClick={onClick}
      >
        <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(254,195,48,0.35), transparent 70%)' }} />
        <div className="relative flex items-start justify-between">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-white/75">{label}</p>
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Icon name={icon} size={20} />
          </div>
        </div>
        <div className="relative mt-1">
          <h3 className="text-4xl font-extrabold tracking-tight leading-none">{value}</h3>
          {(trend || sublabel) && (
            <p className="text-xs font-semibold text-white/85 mt-3">
              {trend && <span className="text-[#fec330] font-bold">{trend}</span>}{trend && sublabel ? ' · ' : ''}{sublabel}
            </p>
          )}
        </div>
      </div>
    )
  }

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
        <h3 className="text-3xl font-extrabold text-[#002442] tracking-tight mb-2 leading-none">{value}</h3>
        <p className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-1 font-medium">{sublabel}</p>}
      </div>
    </div>
  )
}
