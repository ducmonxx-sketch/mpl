export default function AdminFormField({ label, required, children, fullWidth }) {
  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'col-span-1 md:col-span-2' : ''}`}>
      <label className="text-[0.75rem] font-bold text-[#002442] uppercase tracking-wide flex items-center">
        {label}
        {required && <span className="text-red-500 ml-1 text-sm">*</span>}
      </label>
      <div className="relative">
        {children}
      </div>
    </div>
  )
}
