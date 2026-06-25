import { env } from '../../lib/env.js'
import { MapPin, Phone, Mail, Globe } from 'lucide-react'

export default function Footer() {
    
    // Smooth scroll handler to keep the URL clean
    const handleSmoothScroll = (e, targetId) => {
        e.preventDefault()
        const targetElement = document.getElementById(targetId)
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' })
            // Clean up the URL hash if it exists, without triggering a reload
            history.replaceState(null, '', window.location.pathname)
        }
    }

    return (
        <footer className="bg-[#0B1121] text-white pt-20 pb-8 border-t border-white/5 relative overflow-hidden">
            {/* Very faint top glow to blend with the CTA section */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

            <div className="mx-auto max-w-[1200px] px-6 lg:px-8 relative z-10">
                <div className="grid gap-12 lg:grid-cols-3 md:grid-cols-2">
                    
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <img
                                src="/mpl_logo_proto.svg"
                                alt="PT Mahkota Putra Logistik Logo"
                                className="h-10 w-10 rounded-lg object-contain bg-white/5 p-1 border border-white/10"
                            />
                            {/* Renamed to full company name as requested */}
                            <h3 className="text-xl font-display font-bold text-white tracking-wide">
                                PT Mahkota Putra Logistik
                            </h3>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed mb-8">
                            Menyediakan solusi logistik terintegrasi untuk mendukung pertumbuhan bisnis di seluruh Indonesia.
                        </p>
                        <div className="flex gap-4">
                            <a 
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300" 
                                href="#"
                                aria-label="Website"
                            >
                                <Globe size={18} />
                            </a>
                            <a 
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300" 
                                href={`mailto:${env.VITE_CONTACT_EMAIL}`}
                                aria-label="Email"
                            >
                                <Mail size={18} />
                            </a>
                            {env.VITE_WHATSAPP_LINK && (
                                <a 
                                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300" 
                                    href={env.VITE_WHATSAPP_LINK}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="WhatsApp"
                                >
                                    <Phone size={18} />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-[0.2em] mb-8 text-white/80">Tautan Cepat</h4>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li>
                                <a 
                                    className="inline-block hover:text-secondary hover:translate-x-1 transition-all duration-300" 
                                    href="#home"
                                    onClick={(e) => handleSmoothScroll(e, 'home')}
                                >
                                    Beranda
                                </a>
                            </li>
                            <li>
                                <a 
                                    className="inline-block hover:text-secondary hover:translate-x-1 transition-all duration-300" 
                                    href="#about"
                                    onClick={(e) => handleSmoothScroll(e, 'about')}
                                >
                                    Tentang Kami
                                </a>
                            </li>
                            <li>
                                <a 
                                    className="inline-block hover:text-secondary hover:translate-x-1 transition-all duration-300" 
                                    href="#services"
                                    onClick={(e) => handleSmoothScroll(e, 'services')}
                                >
                                    Layanan
                                </a>
                            </li>
                            <li>
                                <a 
                                    className="inline-block hover:text-secondary hover:translate-x-1 transition-all duration-300" 
                                    href="#partners"
                                    onClick={(e) => handleSmoothScroll(e, 'partners')}
                                >
                                    Mitra Kami
                                </a>
                            </li>
                            <li>
                                <a 
                                    className="inline-block hover:text-secondary hover:translate-x-1 transition-all duration-300" 
                                    href="#contact"
                                    onClick={(e) => handleSmoothScroll(e, 'contact')}
                                >
                                    Kontak
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-[0.2em] mb-8 text-white/80">Kontak Kami</h4>
                        <ul className="space-y-6 text-sm text-gray-400">
                            <li className="flex items-start gap-4 group">
                                <div className="mt-0.5 shrink-0 rounded-full bg-secondary/10 p-2 text-secondary transition-colors group-hover:bg-secondary group-hover:text-primary">
                                    <MapPin size={18} />
                                </div>
                                <span className="leading-relaxed transition-colors group-hover:text-white">
                                    Jl. Cakung Cilincing No.35, Jakarta Timur, Indonesia
                                </span>
                            </li>
                            <li className="flex items-center gap-4 group">
                                <div className="shrink-0 rounded-full bg-secondary/10 p-2 text-secondary transition-colors group-hover:bg-secondary group-hover:text-primary">
                                    <Phone size={18} />
                                </div>
                                <span className="transition-colors group-hover:text-white">
                                    +62 812-9116-6006
                                </span>
                            </li>
                            <li className="flex items-center gap-4 group">
                                <div className="shrink-0 rounded-full bg-secondary/10 p-2 text-secondary transition-colors group-hover:bg-secondary group-hover:text-primary">
                                    <Mail size={18} />
                                </div>
                                <span className="transition-colors group-hover:text-white">
                                    {env.VITE_CONTACT_EMAIL}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-20 border-t border-white/10 pt-8 text-center sm:text-left sm:flex sm:justify-between sm:items-center">
                    <p className="text-sm text-gray-500">© 2026 PT Mahkota Putra Logistik. Hak Cipta Dilindungi.</p>
                    <div className="mt-4 sm:mt-0 flex gap-6 text-sm text-gray-500 justify-center sm:justify-end">
                        <a className="hover:text-white cursor-pointer transition-colors">Privacy Policy</a>
                        <a className="hover:text-white cursor-pointer transition-colors">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    )
}
