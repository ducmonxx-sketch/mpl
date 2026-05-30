import { useFadeInOnScroll } from '../../hooks/useFadeInOnScroll'
import { env } from '../../lib/env.js'
import Icon from '../Icon'

export default function HeroSection() {
    const ref = useFadeInOnScroll()

    return (
        <section className="relative w-full bg-white">
            <div ref={ref} className="fade-in-section mx-auto max-w-[1200px] px-6 py-16 lg:px-8 lg:py-24">
                <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                    {/* Left Column */}
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                                <Icon name="verified" size={18} />
                                Mitra Logistik Terpercaya
                            </div>
                            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                                <Icon name="location_on" size={18} />
                                Jakarta Based
                            </div>
                        </div>

                        <h1 className="font-display text-[40px] font-extrabold leading-[1.1] text-primary sm:text-5xl lg:text-[56px]">
                            Solusi Logistik Terpercaya Untuk Bisnis Anda
                        </h1>

                        <p className="text-lg leading-relaxed text-neutral-dark/80 max-w-lg">
                            Kami menyediakan layanan pengiriman dan pergudangan yang aman, cepat, dan efisien ke seluruh Indonesia. Fokus pada ketepatan waktu dan keamanan barang.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-4">
                            <a href={`mailto:${env.VITE_CONTACT_EMAIL}`} className="flex h-12 items-center justify-center rounded-lg bg-secondary px-8 text-base font-bold text-primary shadow-lg transition-transform hover:scale-105 hover:bg-[#e0a81d]">
                                Hubungi Kami
                            </a>
                            <a href="#services" className="flex h-12 items-center justify-center rounded-lg border-2 border-primary bg-transparent px-8 text-base font-bold text-primary transition-colors hover:bg-primary/5">
                                Pelajari Layanan
                            </a>
                        </div>

                        <div className="mt-8 flex gap-8 border-t border-gray-100 pt-8">
                            <div>
                                <h3 className="text-3xl font-bold text-primary">150K+</h3>
                                <p className="text-sm text-gray-500">Pengiriman Sukses</p>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-primary">50+</h3>
                                <p className="text-sm text-gray-500">Kota Tujuan</p>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-primary">9 AM-5 PM</h3>
                                <p className="text-sm text-gray-500">Senin - Sabtu (Kecuali Hari Libur)</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column — Hero Image */}
                    <div className="relative h-[400px] w-full overflow-hidden rounded-2xl shadow-2xl lg:h-[600px]">
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent z-10"></div>
                        <img
                            alt="Logistics truck operation"
                            className="h-full w-full object-cover object-[center_40%]"
                            src="/1.JPG.jpeg"
                            loading="eager"
                            fetchPriority="high"
                            width="600"
                            height="600"
                            decoding="async"
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}
