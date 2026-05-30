import { useFadeInOnScroll } from '../../hooks/useFadeInOnScroll'
import { env } from '../../lib/env.js'


export default function CTASection() {
    const ref = useFadeInOnScroll()

    return (
        <section className="relative overflow-hidden bg-primary py-24" id="contact">
            {/* SVG pattern background */}
            <div
                className="absolute inset-0 z-0 opacity-10"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
            ></div>

            <div ref={ref} className="fade-in-section relative z-10 mx-auto max-w-[1200px] px-6 text-center lg:px-8">
                <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
                    Siap Mengoptimalkan Logistik Bisnis Anda?
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-lg text-gray-300">
                    Hubungi tim ahli kami untuk mendapatkan penawaran terbaik dan konsultasi gratis mengenai kebutuhan pengiriman Anda.
                </p>
                <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                    <a href={`mailto:${env.VITE_CONTACT_EMAIL}`} className="flex h-14 w-full sm:w-auto min-w-[200px] items-center justify-center rounded-lg bg-secondary px-8 text-lg font-bold text-primary shadow-lg transition-transform hover:scale-105 hover:bg-[#e0a81d]">

                        Hubungi Kami Sekarang
                    </a>
                    <a href={env.VITE_WHATSAPP_LINK || '#'} target="_blank" rel="noopener noreferrer" className="flex h-14 w-full sm:w-auto min-w-[200px] items-center justify-center rounded-lg border-2 border-white bg-transparent px-8 text-lg font-bold text-white transition-colors hover:bg-white/10">

                        Chat WhatsApp
                    </a>
                </div>
            </div>
        </section>
    )
}
