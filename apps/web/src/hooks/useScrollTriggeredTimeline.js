import { useEffect, useRef } from 'react'

/**
 * Runs an anime.js timeline once, the first time the returned ref scrolls into view.
 * Consolidates the IntersectionObserver + "run once" pattern previously duplicated
 * across AboutSection, ServicesSection, and CTASection.
 *
 * @param {() => void} buildAndPlay - creates and plays the anime.js timeline
 * @param {{ threshold?: number }} [options]
 */
export function useScrollTriggeredTimeline(buildAndPlay, { threshold = 0.15 } = {}) {
    const sectionRef = useRef(null)
    const hasAnimatedRef = useRef(false)
    const buildAndPlayRef = useRef(buildAndPlay)
    buildAndPlayRef.current = buildAndPlay

    useEffect(() => {
        const el = sectionRef.current
        if (!el) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !hasAnimatedRef.current) {
                        hasAnimatedRef.current = true
                        buildAndPlayRef.current()
                    }
                })
            },
            { threshold }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [threshold])

    return sectionRef
}
