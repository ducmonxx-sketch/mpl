import Icon from './Icon'

export default function PageLoader() {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background-light">
            <div className="relative flex items-center justify-center">
                {/* Outer spinning ring */}
                <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
                {/* Inner icon */}
                <Icon name="local_shipping" size={28} className="text-secondary animate-pulse" />
            </div>
            <p className="mt-6 text-sm font-semibold tracking-wider text-primary/70 animate-pulse">
                MEMUAT...
            </p>
        </div>
    )
}
