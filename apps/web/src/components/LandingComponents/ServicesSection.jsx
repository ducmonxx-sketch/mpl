import { useFadeInOnScroll } from '../../hooks/useFadeInOnScroll'
import Icon from '../Icon'

const services = [
    {
        icon: 'local_shipping',
        title: 'Transportasi Darat',
        desc: 'Armada truk modern siap mengantar barang ke tujuan dengan aman dan efisien melalui rute darat terbaik.',
    },
    {
        icon: 'warehouse',
        title: 'Pergudangan',
        desc: 'Fasilitas gudang luas dengan sistem manajemen inventaris profesional untuk menjaga stok barang Anda.',
    },
    {
        icon: 'inventory_2',
        title: 'Distribusi Kargo',
        desc: 'Solusi distribusi kargo yang efisien untuk volume besar, menjamin kelancaran rantai pasok bisnis.',
    },
]

const bottomServices = [
    {
        icon: 'directions_boat',
        title: 'Kargo Laut',
        desc: 'Layanan pengiriman kontainer via laut yang hemat biaya untuk pengiriman barang dalam jumlah besar.',
    },
    {
        icon: 'local_post_office',
        title: 'Dokumen & Paket',
        desc: 'Layanan kurir khusus untuk pengiriman dokumen penting dan paket kecil dengan prioritas tinggi.',
    },
]

function ServiceCard({ icon, title, desc }) {
    return (
        <div className="group relative flex flex-col overflow-hidden rounded-xl bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md border border-gray-100 h-full">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                <Icon name={icon} size={36} />
            </div>
            <h3 className="mb-3 text-xl font-bold text-accent group-hover:text-primary">{title}</h3>
            <p className="text-[18px] leading-relaxed text-neutral-dark/80">{desc}</p>
        </div>
    )
}

export default function ServicesSection() {
    const ref = useFadeInOnScroll()

    return (
        <section className="w-full bg-background-light py-24" id="services">
            <div ref={ref} className="fade-in-section mx-auto max-w-[1200px] px-6 lg:px-8">
                {/* Section Header */}
                <div className="mb-16 text-center max-w-2xl mx-auto">
                    <span className="mb-2 block text-sm font-bold uppercase tracking-widest text-accent">
                        Layanan Kami
                    </span>
                    <h2 className="text-3xl font-bold text-primary sm:text-4xl">
                        Solusi Logistik Terintegrasi
                    </h2>
                    <p className="mt-4 text-lg text-neutral-dark/70">
                        Pilih layanan yang sesuai dengan kebutuhan bisnis Anda, mulai dari transportasi darat hingga manajemen gudang.
                    </p>
                </div>

                {/* Top Row — 3 cards */}
                <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {services.map((s) => (
                        <ServiceCard key={s.icon} {...s} />
                    ))}

                    {/* Missing container for 2x3 grid filler on tablet dimensions (e.g. iPad Mini 768x1024) */}
                    <div 
                        className="hidden md:flex lg:hidden relative overflow-hidden flex-col items-center justify-center p-8 rounded-xl shadow-md transition-all duration-500 hover:-translate-y-2 hover:shadow-xl border border-white/10 h-full group" 
                        style={{ backgroundColor: 'rgb(74, 109, 85)' }}
                    >
                        {/* Subtle Background Orbs for Depth */}
                        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-transform duration-700 group-hover:scale-150"></div>
                        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-secondary/20 blur-2xl transition-transform duration-700 group-hover:scale-150"></div>
                        
                        {/* Glassmorphic Icon Container */}
                        <div className="relative z-10 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-secondary shadow-inner transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                            <Icon name="workspace_premium" size={36} />
                        </div>

                        {/* Typography */}
                        <h3 className="relative z-10 text-[22px] font-bold text-white leading-relaxed text-center">
                            Layanan terbaik dengan harga paling <span className="text-secondary relative whitespace-nowrap">kompetitif<svg className="absolute -bottom-1 left-0 w-full h-2 text-secondary/40" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="2" fill="none"/></svg></span>
                        </h3>
                    </div>

                    {/* Bottom Row — 2 centered cards */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 flex justify-center w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full lg:w-2/3">
                            {bottomServices.map((s) => (
                                <ServiceCard key={s.icon} {...s} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
