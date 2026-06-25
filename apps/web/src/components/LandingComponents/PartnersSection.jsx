import { useFadeInOnScroll } from '../../hooks/useFadeInOnScroll'

const partners = [
    { name: 'Yamaha Motor', logo: '/logos/Yamaha_Logo.png' },
    { name: 'Honda Motor', logo: '/logos/Honda_Logo.svg.png' },
    { name: 'QJ Motor', logo: '/logos/QJ_Logo.png' },
    { name: 'Suzuki Motor', logo: '/logos/Suzuki_Logo.png' },
    { name: 'Yadea', logo: '/logos/Yadea_Logo.svg.png' },
    { name: 'Mitsubishi Motors', logo: '/logos/Mitsubishi_Logo.png' },
]

// Duplicate the array multiple times to ensure the track is long enough for a seamless infinite loop
const marqueeTrack = [...partners, ...partners, ...partners, ...partners]

export default function PartnersSection() {
    const ref = useFadeInOnScroll()

    return (
        <section className="w-full bg-white py-24 overflow-hidden" id="partners">
            <div ref={ref} className="fade-in-section mx-auto max-w-[1200px] px-6 lg:px-8">
                {/* Section Header */}
                <div className="mb-16 text-center max-w-2xl mx-auto">
                    <span className="mb-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary">
                        <span className="h-px w-8 bg-secondary inline-block" />
                        Mitra Kami
                        <span className="h-px w-8 bg-secondary inline-block" />
                    </span>
                    <h2 className="text-4xl font-display font-bold text-primary sm:text-5xl">
                        Dipercaya Oleh Brand Terkemuka
                    </h2>
                    <p className="mt-6 text-lg text-neutral-dark/75 leading-relaxed">
                        Kami bangga bermitra dengan perusahaan-perusahaan ternama dalam mendukung kebutuhan logistik mereka.
                    </p>
                </div>

                {/* Infinite Marquee Container */}
                <div className="relative mx-auto max-w-[1400px]">
                    {/* The masking creates the fade out at the left and right edges */}
                    <div className="marquee-mask flex overflow-hidden w-full">
                        {/* The scrolling track */}
                        <div className="animate-marquee flex w-max items-center gap-16 py-8 hover:cursor-grab active:cursor-grabbing">
                            {marqueeTrack.map((partner, index) => (
                                <div
                                    // Use index in key because we have duplicate items
                                    key={`${partner.name}-${index}`}
                                    className="group flex w-[200px] flex-col items-center justify-center gap-4 transition-all duration-300"
                                >
                                    {/* Logo Container */}
                                    <div className="flex h-20 w-full items-center justify-center p-4">
                                        <img
                                            src={partner.logo}
                                            alt={partner.name}
                                            // Grayscale by default, full color on hover
                                            className="max-h-full max-w-full object-contain grayscale opacity-40 transition-all duration-500 group-hover:scale-110 group-hover:grayscale-0 group-hover:opacity-100 drop-shadow-sm"
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </div>
                                    {/* Name Label */}
                                    <p className="text-sm font-semibold tracking-wide text-neutral-dark/40 transition-colors duration-500 group-hover:text-primary">
                                        {partner.name}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
