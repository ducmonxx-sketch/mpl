// Shimmer placeholders shaped like the content they stand in for, so a loading
// dashboard reads as "this is what's coming" instead of a blank spinner.

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200/70 rounded-lg ${className}`} />
}

export function KPISkeletonRow({ count = 4, hero = true }) {
  return (
    <div className={`grid grid-cols-2 gap-4 md:gap-6 ${hero ? 'lg:grid-cols-[1.35fr_1fr_1fr_1fr]' : 'lg:grid-cols-4'}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`rounded-2xl p-6 flex flex-col justify-between gap-4 ${hero && i === 0 ? 'bg-gray-100' : 'bg-white border border-gray-200'}`}
        >
          <div className="flex justify-between items-start">
            <Skeleton className="w-10 h-10 rounded-xl" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ListSkeletonRows({ count = 4 }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3.5 border-b border-gray-100 last:border-0">
          <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function CardListSkeleton({ count = 3 }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
            <Skeleton className="h-6 w-24 rounded-full flex-shrink-0" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}
