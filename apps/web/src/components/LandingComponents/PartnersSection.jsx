import { useFadeInOnScroll } from '../../hooks/useFadeInOnScroll'

const partners = [
    { name: 'Yamaha Motor', logo: '/logos/Yamaha_Logo.png' },
    { name: 'Honda Motor', logo: '/logos/Honda_Logo.svg.png' },
    { name: 'QJ Motor', logo: '/logos/QJ_Logo.png' },
    { name: 'Suzuki Motor', logo: '/logos/Suzuki_Logo.png' },
    { name: 'Yadea', logo: '/logos/Yadea_Logo.svg.png' },
    { name: 'Mitsubishi Motors', logo: '/logos/Mitsubishi_Logo.png' },
]

export default function PartnersSection() {
    const ref = useFadeInOnScroll()

    return (
        <section className="w-full bg-white py-24" id="partners">
            <div ref={ref} className="fade-in-section mx-auto max-w-[1200px] px-6 lg:px-8">
                {/* Section Header */}
                <div className="mb-16 text-center max-w-2xl mx-auto">
                    <span className="mb-2 block text-sm font-bold uppercase tracking-widest text-accent">
                        Mitra Kami
                    </span>
                    <h2 className="text-3xl font-bold text-primary sm:text-4xl">
                        Dipercaya Oleh Brand Terkemuka
                    </h2>
                    <p className="mt-4 text-lg text-neutral-dark/70">
                        Kami bangga bermitra dengan perusahaan-perusahaan ternama dalam mendukung kebutuhan logistik mereka.
                    </p>
                </div>

                {/* Logo Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 items-center">
                    {partners.map(({ name, logo }) => (
                        <div
                            key={name}
                            className="group flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-background-light p-6 transition-all hover:shadow-md hover:-translate-y-1 hover:border-primary/20 min-h-[140px]"
                        >
                            <div className="grayscale opacity-60 transition-all group-hover:grayscale-0 group-hover:opacity-100 flex items-center justify-center h-14">
                                <img
                                    src={logo}
                                    alt={name}
                                    className="max-h-14 max-w-full w-auto object-contain"
                                    loading="lazy"
                                    width="120"
                                    height="56"
                                    decoding="async"
                                />
                            </div>
                            <p className="mt-3 text-xs font-medium text-gray-500 group-hover:text-primary transition-colors text-center">
                                {name}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
