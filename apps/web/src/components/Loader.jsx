import Icon from './Icon'

const RING_PX = { xs: 18, sm: 28, md: 40, lg: 56, xl: 72 }
const ICON_PX = { xs: 0, sm: 14, md: 18, lg: 26, xl: 32 }
const RING_THICKNESS = { xs: '2px', sm: '3px', md: '3px', lg: '4px', xl: '4px' }

/**
 * Shared branded loading indicator — a masked conic-gradient ring (sweeps
 * primary → secondary → transparent) with an optional centered shipment icon.
 * Use `fullScreen` for route-level/page loads; otherwise it renders inline,
 * as a drop-in replacement for ad hoc `animate-spin` borders.
 */
export default function Loader({ size = 'md', label, fullScreen = false, className = '' }) {
    const ringPx = RING_PX[size] ?? RING_PX.md
    const iconPx = ICON_PX[size] ?? ICON_PX.md
    const thickness = RING_THICKNESS[size] ?? RING_THICKNESS.md

    const ring = (
        <div
            className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
            style={{ width: ringPx, height: ringPx }}
            role="status"
            aria-label={label || 'Memuat'}
        >
            <div
                className="absolute inset-0 animate-spin rounded-full"
                style={{
                    background:
                        'conic-gradient(from 0deg, transparent 0deg, var(--dash-secondary, #f2b824) 260deg, var(--dash-primary, #1b3b5f) 360deg)',
                    WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}), #000 calc(100% - ${thickness}))`,
                    mask: `radial-gradient(farthest-side, transparent calc(100% - ${thickness}), #000 calc(100% - ${thickness}))`,
                }}
            />
            {iconPx > 0 && (
                <Icon
                    name="local_shipping"
                    size={iconPx}
                    className="relative animate-pulse text-[var(--dash-primary,#1b3b5f)]"
                />
            )}
        </div>
    )

    if (!fullScreen) return ring

    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-background-light">
            {ring}
            <div className="flex flex-col items-center gap-3">
                <p
                    className="animate-loader-shimmer bg-[length:200%_100%] bg-clip-text text-sm font-semibold tracking-[0.2em] text-transparent"
                    style={{
                        backgroundImage:
                            'linear-gradient(90deg, var(--dash-primary, #1b3b5f) 0%, var(--dash-secondary, #f2b824) 50%, var(--dash-primary, #1b3b5f) 100%)',
                    }}
                >
                    {label || 'MEMUAT...'}
                </p>
                <div className="h-1 w-24 overflow-hidden rounded-full bg-primary/10">
                    <div className="h-full w-1/3 animate-loader-glide rounded-full bg-secondary" />
                </div>
            </div>
        </div>
    )
}
