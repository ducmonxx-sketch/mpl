/**
 * Unified animation duration scale (ms), mirrors tailwind.config.js `transitionDuration`.
 * Use these instead of hardcoding new duration values in anime.js calls.
 */
export const MOTION = {
    fast: 150,       // micro-interactions
    base: 300,       // default UI transitions
    slow: 500,       // section-level reveals
    entrance: 420,   // staggered entrance timelines (hero/about/services/cta)
    crossfade: 1200, // deliberate slow crossfade (hero image carousel)
    // Timeline default duration for the hero/about/services/cta entrance
    // sequences, AND the unit every chained '-=' offset in those timelines
    // is expressed in terms of (e.g. `-=${MOTION.stagger}`). Always derive
    // offsets from this constant rather than hardcoding a number — a
    // mismatch between this value and a hardcoded offset desyncs the
    // overlap math and silently breaks later steps (e.g. the hero image
    // never fading in). Don't merge with `base`.
    stagger: 280,
}
