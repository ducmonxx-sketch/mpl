import { env } from '../../lib/env.js'
import Icon from '../Icon'

export default function Footer() {

    return (
        <footer className="bg-footer-bg text-white pt-16 pb-8 border-t border-white/5">
            <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
                <div className="grid gap-12 lg:grid-cols-3 md:grid-cols-2">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <img
                                src="/mpl_logo_proto.svg"
                                alt="PT Mahkota Putra Logistik Logo"
                                className="h-8 w-8 rounded-lg object-contain"
                            />
                            <h3 className="text-xl font-bold text-white">PT MPL</h3>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            PT Mahkota Putra Logistik menyediakan solusi logistik terintegrasi untuk mendukung pertumbuhan bisnis di seluruh Indonesia.
                        </p>
                        <div className="flex gap-4">
                            <a className="text-gray-400 hover:text-white transition-colors" href="#partners">
                                <Icon name="social_leaderboard" size={24} />
                            </a>
                            <a className="text-gray-400 hover:text-white transition-colors" href={`mailto:${env.VITE_CONTACT_EMAIL}`}>

                                <Icon name="email" size={24} />
                            </a>
                            {env.VITE_WHATSAPP_LINK && (
                                <a className="text-gray-400 hover:text-white transition-colors" href={env.VITE_WHATSAPP_LINK}>
                                    <Icon name="call" size={24} />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Quick Links — matches navbar */}
                    <div>
                        <h4 className="text-lg font-bold mb-6 text-white">Tautan Cepat</h4>
                        <ul className="space-y-3 text-sm text-gray-400">
                            <li><a className="hover:text-secondary transition-colors" href="#">Beranda</a></li>
                            <li><a className="hover:text-secondary transition-colors" href="#about">Tentang Kami</a></li>
                            <li><a className="hover:text-secondary transition-colors" href="#services">Layanan</a></li>
                            <li><a className="hover:text-secondary transition-colors" href="#partners">Mitra Kami</a></li>
                            <li><a className="hover:text-secondary transition-colors" href="#contact">Kontak</a></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="text-lg font-bold mb-6 text-white">Kontak</h4>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li className="flex items-start gap-3">
                                <Icon name="location_on" className="text-secondary shrink-0" size={24} />
                                <span>Jl. Cakung Cilincing No.35, Jakarta Timur, Indonesia</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Icon name="phone" className="text-secondary shrink-0" size={24} />
                                <span>+62 812-9116-6006</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Icon name="email" className="text-secondary shrink-0" size={24} />
                                <span>{env.VITE_CONTACT_EMAIL}</span>

                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-16 border-t border-white/10 pt-8 text-center sm:text-left sm:flex sm:justify-between sm:items-center">
                    <p className="text-sm text-gray-500">© 2026 PT Mahkota Putra Logistik. Hak Cipta Dilindungi.</p>
                    <div className="mt-4 sm:mt-0 flex gap-6 text-sm text-gray-500 justify-center sm:justify-end">
                        <a className="hover:text-white cursor-pointer">Privacy Policy</a>
                        <a className="hover:text-white cursor-pointer">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    )
}
