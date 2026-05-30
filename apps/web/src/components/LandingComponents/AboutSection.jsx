import { useFadeInOnScroll } from '../../hooks/useFadeInOnScroll'
import Icon from '../Icon'

const features = [
    { icon: 'schedule', title: 'Tepat Waktu', desc: 'Jadwal pengiriman yang terencana dan disiplin.' },
    { icon: 'shield', title: 'Aman Terjamin', desc: 'Perlindungan asuransi dan tracking realtime.' },
    { icon: 'public', title: 'Jangkauan Luas', desc: 'Koneksi ke seluruh pelosok nusantara.' },
    { icon: 'support_agent', title: 'Support Responsif', desc: 'Tim support yang selalu siap membantu Anda.' },
]

export default function AboutSection() {
    const ref = useFadeInOnScroll()

    return (
        <section className="w-full bg-primary py-20 text-white" id="about">
            <div ref={ref} className="fade-in-section mx-auto max-w-[1200px] px-6 lg:px-8">
                <div className="flex flex-col gap-12 lg:flex-row lg:gap-20">
                    {/* Left Column */}
                    <div className="lg:w-1/2 flex flex-col justify-center">
                        <span className="mb-4 font-bold uppercase tracking-wider text-secondary">
                            Tentang Kami
                        </span>
                        <h2 className="mb-6 font-display text-4xl font-bold leading-tight sm:text-5xl">
                            Stabilitas &amp; Keamanan Adalah Prioritas Kami
                        </h2>
                        <p className="mb-8 text-lg leading-relaxed text-gray-200">
                            PT Mahkota Putra Logistik adalah mitra logistik yang mengutamakan stabilitas dan keamanan. Kami berdedikasi untuk memberikan layanan terbaik bagi pertumbuhan bisnis Anda melalui infrastruktur yang handal dan tim yang berpengalaman.
                        </p>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            {features.map((f) => (
                                <div key={f.icon} className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-secondary">
                                        <Icon name={f.icon} size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{f.title}</h3>
                                        <p className="text-sm text-gray-300 mt-1">{f.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column — Image */}
                    <div className="lg:w-1/2 relative">
                        <div className="relative h-full min-h-[400px] w-full overflow-hidden rounded-xl bg-gray-800">
                            <img
                                alt="Container shipping port"
                                className="h-full w-full object-cover opacity-80"
                                src="/2.JPG.jpeg"
                                loading="lazy"
                                width="600"
                                height="400"
                                decoding="async"
                            />
                            <div className="absolute bottom-8 left-8 right-8 rounded-lg bg-white/10 backdrop-blur-md p-6 border border-white/20">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 shrink-0 rounded-full bg-secondary flex items-center justify-center text-primary">
                                        <Icon name="star" size={24} />
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-lg">Layanan Premium</p>
                                        <p className="text-gray-300 text-sm">Standar internasional untuk setiap pengiriman.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
