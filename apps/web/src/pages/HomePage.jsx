import Header from '../components/LandingComponents/Header'
import HeroSection from '../components/LandingComponents/HeroSection'
import AboutSection from '../components/LandingComponents/AboutSection'
import ServicesSection from '../components/LandingComponents/ServicesSection'
import PartnersSection from '../components/LandingComponents/PartnersSection'
import CTASection from '../components/LandingComponents/CTASection'
import Footer from '../components/LandingComponents/Footer'
import CloudflareTurnstile from '../components/CloudflareTurnstile'

export default function HomePage() {
    return (
        <>
            <Header />
            <main className="flex min-h-screen w-full flex-col">
                <HeroSection />
                <AboutSection />
                <ServicesSection />
                <PartnersSection />
                <CTASection />
                <Footer />
            </main>
            <CloudflareTurnstile />
        </>
    )
}
