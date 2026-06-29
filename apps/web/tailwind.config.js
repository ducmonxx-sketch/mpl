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
        },
    },
    plugins: [],
}
