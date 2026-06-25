import { useEffect, useRef } from 'react'
import anime from 'animejs'
import Icon from '../Icon'

const features = [
    { icon: 'schedule', title: 'Tepat Waktu', desc: 'Jadwal pengiriman yang terencana dan disiplin untuk setiap kebutuhan bisnis Anda.' },
    { icon: 'shield', title: 'Aman Terjamin', desc: 'Perlindungan asuransi komprehensif dan tracking realtime 24/7.' },
    { icon: 'public', title: 'Jangkauan Luas', desc: 'Koneksi logistik ke seluruh pelosok nusantara dan mancanegara.' },
    { icon: 'support_agent', title: 'Support Responsif', desc: 'Tim support profesional yang selalu siap membantu Anda kapan saja.' },
]

export default function AboutSection() {
    const sectionRef = useRef(null)
    const animatedRef = useRef(false)

    useEffect(() => {
        // Set initial hidden states
        anime.set(['.about-label', '.about-heading', '.about-body'], { opacity: 0, translateY: 30 })
        anime.set('.about-feature-card', { opacity: 0, translateY: 40 })
        anime.set('.about-image-container', { opacity: 0, scale: 0.95, rotateX: 8, rotateY: 12 })
        anime.set('.about-floating-card', { opacity: 0, translateY: 60 })

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !animatedRef.current) {
                        animatedRef.current = true

                        const tl = anime.timeline({ easing: 'spring(1, 100, 14, 0)', duration: 500 })

                        tl.add({
                            targets: '.about-label',
                            opacity: [0, 1],
                            translateY: [20, 0],
                        })
                        .add({
                            targets: '.about-heading',
                            opacity: [0, 1],
                            translateY: [30, 0],
                        }, '-=400')
                        .add({
                            targets: '.about-body',
                            opacity: [0, 1],
                            translateY: [20, 0],
                        }, '-=400')
                        .add({
                            targets: '.about-feature-card',
                            opacity: [0, 1],
                            translateY: [40, 0],
                            delay: anime.stagger(40),
                        }, '-=350')
                        .add({
                            targets: '.about-image-container',
                            opacity: [0, 1],
                            scale: [0.95, 1],
                            rotateX: [8, 0],
                            rotateY: [12, 0],
                        }, '-=400')
                        .add({
                            targets: '.about-floating-card',
                            opacity: [0, 1],
                            translateY: [60, 0],
                        }, '-=400')
                    }
                })
            },
            { threshold: 0.15 }
        )

        if (sectionRef.current) observer.observe(sectionRef.current)
        return () => observer.disconnect()
    }, [])

    return (
        <section id="about" ref={sectionRef} className="relative w-full overflow-hidden bg-primary py-24">
            {/* Ambient mesh-gradient orbs */}
            <div className="absolute -right-40 top-0 h-96 w-96 rounded-full bg-secondary/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 bottom-0 h-[28rem] w-[28rem] rounded-full bg-white/5 blur-3xl pointer-events-none" />

            <div className="relative mx-auto max-w-[1200px] px-6 lg:px-8">
                <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-20">

                    {/* ── Left Column ── */}
                    <div className="lg:w-1/2 flex flex-col justify-center">
                        {/* Label */}
                        <span className="about-label mb-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary">
                            <span className="h-px w-8 bg-secondary inline-block" />
                            Tentang Kami
                        </span>

                        {/* Heading */}
                        <h2 className="about-heading mb-6 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
                            Stabilitas &amp; Keamanan Adalah Prioritas Kami
                        </h2>

                        {/* Body */}
                        <p className="about-body mb-10 text-lg leading-relaxed text-gray-300">
                            PT Mahkota Putra Logistik adalah mitra logistik yang mengutamakan stabilitas dan keamanan. Kami berdedikasi untuk memberikan layanan terbaik bagi pertumbuhan bisnis Anda melalui infrastruktur yang handal dan tim yang berpengalaman.
                        </p>

                        {/* Feature Cards — Glassmorphic 2×2 Grid */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {features.map((f) => (
                                <div
                                    key={f.icon}
                                    className="about-feature-card group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 cursor-default"
                                >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary transition-transform duration-300 group-hover:scale-110">
                                        <Icon name={f.icon} size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white">{f.title}</h3>
                                        <p className="mt-1 text-sm leading-relaxed text-gray-400">{f.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Right Column — Image ── */}
                    <div className="lg:w-1/2 relative flex items-center justify-center lg:justify-end" style={{ perspective: '1200px' }}>
                        <div className="about-image-container relative w-full max-w-[480px] aspect-square overflow-visible will-change-transform">
                            {/* Image card shell */}
                            <div className="relative h-full w-full overflow-hidden rounded-[2.5rem] shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
                                <img
                                    alt="Container shipping port PT Mahkota Putra Logistik"
                                    className="h-full w-full object-cover transition-transform duration-[2000ms] hover:scale-105"
                                    src="/2.webp"
                                    loading="lazy"
                                    width="600"
                                    height="600"
                                    decoding="async"
                                />
                                {/* Subtle overlay gradient for depth */}
                                <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent" />
                            </div>

                            {/* Antigravity Floating Card */}
                            <div
                                className="about-floating-card absolute -bottom-8 -left-8 w-64 rounded-2xl border border-white/20 bg-white/10 p-5 shadow-[0_40px_80px_rgba(0,0,0,0.4)] backdrop-blur-md will-change-transform z-10"
                                style={{ transform: 'translateZ(50px)' }}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary shadow-md">
                                        <Icon name="star" size={22} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">Layanan Premium</p>
                                        <p className="mt-0.5 text-xs leading-snug text-gray-300">Standar internasional untuk setiap pengiriman.</p>
                                    </div>
                                </div>
                                {/* Decorative gold progress bar */}
                                <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full w-3/4 rounded-full bg-secondary" />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    )
}
