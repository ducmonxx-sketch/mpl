import { Link } from 'react-router-dom'
import Icon from '../components/Icon'

export default function NotFoundPage() {
    return (
        <div className="min-h-screen bg-background-light flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full bg-primary text-white shadow-md">
                <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-6 lg:px-8">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-secondary">
                            <Icon name="local_shipping" size={28} />
                        </div>
                        <h1 className="text-xl font-bold leading-tight tracking-tight text-white">
                            PT Mahkota Putra Logistik
                        </h1>
                    </Link>
                </div>
            </header>

            {/* 404 Content */}
            <main className="flex-1 flex items-center justify-center px-6 py-24">
                <div className="text-center max-w-lg">
                    {/* Illustration: Person bowing */}
                    <div className="mb-8 flex justify-center">
                        <svg
                            viewBox="0 0 280 200"
                            className="w-64 h-auto"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            {/* Ground line */}
                            <line x1="40" y1="180" x2="240" y2="180" stroke="#d1d5db" strokeWidth="2" strokeDasharray="6,4" />

                            {/* Person bowing */}
                            {/* Head */}
                            <circle cx="170" cy="82" r="16" fill="#1b3b5f" />

                            {/* Body (bowing forward) */}
                            <line x1="155" y1="88" x2="120" y2="130" stroke="#1b3b5f" strokeWidth="6" strokeLinecap="round" />

                            {/* Left arm (hanging down) */}
                            <line x1="145" y1="100" x2="135" y2="140" stroke="#1b3b5f" strokeWidth="4" strokeLinecap="round" />

                            {/* Right arm (hanging down) */}
                            <line x1="135" y1="105" x2="125" y2="145" stroke="#1b3b5f" strokeWidth="4" strokeLinecap="round" />

                            {/* Left leg */}
                            <line x1="120" y1="130" x2="110" y2="178" stroke="#1b3b5f" strokeWidth="5" strokeLinecap="round" />

                            {/* Right leg */}
                            <line x1="120" y1="130" x2="135" y2="178" stroke="#1b3b5f" strokeWidth="5" strokeLinecap="round" />

                            {/* Feet */}
                            <line x1="105" y1="178" x2="115" y2="178" stroke="#1b3b5f" strokeWidth="4" strokeLinecap="round" />
                            <line x1="130" y1="178" x2="140" y2="178" stroke="#1b3b5f" strokeWidth="4" strokeLinecap="round" />

                            {/* Apology lines */}
                            <line x1="185" y1="75" x2="200" y2="65" stroke="#f2b824" strokeWidth="2" strokeLinecap="round" />
                            <line x1="188" y1="85" x2="205" y2="80" stroke="#f2b824" strokeWidth="2" strokeLinecap="round" />
                            <line x1="185" y1="95" x2="200" y2="95" stroke="#f2b824" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>

                    {/* 404 Text */}
                    <h1 className="font-display text-8xl font-extrabold text-primary mb-4">404</h1>
                    <h2 className="font-display text-2xl font-bold text-primary mb-4">
                        Halaman Tidak Ditemukan
                    </h2>
                    <p className="text-lg text-neutral-dark/70 mb-8">
                        We couldn't find the page you were looking for.
                    </p>
                    <Link
                        to="/"
                        className="inline-flex h-12 items-center justify-center rounded-lg bg-secondary px-8 text-base font-bold text-primary shadow-lg transition-transform hover:scale-105 hover:bg-[#e0a81d]"
                    >
                        <Icon name="home" className="mr-2" size={24} />
                        Kembali ke Beranda
                    </Link>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-footer-bg text-center py-6">
                <p className="text-sm text-gray-500">© 2026 PT Mahkota Putra Logistik. Hak Cipta Dilindungi.</p>
            </footer>
        </div>
    )
}
