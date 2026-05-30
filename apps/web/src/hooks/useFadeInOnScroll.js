import { useEffect, useRef } from 'react'

/**
 * Custom hook that adds a fade-in/out animation when elements scroll into/out of view.
 * Sections fade in when scrolling down into view and fade out when scrolling back up.
 * Returns a ref to attach to the container element.
 */
export function useFadeInOnScroll() {
    const ref = useRef(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible')
                    observer.unobserve(entry.target)
                }
            },
            { threshold: 0.15 }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return ref
}

