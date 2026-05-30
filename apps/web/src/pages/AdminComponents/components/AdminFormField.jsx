export default function AdminFormField({ label, required, children, fullWidth }) {
  return (
    <div className={`adm-form-field${fullWidth ? ' adm-form-field--full' : ''}`}>
      <label className="adm-form-field__label">
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
      </label>
      {children}
    </div>
  )
}
