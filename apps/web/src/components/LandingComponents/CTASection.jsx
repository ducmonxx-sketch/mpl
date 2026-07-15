import { useEffect, useRef } from 'react'
import anime from 'animejs'
import { env } from '../../lib/env.js'
import { Mail, MessageCircle } from 'lucide-react'

export default function CTASection() {
    const sectionRef = useRef(null)
    const animatedRef = useRef(false)

    useEffect(() => {
        // Initial hidden state for the container and its children
        anime.set('.cta-container', { opacity: 0, scale: 0.95, translateY: 40 })
        anime.set('.cta-item', { opacity: 0, translateX: -20 })
        anime.set('.cta-map', { opacity: 0, scale: 0.9 })

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !animatedRef.current) {
                        animatedRef.current = true

                        const tl = anime.timeline({ easing: 'spring(1, 120, 12, 0)', duration: 400 })

                        // Pop the glass container in
                        tl.add({
                            targets: '.cta-container',
                            opacity: [0, 1],
                            scale: [0.95, 1],
                            translateY: [40, 0],
                        })
                        // Stagger the text and buttons on the left
                        .add({
                            targets: '.cta-item',
                            opacity: [0, 1],
                            translateX: [-20, 0],
                            delay: anime.stagger(60),
                        }, '-=300')
                        // Pop the map in on the right
                        .add({
                            targets: '.cta-map',
                            opacity: [0, 1],
                            scale: [0.9, 1],
                        }, '-=400')
                    }
                })
            },
            { threshold: 0.2 }
        )

        if (sectionRef.current) observer.observe(sectionRef.current)
        return () => observer.disconnect()
    }, [])

    return (
        <section className="relative overflow-hidden bg-primary py-24 lg:py-32" id="contact" ref={sectionRef}>
            {/* SVG pattern background - PRESERVED */}
            <div
                className="absolute inset-0 z-0 opacity-[0.08]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
            ></div>

            {/* Ambient Base Glow behind the glass container */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-secondary/10 blur-[120px] pointer-events-none z-0"></div>

            <div className="relative z-10 mx-auto max-w-[1200px] px-6 lg:px-8">
                {/* Floating Glassmorphic Container */}
                <div className="cta-container relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 p-10 shadow-[0_30px_60px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-12 lg:p-16">
                    
                    {/* Inner highlight ring to give the glass thickness */}
                    <div className="absolute inset-0 rounded-[2.5rem] border border-white/5 pointer-events-none m-[1px]"></div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                        
                        {/* LEFT COLUMN: Text & Buttons */}
                        <div className="text-center lg:text-left">
                            <h2 className="cta-item font-display text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-[52px] tracking-tight">
                                Siap Mengoptimalkan Logistik Bisnis Anda?
                            </h2>
                            
                            <p className="cta-item mt-6 text-lg text-white/70 leading-relaxed max-w-xl mx-auto lg:mx-0">
                                Hubungi tim ahli kami untuk mendapatkan penawaran terbaik dan konsultasi gratis mengenai kebutuhan pengiriman Anda.
                            </p>
                            
                            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                                {/* Primary CTA */}
                                <a 
                                    href={env.VITE_WHATSAPP_LINK}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="cta-item group relative flex h-14 w-full sm:w-auto min-w-[220px] items-center justify-center gap-3 overflow-hidden rounded-xl bg-secondary px-6 text-base font-bold text-primary shadow-[0_0_40px_rgba(255,204,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(255,204,0,0.4)]"
                                >
                                    <MessageCircle size={20} strokeWidth={2.5} className="transition-transform duration-300 group-hover:scale-110" />
                                    <span>Chat WhatsApp</span>
                                    {/* Shiny sweep effect */}
                                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-[800ms] group-hover:translate-x-full"></div>
                                </a>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Google Maps Embed */}
                        <div className="cta-map relative w-full h-[350px] lg:h-[450px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl group bg-white/5">
                            {/* Grayscale filter applied to iframe, removed on hover */}
                            <iframe 
                                src="https://maps.google.com/maps?q=PT%20Mahkota%20Putra%20Logistik&t=&z=15&ie=UTF8&iwloc=&output=embed" 
                                className="w-full h-full border-0 grayscale-[40%] opacity-80 transition-all duration-500 group-hover:grayscale-0 group-hover:opacity-100"
                                allowFullScreen="" 
                                loading="lazy" 
                                referrerPolicy="no-referrer-when-downgrade"
                                title="Map location for PT Mahkota Putra Logistik"
                            ></iframe>
                        </div>

                    </div>
                </div>
            </div>
        </section>
    )
}
