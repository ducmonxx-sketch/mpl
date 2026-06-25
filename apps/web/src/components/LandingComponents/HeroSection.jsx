import { useEffect, useRef } from 'react'
import anime from 'animejs'
import { env } from '../../lib/env.js'
import Icon from '../Icon'

export default function HeroSection() {
    const heroRef = useRef(null)

    useEffect(() => {
        // Ensure elements are hidden before animation kicks in
        anime.set([
            '.hero-badge', '.hero-title', '.hero-desc', '.hero-cta', '.hero-stat', 
            '.hero-image-container', '.hero-floating-card'
        ], { opacity: 0 });

        anime.set('.hero-image-container', { scale: 0.95, rotateX: 10, rotateY: -10 });
        anime.set('.hero-floating-card', { translateZ: 0, translateY: 50 });

        const tl = anime.timeline({
            easing: 'spring(1, 100, 14, 0)',
            duration: 500,
        });

        tl.add({
            targets: '.hero-badge',
            opacity: [0, 1],
            translateY: [30, 0],
            delay: anime.stagger(40)
        })
        .add({
            targets: ['.hero-title', '.hero-desc'],
            opacity: [0, 1],
            translateY: [30, 0],
            delay: anime.stagger(50)
        }, '-=400')
        .add({
            targets: '.hero-cta',
            opacity: [0, 1],
            translateY: [30, 0],
            delay: anime.stagger(40)
        }, '-=400')
        .add({
            targets: '.hero-stat',
            opacity: [0, 1],
            translateY: [30, 0],
            delay: anime.stagger(40)
        }, '-=400')
        .add({
            targets: '.hero-image-container',
            opacity: [0, 1],
            scale: [0.95, 1],
            rotateX: [10, 0],
            rotateY: [-10, 0],
            duration: 600,
            easing: 'easeOutElastic(1, 1)'
        }, '-=500')
        .add({
            targets: '.hero-floating-card',
            opacity: [0, 1],
            translateY: [50, 0],
            translateZ: [0, 40], // Antigravity 3D Depth
            duration: 500,
        }, '-=400');

    }, [])

    const schemaData = {
        "@context": "https://schema.org",
        "@type": ["LocalBusiness", "LogisticsService"],
        "name": "PT Mahkota Putra Logistik",
        "image": "https://mahkotaputralogistik.com/1.webp",
        "url": "https://mahkotaputralogistik.com",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": "Jakarta",
            "addressCountry": "ID"
        },
        "openingHoursSpecification": {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday"
            ],
            "opens": "09:00",
            "closes": "17:00"
        }
    };

    return (
        <section id="home" className="relative w-full overflow-hidden bg-background-light" ref={heroRef} style={{ perspective: '1500px' }}>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />
            {/* Ambient background orbs for mesh gradient depth */}
            <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-primary/5 blur-3xl pointer-events-none"></div>
            <div className="absolute right-0 bottom-0 h-[30rem] w-[30rem] rounded-full bg-secondary/10 blur-3xl pointer-events-none"></div>

            <div className="relative z-10 mx-auto max-w-[1200px] px-6 py-16 lg:px-8 lg:py-24">
                <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                    {/* Left Column */}
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="hero-badge inline-flex w-fit items-center gap-2 rounded-full border border-primary/10 bg-white/60 backdrop-blur-sm px-4 py-1.5 text-sm font-semibold text-primary shadow-sm transition-all duration-300 hover:shadow-md hover:bg-white cursor-default will-change-transform">
                                <Icon name="verified" size={18} className="text-secondary" />
                                Mitra Logistik Terpercaya
                            </div>
                            <div className="hero-badge inline-flex w-fit items-center gap-2 rounded-full border border-primary/10 bg-white/60 backdrop-blur-sm px-4 py-1.5 text-sm font-semibold text-primary shadow-sm transition-all duration-300 hover:shadow-md hover:bg-white cursor-default will-change-transform">
                                <Icon name="location_on" size={18} className="text-secondary" />
                                Jakarta Based
                            </div>
                        </div>

                        <h1 className="hero-title font-display text-[40px] font-extrabold leading-[1.1] tracking-tight text-primary sm:text-5xl lg:text-[56px] will-change-transform">
                            Solusi Logistik Terpercaya Untuk Bisnis Anda
                        </h1>

                        <p className="hero-desc text-lg leading-relaxed text-neutral-dark max-w-lg will-change-transform">
                            Kami menyediakan layanan pengiriman dan pergudangan yang aman, cepat, dan efisien ke seluruh Indonesia. Fokus pada ketepatan waktu dan keamanan barang.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-4">
                            <a href={`mailto:${env.VITE_CONTACT_EMAIL}`} className="hero-cta flex h-12 items-center justify-center rounded-lg bg-secondary px-8 text-base font-bold text-primary shadow-md shadow-secondary/20 transition-all hover:scale-105 hover:bg-[#ffe066] hover:shadow-xl hover:shadow-secondary/30 will-change-transform">
                                Hubungi Kami
                            </a>
                            <a 
                                href="#services" 
                                className="hero-cta flex h-12 items-center justify-center rounded-lg border-2 border-primary/20 bg-white/50 backdrop-blur-sm px-8 text-base font-bold text-primary transition-all hover:bg-primary/5 hover:border-primary will-change-transform"
                                onClick={(e) => {
                                    e.preventDefault();
                                    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
                                    window.history.replaceState(null, null, window.location.pathname + window.location.search);
                                }}
                            >
                                Pelajari Layanan
                            </a>
                        </div>

                        <div className="mt-8 flex gap-8 border-t border-primary/10 pt-8">
                            <div className="hero-stat will-change-transform">
                                <div className="text-3xl font-extrabold text-primary">150K+</div>
                                <div className="mt-1 text-sm font-medium text-neutral-dark/80">Pengiriman Sukses</div>
                            </div>
                            <div className="hero-stat will-change-transform">
                                <div className="text-3xl font-extrabold text-primary">50+</div>
                                <div className="mt-1 text-sm font-medium text-neutral-dark/80">Kota Tujuan</div>
                            </div>
                            <div className="hero-stat will-change-transform">
                                <div className="text-3xl font-extrabold text-primary">9<span className="text-xl">AM</span>-5<span className="text-xl">PM</span></div>
                                <div className="mt-1 text-sm font-medium text-neutral-dark/80">Senin - Sabtu</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column — Hero Image with Antigravity 3D Transforms */}
                    <div className="relative w-full lg:h-[600px] aspect-[4/3] lg:aspect-auto" style={{ perspective: '1200px' }}>
                        <div className="hero-image-container relative h-full w-full overflow-hidden rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] border border-white/50 bg-white will-change-transform" style={{ transformStyle: 'preserve-3d' }}>
                            <img
                                alt="Logistics truck operation"
                                className="h-full w-full object-cover object-[center_40%] transition-transform duration-[2000ms] hover:scale-110"
                                src="/1.webp"
                                loading="eager"
                                fetchPriority="high"
                                width="600"
                                height="600"
                                decoding="async"
                            />
                        </div>
                        
                        {/* Floating glassmorphic card with Z-axis depth */}
                        <div className="hero-floating-card absolute -bottom-6 -left-6 lg:-left-10 z-20 flex items-center gap-4 rounded-xl border border-white/40 bg-white/80 backdrop-blur-xl p-4 shadow-[0_30px_60px_rgba(0,0,0,0.12)] will-change-transform">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Icon name="local_shipping" size={24} />
                            </div>
                            <div>
                                <div className="font-bold text-primary">Pengiriman Cepat</div>
                                <div className="text-sm font-medium text-neutral-dark">Aman & Terlindungi</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
