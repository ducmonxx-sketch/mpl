import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { env } from '../../lib/env.js'

const NAV_ITEMS = [
    { label: 'Beranda', href: '#' },
    { label: 'Tentang Kami', href: '#about' },
    { label: 'Layanan', href: '#services' },
    { label: 'Mitra Kami', href: '#partners' },
    { label: 'Kontak', href: '#contact' },
]

const SECTION_IDS = ['about', 'services', 'partners', 'contact']

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false)
    const [activeSection, setActiveSection] = useState('#')
    const menuRef = useRef(null)

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        if (menuOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [menuOpen])

    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY + 120
            let current = '#'

            for (const id of SECTION_IDS) {
                const el = document.getElementById(id)
                if (el && scrollY >= el.offsetTop) {
                    current = `#${id}`
                }
            }
            setActiveSection(current)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll()
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <header className="sticky top-0 z-50 w-full bg-primary text-white shadow-md">
            <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-6 lg:px-8">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <img
                        src="/mpl_logo_proto.svg"
                        alt="PT Mahkota Putra Logistik Logo"
                        className="h-10 w-10 rounded-lg object-contain"
                    />
                    <h1 className="text-lg sm:text-xl font-bold leading-tight tracking-tight text-white">
                        <span className="hidden xl:inline">PT Mahkota Putra Logistik</span>
                        <span className="xl:hidden">PT MPL</span>
                    </h1>
                </div>

                {/* Desktop Nav */}
                <nav className="hidden lg:flex items-center gap-6">
                    {NAV_ITEMS.map(({ label, href }) => (
                        <a
                            key={href}
                            className={`text-sm transition-colors hover:text-secondary ${activeSection === href ? 'font-bold text-secondary' : 'font-medium'
                                }`}
                            href={href}
                        >
                            {label}
                        </a>
                    ))}
                </nav>

                {/* Desktop CTAs */}
                <div className="hidden lg:flex items-center gap-3">
                    <a
                        href={`mailto:${env.VITE_CONTACT_EMAIL}`}
                        className="flex h-10 items-center justify-center rounded-lg bg-secondary px-5 text-sm font-bold text-primary transition-transform hover:scale-105 hover:bg-[#e0a81d]"
                    >
                        Hubungi Kami
                    </a>

                    {/* Register / Log In button */}
                    <Link
                        to="/client"
                        className="flex h-10 items-center justify-center rounded-lg px-5 text-sm font-bold transition-all border-2 bg-transparent border-white text-white hover:bg-white/10"
                    >
                        Register / Log In
                    </Link>
                </div>

                {/* Animated Burger Button */}
                <button
                    className="lg:hidden relative w-10 h-10 flex items-center justify-center focus:outline-none"
                    onClick={() => setMenuOpen(prev => !prev)}
                    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={menuOpen}
                >
                    <span className="burger-icon">
                        <span className={`burger-bar burger-bar--top ${menuOpen ? 'burger-bar--open' : ''}`} />
                        <span className={`burger-bar burger-bar--mid ${menuOpen ? 'burger-bar--open' : ''}`} />
                        <span className={`burger-bar burger-bar--bot ${menuOpen ? 'burger-bar--open' : ''}`} />
                    </span>
                </button>
            </div>

            {/* Mobile Backdrop */}
            <div
                className={`mobile-backdrop ${menuOpen ? 'mobile-backdrop--visible' : ''}`}
                onClick={() => setMenuOpen(false)}
            />

            {/* Mobile Nav */}
            <div
                ref={menuRef}
                className={`mobile-menu ${menuOpen ? 'mobile-menu--open' : ''}`}
            >
                <nav className="flex flex-col gap-1 pt-2 pb-4 px-6">
                    {NAV_ITEMS.map(({ label, href }, i) => (
                        <a
                            key={href}
                            className={`mobile-nav-link text-sm transition-colors hover:text-secondary ${activeSection === href ? 'font-bold text-secondary' : 'font-medium'
                                }`}
                            href={href}
                            onClick={() => setMenuOpen(false)}
                            style={{ transitionDelay: menuOpen ? `${80 + i * 50}ms` : '0ms' }}
                        >
                            {label}
                        </a>
                    ))}
                    <div className="mobile-nav-link mt-3 flex flex-col gap-3"
                         style={{ transitionDelay: menuOpen ? `${80 + NAV_ITEMS.length * 50}ms` : '0ms' }}>
                        <a
                            href={`mailto:${env.VITE_CONTACT_EMAIL}`}
                            className="flex h-10 items-center justify-center rounded-lg bg-secondary px-6 text-sm font-bold text-primary transition-transform hover:scale-105 hover:bg-[#e0a81d]"
                            onClick={() => setMenuOpen(false)}
                        >
                            Hubungi Kami
                        </a>
                        <Link
                            to="/client"
                            className="flex h-10 items-center justify-center rounded-lg border-2 border-white bg-transparent px-6 text-sm font-bold text-white hover:bg-white/10"
                            onClick={() => setMenuOpen(false)}
                        >
                            Register / Log In
                        </Link>
                    </div>
                </nav>
            </div>
        </header>
    )
}
