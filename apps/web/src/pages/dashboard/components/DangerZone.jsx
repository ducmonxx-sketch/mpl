export default function DangerZone({ onDeactivateRequest }) {
  return (
    <div className="settings-danger">
      <h3>Persistensi Akun</h3>
      <p>Menutup akun Anda akan segera menangguhkan semua pengiriman aktif dan menghapus data historis Anda. Tindakan ini tidak dapat dibatalkan.</p>
      <button className="settings-danger__btn" onClick={onDeactivateRequest}>Nonaktifkan Akun Klien</button>
    </div>
  )
}
