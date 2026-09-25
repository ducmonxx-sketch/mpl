/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                "primary": "#1b3b5f",
                "secondary": "#f2b824",
                "accent": "#4a6d55",
                "neutral-dark": "#333333",
                "background-light": "#f8f9fa",
                "background-dark": "#13191f",
                "footer-bg": "#152332",
                "dash-primary": "var(--dash-primary)",
                "dash-secondary": "var(--dash-secondary)",
                "dash-accent": "var(--dash-accent)",
                "dash-error": "var(--dash-error)",
                "dash-tertiary-light": "var(--dash-tertiary-light)",
            },
            fontFamily: {
                "display": ["Work Sans", "sans-serif"],
                "body": ["Noto Sans", "sans-serif"],
            },
            borderRadius: {
                DEFAULT: "0.25rem",
                lg: "0.5rem",
                xl: "0.75rem",
            },
            transitionDuration: {
                // Unified motion scale — use these instead of ad hoc duration-XXX values.
                fast: "150ms",   // micro-interactions: icon/color hover
                base: "300ms",   // default UI transitions (most hover states)
                slow: "500ms",   // section-level reveals, overlay fades
                zoom: "2000ms",  // deliberate slow photo hover-zoom (hero/about images)
            },
            keyframes: {
                "loader-glide": {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(300%)" },
                },
                "loader-shimmer": {
                    "0%": { backgroundPosition: "200% 0" },
                    "100%": { backgroundPosition: "-200% 0" },
                },
            },
            animation: {
                "loader-glide": "loader-glide 1.6s cubic-bezier(0.65,0,0.35,1) infinite",
                "loader-shimmer": "loader-shimmer 2.5s linear infinite",
            },
        },
    },
    plugins: [],
}
