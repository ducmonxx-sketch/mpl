import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import anime from 'animejs'
import { env } from '../../lib/env.js'

const NAV_ITEMS = [
    { label: 'Beranda', href: '#home' },
    { label: 'Tentang Kami', href: '#about' },
    { label: 'Layanan', href: '#services' },
    { label: 'Mitra Kami', href: '#partners' },
    { label: 'Kontak', href: '#contact' },
]

const SECTION_IDS = ['home', 'about', 'services', 'partners', 'contact']

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false)
    const [activeSection, setActiveSection] = useState('#')
    const [isScrolled, setIsScrolled] = useState(false)
    const overlayRef = useRef(null)

    // Strip hash from URL on mount and reset scroll
    useEffect(() => {
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual'
        }
        window.scrollTo(0, 0)

        if (window.location.hash) {
            window.history.replaceState(null, null, window.location.pathname + window.location.search)
        }
    }, [])

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        if (menuOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [menuOpen])

    // Scroll state for background blur
    useEffect(() => {
        const handleScroll = () => {
            const currentScroll = window.scrollY;
            setIsScrolled(currentScroll > 20);
            
            const isBottom = Math.abs(
                (document.documentElement.scrollHeight || document.body.scrollHeight) - 
                (currentScroll + window.innerHeight)
            ) <= 100;
            
            if (isBottom) setActiveSection('#contact');
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll()
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Intersection Observer for active sections
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setActiveSection(`#${entry.target.id}`)
                }
            })
        }, {
            rootMargin: '-20% 0px -60% 0px'
        })

        SECTION_IDS.forEach(id => {
            const el = document.getElementById(id)
            if (el) observer.observe(el)
        })

        return () => observer.disconnect()
    }, [])

    // Run Anime.js stagger when menu opens/closes
    useEffect(() => {
        if (menuOpen) {
            anime.set('.mobile-link-item', { opacity: 0, translateY: 30 })
            anime({
                targets: '.mobile-link-item',
                opacity: [0, 1],
                translateY: [30, 0],
                delay: anime.stagger(50, { start: 100 }),
                easing: 'easeOutExpo',
                duration: 600
            })
        } else {
            anime({
                targets: '.mobile-link-item',
                opacity: 0,
                translateY: -20,
                easing: 'easeOutExpo',
                duration: 300
            })
        }
    }, [menuOpen])

    const handleNavClick = (e, href) => {
        e.preventDefault()
        const targetId = href.replace('#', '')
        const element = document.getElementById(targetId)
        
        if (menuOpen) {
            setMenuOpen(false)
            setTimeout(() => {
                if (element) element.scrollIntoView({ behavior: 'smooth' })
                window.history.replaceState(null, null, window.location.pathname + window.location.search)
            }, 300)
        } else {
            if (element) element.scrollIntoView({ behavior: 'smooth' })
            window.history.replaceState(null, null, window.location.pathname + window.location.search)
        }
    }

    return (
        <>
            <header 
                className={`sticky top-0 z-50 w-full text-white transition-all duration-300 ease-in-out ${
                    isScrolled 
                    ? 'bg-[#0B1121]/90 backdrop-blur-md border-b border-white/10 shadow-lg' 
                    : 'bg-[#0B1121]'
                }`}
            >
                <div className={`mx-auto flex items-center justify-between px-6 lg:px-8 transition-all duration-300 ${
                    isScrolled ? 'h-16' : 'h-24'
                }`}>
                    {/* Logo */}
                    <div className="flex items-center gap-3 group cursor-pointer relative z-50" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
                        <img
                            src="/mpl_logo_proto.svg"
                            alt="PT Mahkota Putra Logistik Logo"
                            className="h-10 w-10 rounded-lg object-contain transition-transform group-hover:scale-105 bg-white/5 p-1 border border-white/10"
                        />
                        <h1 className="text-lg sm:text-xl font-display font-bold leading-tight tracking-wide text-white">
                            <span className="hidden xl:inline">PT Mahkota Putra Logistik</span>
                            <span className="xl:hidden">PT MPL</span>
                        </h1>
                    </div>

                    {/* Desktop Nav */}
                    <nav className="hidden lg:flex items-center gap-2">
                        {NAV_ITEMS.map(({ label, href }) => (
                            <a
                                key={href}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                                    activeSection === href 
                                    ? 'bg-white/10 text-secondary font-bold' 
                                    : 'hover:bg-white/5 hover:text-white text-white/70'
                                }`}
                                href={href}
                                onClick={(e) => handleNavClick(e, href)}
                            >
                                {label}
                            </a>
                        ))}
                    </nav>

                    {/* Desktop CTAs */}
                    <div className="hidden lg:flex items-center gap-4 relative z-50">
                        <a
                            href={`mailto:${env.VITE_CONTACT_EMAIL}`}
                            className="flex h-10 items-center justify-center rounded-xl bg-secondary px-5 text-sm font-bold text-primary transition-all duration-300 hover:-translate-y-[2px] hover:bg-[#ffe066] hover:shadow-[0_0_20px_rgba(242,184,36,0.3)]"
                        >
                            Hubungi Kami
                        </a>
                        <Link
                            to="/client"
                            className="flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-5 text-sm font-bold text-white transition-all duration-300 hover:bg-white/10 hover:border-white/40 hover:-translate-y-[2px]"
                        >
                            Register / Log In
                        </Link>
                    </div>

                    {/* Mobile Animated Burger Button */}
                    <button
                        className="lg:hidden relative w-12 h-12 flex flex-col items-center justify-center gap-[6px] focus:outline-none z-50 group"
                        onClick={() => setMenuOpen(prev => !prev)}
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={menuOpen}
                    >
                        <span className={`block h-[2px] w-6 bg-white transition-transform duration-300 ease-in-out ${menuOpen ? 'translate-y-[8px] rotate-45' : 'group-hover:bg-secondary'}`} />
                        <span className={`block h-[2px] w-6 bg-white transition-opacity duration-300 ease-in-out ${menuOpen ? 'opacity-0' : 'group-hover:bg-secondary'}`} />
                        <span className={`block h-[2px] w-6 bg-white transition-transform duration-300 ease-in-out ${menuOpen ? '-translate-y-[8px] -rotate-45' : 'group-hover:bg-secondary'}`} />
                    </button>
                </div>
            </header>

            {/* Mobile Full-Screen Overlay */}
            <div
                ref={overlayRef}
                className={`fixed inset-0 z-40 bg-[#0B1121]/95 backdrop-blur-3xl transition-opacity duration-500 lg:hidden ${
                    menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            >
                <div className="flex flex-col h-full justify-center px-8 pt-20 pb-12">
                    <nav className="flex flex-col gap-6 items-center w-full">
                        {NAV_ITEMS.map(({ label, href }) => (
                            <a
                                key={href}
                                className={`mobile-link-item text-3xl font-display font-bold tracking-tight transition-colors duration-200 ${
                                    activeSection === href 
                                    ? 'text-secondary' 
                                    : 'text-white hover:text-white/80'
                                }`}
                                href={href}
                                onClick={(e) => handleNavClick(e, href)}
                            >
                                {label}
                            </a>
                        ))}
                        
                        <div className="w-full max-w-[280px] mt-12 flex flex-col gap-4">
                            <a
                                href={`mailto:${env.VITE_CONTACT_EMAIL}`}
                                className="mobile-link-item flex h-14 items-center justify-center rounded-xl bg-secondary px-6 text-lg font-bold text-primary shadow-[0_0_20px_rgba(242,184,36,0.2)] transition-all duration-300"
                            >
                                Hubungi Kami
                            </a>
                            <Link
                                to="/client"
                                className="mobile-link-item flex h-14 items-center justify-center rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-6 text-lg font-bold text-white transition-all duration-300"
                            >
                                Register / Log In
                            </Link>
                        </div>
                    </nav>
                </div>
            </div>
        </>
    )
}
