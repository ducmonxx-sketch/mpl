import { useEffect, useRef } from 'react'
import anime from 'animejs'
import { Truck, Warehouse, Package, Ship, FileText, Award } from 'lucide-react'

const services = [
    {
        icon: Truck,
        title: 'Transportasi Darat',
        desc: 'Armada truk modern siap mengantar barang ke tujuan dengan aman dan efisien melalui rute darat terbaik.',
    },
    {
        icon: Warehouse,
        title: 'Pergudangan',
        desc: 'Fasilitas gudang luas dengan sistem manajemen inventaris profesional untuk menjaga stok barang Anda.',
    },
    {
        icon: Package,
        title: 'Distribusi Kargo',
        desc: 'Solusi distribusi kargo yang efisien untuk volume besar, menjamin kelancaran rantai pasok bisnis.',
    },
]

const bottomServices = [
    {
        icon: Ship,
        title: 'Kargo Laut',
        desc: 'Layanan pengiriman kontainer via laut yang hemat biaya untuk pengiriman barang dalam jumlah besar.',
    },
    {
        icon: FileText,
        title: 'Dokumen & Paket',
        desc: 'Layanan kurir khusus untuk pengiriman dokumen penting dan paket kecil dengan prioritas tinggi.',
    },
]

function ServiceCard({ icon: IconComponent, title, desc }) {
    return (
        <div className="services-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/60 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(27,59,95,0.08)]">
            {/* Subtle hover gradient sweep */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            
            <div className="relative z-10 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 text-primary transition-all duration-500 group-hover:scale-110 group-hover:bg-primary group-hover:text-secondary group-hover:shadow-md">
                <IconComponent size={32} strokeWidth={1.5} />
            </div>
            
            <h3 className="relative z-10 mb-3 text-xl font-bold text-primary transition-colors">{title}</h3>
            <p className="relative z-10 text-[17px] leading-relaxed text-neutral-dark/75">{desc}</p>
        </div>
    )
}

export default function ServicesSection() {
    const sectionRef = useRef(null)
    const animatedRef = useRef(false)

    useEffect(() => {
        // Initial hidden state
        anime.set('.services-header-elem', { opacity: 0, translateY: 20 })
        anime.set('.services-card', { opacity: 0, translateY: 40 })

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !animatedRef.current) {
                        animatedRef.current = true

                        const tl = anime.timeline({ easing: 'spring(1, 120, 12, 0)', duration: 400 })

                        tl.add({
                            targets: '.services-header-elem',
                            opacity: [0, 1],
                            translateY: [20, 0],
                            delay: anime.stagger(50),
                        })
                        .add({
                            targets: '.services-card',
                            opacity: [0, 1],
                            translateY: [40, 0],
                            delay: anime.stagger(60),
                        }, '-=400')
                    }
                })
            },
            { threshold: 0.1 }
        )

        if (sectionRef.current) observer.observe(sectionRef.current)
        return () => observer.disconnect()
    }, [])

    return (
        <section className="relative w-full overflow-hidden bg-background-light py-24" id="services" ref={sectionRef}>
            {/* Ambient Background Orbs */}
            <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-secondary/10 blur-[100px] pointer-events-none" />
            <div className="absolute -right-20 bottom-0 h-[30rem] w-[30rem] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

            <div className="relative z-10 mx-auto max-w-[1200px] px-6 lg:px-8">
                {/* Section Header */}
                <div className="mb-16 text-center max-w-2xl mx-auto">
                    <span className="services-header-elem mb-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary">
                        <span className="h-px w-8 bg-secondary inline-block" />
                        Layanan Kami
                        <span className="h-px w-8 bg-secondary inline-block" />
                    </span>
                    <h2 className="services-header-elem text-4xl font-display font-bold text-primary sm:text-5xl">
                        Solusi Logistik Terintegrasi
                    </h2>
                    <p className="services-header-elem mt-6 text-lg text-neutral-dark/75 leading-relaxed">
                        Pilih layanan yang sesuai dengan kebutuhan bisnis Anda, mulai dari transportasi darat hingga manajemen gudang berstandar internasional.
                    </p>
                </div>

                {/* Top Row — 3 cards */}
                <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {services.map((s) => (
                        <ServiceCard key={s.title} {...s} />
                    ))}

                    {/* Tablet Filler Card */}
                    <div 
                        className="services-card hidden md:flex lg:hidden relative overflow-hidden flex-col items-center justify-center p-8 rounded-2xl shadow-md transition-all duration-500 hover:-translate-y-2 hover:shadow-xl border border-primary/20 h-full group bg-primary"
                    >
                        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 blur-2xl transition-transform duration-700 group-hover:scale-150"></div>
                        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-secondary/10 blur-2xl transition-transform duration-700 group-hover:scale-150"></div>
                        
                        <div className="relative z-10 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-secondary shadow-inner transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                            <Award size={36} strokeWidth={1.5} />
                        </div>

                        <h3 className="relative z-10 text-[22px] font-bold text-white leading-relaxed text-center">
                            Layanan premium dengan standar <span className="text-secondary relative whitespace-nowrap">internasional<svg className="absolute -bottom-1 left-0 w-full h-2 text-secondary/40" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="2" fill="none"/></svg></span>
                        </h3>
                    </div>

                    {/* Bottom Row — 2 centered cards */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 flex justify-center w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full lg:w-2/3">
                            {bottomServices.map((s) => (
                                <ServiceCard key={s.title} {...s} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
