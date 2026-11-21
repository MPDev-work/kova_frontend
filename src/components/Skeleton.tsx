import { useState } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`kova-skeleton rounded-[10px] ${className}`}
    />
  );
}

export function SkeletonImage({
  src,
  alt,
  className = '',
  wrapperClassName = '',
}: {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${wrapperClassName}`}
    >
      {!loaded && (
        <div
          aria-hidden="true"
          className="kova-skeleton absolute inset-0 w-full h-full"
        />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`${className} transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}

export function HomeBannerDeckSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2.5 xl:h-[460px]">
      <Skeleton className="w-full h-[220px] sm:h-[280px] xl:h-[314px] rounded-[20px]" />
      <div className="grid grid-cols-3 gap-2.5 h-[110px] sm:h-[136px]">
        <Skeleton className="w-full h-full rounded-[16px]" />
        <Skeleton className="w-full h-full rounded-[16px]" />
        <Skeleton className="w-full h-full rounded-[16px]" />
      </div>
    </div>
  );
}

export function ProfilePillSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-[#f7f7f7] border border-[#ececec] h-[46px] pl-[5px] pr-[5px] rounded-full flex items-center justify-between gap-3 w-[196px]"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Skeleton className="w-[36px] h-[36px] rounded-full shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-2.5 w-12 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-[36px] w-[46px] rounded-full shrink-0" />
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-white border border-[#ececec] rounded-[18px] p-2.5 flex flex-col gap-2.5"
    >
      <Skeleton className="w-full aspect-square rounded-[14px]" />
      <div className="flex flex-col gap-1.5 px-0.5">
        <Skeleton className="h-3.5 w-[92%] rounded-full" />
        <Skeleton className="h-3.5 w-[68%] rounded-full" />
        <div className="flex items-center gap-2 pt-0.5">
          <Skeleton className="h-4 w-12 rounded-full" />
          <Skeleton className="h-3 w-16 rounded-full" />
        </div>
        <div className="flex items-baseline gap-2 pt-1">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3 w-12 rounded-full" />
        </div>
        <Skeleton className="h-3 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({
  count = 10,
  columnsClass = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
}: {
  count?: number;
  columnsClass?: string;
}) {
  return (
    <div className={`grid ${columnsClass} gap-2.5`}>
      {Array.from({ length: count }).map((_, idx) => (
        <ProductCardSkeleton key={idx} />
      ))}
    </div>
  );
}

export function HomeCategoryListSkeleton() {
  const widths = [
    'w-28',
    'w-36',
    'w-24',
    'w-32',
    'w-28',
    'w-36',
    'w-24',
    'w-32',
    'w-28',
    'w-20',
  ];
  return (
    <div aria-hidden="true" className="flex flex-col gap-2.5 flex-1 pt-1">
      {widths.map((w, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-3 py-0.5"
        >
          <Skeleton className={`h-3.5 ${w} rounded-full`} />
          <Skeleton className="h-3 w-3 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function HomeUserHubSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 flex-1">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-[46px] h-[46px] rounded-full shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-3 w-36 rounded-full" />
        </div>
      </div>

      <div className="bg-[#f7f7f7] rounded-[14px] px-3 py-3 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-5 w-7 rounded-full" />
            <Skeleton className="h-2.5 w-11 rounded-full" />
          </div>
        ))}
      </div>

      <Skeleton className="h-[108px] w-full rounded-[14px]" />

      <div className="flex flex-col gap-2 mt-auto">
        <Skeleton className="h-3.5 w-24 rounded-full" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1.5">
              <Skeleton className="w-full h-[74px] rounded-[12px]" />
              <Skeleton className="h-3 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StoreCardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white border border-[#ececec] rounded-[24px] p-2.5 pb-3 flex flex-col gap-2.5"
        >
          <Skeleton className="h-[150px] w-full rounded-[14px]" />
          <div className="flex items-center justify-between gap-2 px-0.5">
            <Skeleton className="h-4 w-36 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VerifiedStoreShowcaseSkeleton({
  count = 2,
}: {
  count?: number;
}) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6 pt-1">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="flex flex-col gap-[11px]">
          <Skeleton className="w-full h-[240px] sm:h-[320px] lg:h-[360px] rounded-[34px]" />
          <ProductGridSkeleton count={5} />
        </div>
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="kova-container px-4 lg:px-6 pt-5 pb-12 flex flex-col gap-6"
    >
      <Skeleton className="h-3.5 w-52 rounded-full" />
      <div className="bg-white border border-[#ececec] rounded-[20px] px-5 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-full shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-36 rounded-full" />
            <Skeleton className="h-3 w-24 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] gap-7 items-start">
        <div className="flex flex-col gap-3">
          <Skeleton className="w-full aspect-square rounded-[24px]" />
          <div className="grid grid-cols-5 gap-2.5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="aspect-square rounded-[14px]" />
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#ececec] rounded-[24px] p-6 sm:p-7 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-8 w-[88%] rounded-full" />
            <Skeleton className="h-8 w-[60%] rounded-full" />
          </div>
          <div className="flex items-baseline gap-3">
            <Skeleton className="h-9 w-36 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full rounded-[16px]" />
          <div className="flex gap-2.5">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Skeleton className="h-12 w-full rounded-full" />
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function StorefrontSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="kova-container px-2.5 lg:px-[10px] pt-[14px] pb-10 flex flex-col gap-4"
    >
      <div className="bg-white border border-[#ececec] rounded-[22px] p-3.5 pb-5 flex flex-col gap-4">
        <Skeleton className="w-full h-[200px] sm:h-[260px] rounded-[16px]" />
        <div className="flex flex-wrap items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-3.5">
            <Skeleton className="w-16 h-16 rounded-full shrink-0" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-48 rounded-full" />
              <Skeleton className="h-3.5 w-64 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>
      <ProductGridSkeleton count={10} />
    </div>
  );
}

export function CartSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="kova-container px-4 lg:px-6 pt-5 pb-12 flex flex-col gap-5"
    >
      <Skeleton className="h-3.5 w-36 rounded-full" />
      <Skeleton className="h-9 w-56 rounded-full" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white border border-[#ececec] rounded-[20px] p-5 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#ececec]">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-9 h-9 rounded-full" />
                  <Skeleton className="h-4 w-36 rounded-full" />
                </div>
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="w-20 h-20 rounded-[14px] shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4 w-[70%] rounded-full" />
                  <Skeleton className="h-3.5 w-28 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-9 w-24 rounded-full shrink-0" />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-[#ececec] rounded-[20px] p-6 flex flex-col gap-4">
          <Skeleton className="h-6 w-36 rounded-full" />
          <Skeleton className="h-11 w-full rounded-full" />
          <div className="flex flex-col gap-2.5 pt-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-full mt-2" />
        </div>
      </div>
    </div>
  );
}

export function NotificationsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-[16px] p-4 flex items-start gap-3.5 bg-[#f7f7f7]"
        >
          <Skeleton className="w-9 h-9 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-48 rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-[75%] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CustomerSettingsSkeleton() {
  return (
    <div aria-hidden="true" className="min-h-screen w-full bg-[#f7f7f7] flex">
      {/* Left Sidebar Skeleton */}
      <aside className="hidden lg:flex w-[260px] px-[14px] py-[16px] bg-white border-r border-[#ececec] flex-col justify-between shrink-0 h-screen sticky top-0">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>

          <div className="bg-[#f7f7f7] border border-[#ececec] rounded-[14px] p-2.5 flex items-center gap-2.5">
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28 rounded-full" />
              <Skeleton className="h-2.5 w-36 rounded-full" />
            </div>
          </div>

          {Array.from({ length: 3 }).map((_, groupIdx) => (
            <div key={groupIdx} className="flex flex-col gap-2 pt-1">
              <Skeleton className="h-2.5 w-20 rounded-full mx-2" />
              {Array.from({ length: 3 }).map((_, itemIdx) => (
                <div
                  key={itemIdx}
                  className="flex items-center gap-2.5 px-2.5 py-2"
                >
                  <Skeleton className="w-4 h-4 rounded-md shrink-0" />
                  <Skeleton className="h-3.5 w-28 rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>

        <Skeleton className="h-[88px] w-full rounded-[12px]" />
      </aside>

      {/* Right Workspace Skeleton */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="h-[68px] bg-white border-b border-[#ececec] px-4 lg:px-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-[10px]" />
            <Skeleton className="h-4 w-56 rounded-full" />
          </div>
          <Skeleton className="hidden md:block h-[38px] w-[280px] rounded-full" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="hidden sm:block h-9 w-36 rounded-full" />
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1220px] px-4 lg:px-[26px] pt-[22px] pb-[36px] flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-64 rounded-full" />
              <Skeleton className="h-3.5 w-80 rounded-full" />
            </div>
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>

          <div className="bg-white border border-[#ececec] rounded-[16px] p-6 max-w-[820px] flex flex-col gap-5">
            <div className="flex items-center justify-between pb-4 border-b border-[#ececec]">
              <div className="flex items-center gap-3.5">
                <Skeleton className="w-14 h-14 rounded-full shrink-0" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-40 rounded-full" />
                  <Skeleton className="h-3.5 w-52 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>

            <Skeleton className="h-4 w-40 rounded-full" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-10 w-full rounded-[12px]" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="h-10 w-full rounded-[12px]" />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-2">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="h-10 w-full rounded-[12px]" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function DashboardKpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white border border-[#ececec] rounded-[16px] p-5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-28 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-3 w-36 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DashboardTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      aria-hidden="true"
      className="bg-white border border-[#ececec] rounded-[16px] p-5 flex flex-col gap-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-44 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <Skeleton className="h-9 w-full rounded-[10px]" />
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-4 py-2 border-b border-[#ececec] last:border-b-0"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Skeleton className="w-9 h-9 rounded-[10px] shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-3.5 w-44 rounded-full" />
              <Skeleton className="h-2.5 w-28 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-4 w-20 rounded-full hidden sm:block" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
