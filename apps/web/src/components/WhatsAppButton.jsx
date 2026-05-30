import { env } from '../lib/env.js'

/**
 * Floating WhatsApp button — fixed bottom-right with margin.
 */
export default function WhatsAppButton() {
    // Don't render if no WhatsApp link is configured
    if (!env.VITE_WHATSAPP_LINK) return null

    return (
        <a
            href={env.VITE_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat WhatsApp"
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 hover:shadow-xl"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 32"
                className="h-7 w-7 fill-white"
            >
                <path d="M16.002 2.667A13.273 13.273 0 002.73 15.94a13.18 13.18 0 001.888 6.81L2.667 29.333l6.78-1.89a13.265 13.265 0 006.555 1.728h.006A13.277 13.277 0 0016.002 2.667zm0 24.31a11.02 11.02 0 01-5.62-1.536l-.404-.24-4.18 1.097 1.116-4.077-.263-.418a11.02 11.02 0 01-1.69-5.867A11.04 11.04 0 0116.002 4.91 11.04 11.04 0 0127.04 15.944 11.04 11.04 0 0116.002 26.977zm6.046-8.264c-.332-.166-1.963-.969-2.268-1.08-.305-.11-.527-.166-.749.166-.222.332-.86 1.08-1.054 1.302-.194.222-.389.249-.72.083-.332-.166-1.402-.517-2.67-1.648-.987-.88-1.653-1.966-1.847-2.298-.194-.332-.02-.512.146-.677.149-.149.332-.389.498-.583.166-.194.222-.332.332-.555.111-.222.056-.416-.028-.583-.083-.166-.749-1.805-1.027-2.47-.27-.648-.545-.56-.749-.57l-.638-.012a1.224 1.224 0 00-.887.416c-.305.332-1.164 1.137-1.164 2.773 0 1.636 1.192 3.217 1.358 3.439.166.222 2.346 3.582 5.685 5.023.794.343 1.414.548 1.897.701.797.253 1.523.217 2.096.132.639-.095 1.963-.803 2.24-1.578.277-.775.277-1.44.194-1.578-.083-.139-.305-.222-.638-.389z" />
            </svg>
        </a>
    )
}
