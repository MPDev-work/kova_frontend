import { useState } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`kova-skeleton rounded-[14px] ${className}`}
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
      <Skeleton className="w-full h-[220px] sm:h-[280px] xl:h-[314px] rounded-[24px]" />
      <div className="grid grid-cols-3 gap-2.5 h-[110px] sm:h-[136px]">
        <Skeleton className="w-full h-full rounded-[24px]" />
        <Skeleton className="w-full h-full rounded-[24px]" />
        <Skeleton className="w-full h-full rounded-[24px]" />
      </div>
    </div>
  );
}

export function ProfilePillSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-[#f7f7f7] border border-[#ececec] h-[46px] pl-[5px] pr-[5px] rounded-full flex items-center justify-between gap-3 w-[196px] max-w-full"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Skeleton className="w-[36px] h-[36px] rounded-full shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <Skeleton className="h-3 w-20 max-w-full rounded-full" />
          <Skeleton className="h-2.5 w-12 max-w-full rounded-full" />
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
      className="bg-white border border-[#ececec] p-2.5 flex flex-col gap-2.5 rounded-[24px] min-w-0 overflow-hidden"
    >
      <Skeleton className="w-full aspect-square rounded-[14px]" />
      <div className="flex flex-col gap-1.5 px-0.5 min-w-0">
        <Skeleton className="h-3.5 w-[92%] rounded-full" />
        <Skeleton className="h-3.5 w-[68%] rounded-full" />
        <div className="flex items-center gap-2 pt-0.5 min-w-0">
          <Skeleton className="h-4 w-12 max-w-[45%] rounded-full" />
          <Skeleton className="h-3 w-16 max-w-[45%] rounded-full" />
        </div>
        <div className="flex items-baseline gap-2 pt-1 min-w-0">
          <Skeleton className="h-5 w-20 max-w-[60%] rounded-full" />
          <Skeleton className="h-3 w-12 max-w-[35%] rounded-full" />
        </div>
        <Skeleton className="h-3 w-24 max-w-[80%] rounded-full" />
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
    'w-24',
    'w-32',
    'w-20',
    'w-28',
    'w-24',
    'w-32',
    'w-20',
    'w-28',
    'w-24',
    'w-20',
  ];
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-1 content-start gap-x-3 gap-y-2 flex-1 pt-1"
    >
      {widths.map((w, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-2 px-1 py-1"
        >
          <Skeleton className={`h-3.5 ${w} max-w-[80%] rounded-full`} />
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
        <Skeleton className="h-4 w-32 rounded-full" />
      </div>

      <div className="bg-[#f7f7f7] px-2 py-2.5 grid grid-cols-4 gap-2 rounded-[14px]">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-5 w-7 rounded-full" />
            <Skeleton className="h-2.5 w-11 rounded-full" />
          </div>
        ))}
      </div>

      <Skeleton className="h-[104px] w-full rounded-[14px]" />

      <div className="flex flex-col gap-2 mt-auto">
        <Skeleton className="h-3.5 w-24 rounded-full" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1.5">
              <Skeleton className="w-full h-[74px] rounded-[14px]" />
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
    <div
      aria-hidden="true"
      className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-2.5 px-2.5 lg:mx-0 lg:px-0"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="w-[275px] sm:w-[320px] lg:w-[calc((100%-24px)/3)] shrink-0 bg-white border border-[#ececec] p-2.5 pb-3 flex flex-col gap-2.5 rounded-[24px]"
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

export function StoreTagCardSkeleton({
  variant = 'card',
}: {
  variant?: 'overlay' | 'card';
}) {
  const wrapperClass =
    variant === 'overlay'
      ? 'relative sm:absolute sm:left-[10px] sm:right-[10px] sm:bottom-[10px] w-full sm:w-auto sm:max-w-[920px] sm:rounded-[24px] bg-white sm:backdrop-blur-[18px] sm:bg-white/88 sm:shadow-[0_6px_28px_rgba(0,0,0,0.18)] p-2.5'
      : 'w-full rounded-[24px] bg-white border border-[#ececec] shadow-[0_2px_14px_rgba(0,0,0,0.03)] p-2.5';

  return (
    <div aria-hidden="true" className={wrapperClass}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <Skeleton className="w-[62px] h-[62px] sm:w-[100px] sm:h-[100px] rounded-[14px] shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Skeleton className="h-5 sm:h-6 w-32 sm:w-44 max-w-full rounded-full" />
              <Skeleton className="w-4 h-4 rounded-full shrink-0" />
            </div>
            <Skeleton className="h-3 w-24 sm:w-28 max-w-full rounded-full" />
            <Skeleton className="h-3 w-36 sm:w-40 max-w-full rounded-full" />
            <Skeleton className="h-3 w-48 sm:w-52 max-w-full rounded-full" />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-[36px] sm:h-[38px] flex-1 sm:flex-none sm:w-[104px] rounded-full" />
          <Skeleton className="w-[36px] h-[36px] sm:w-[38px] sm:h-[38px] rounded-full shrink-0" />
          <Skeleton className="w-[36px] h-[36px] sm:w-[38px] sm:h-[38px] rounded-full shrink-0" />
        </div>
      </div>
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
          <div className="relative w-full overflow-hidden bg-white border border-[#ececec] sm:border-0 sm:h-[340px] lg:h-[400px] rounded-[24px] sm:rounded-[34px]">
            <Skeleton className="w-full h-[155px] sm:h-full rounded-none" />
            <StoreTagCardSkeleton variant="overlay" />
          </div>
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
      className="kova-container px-2.5 lg:px-6 pt-4 pb-12 flex flex-col gap-4 sm:gap-5 overflow-x-hidden"
    >
      <Skeleton className="h-3.5 w-44 sm:w-52 max-w-full rounded-full" />
      <div className="bg-white border border-[#ececec] p-2 sm:px-3 sm:py-2 flex items-center justify-between gap-2.5 sm:gap-3 rounded-full min-w-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <Skeleton className="w-10 h-10 sm:w-11 sm:h-11 rounded-full shrink-0" />
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <Skeleton className="h-4 w-32 sm:w-36 max-w-full rounded-full" />
            <Skeleton className="h-3 w-20 sm:w-24 max-w-full rounded-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 sm:w-28 rounded-full shrink-0" />
      </div>

      <div className="bg-white border border-[#ececec] rounded-[24px] p-2.5 grid grid-cols-1 lg:grid-cols-[430px_minmax(0,1fr)] gap-4 lg:gap-[22px] items-start">
        <div className="flex flex-col gap-2.5 min-w-0">
          <Skeleton className="w-full aspect-square lg:aspect-auto lg:h-[420px] rounded-[14px]" />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton
                key={idx}
                className="w-full aspect-square rounded-[10px] sm:rounded-[14px]"
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 p-1 min-w-0">
          <div className="flex flex-col gap-2 min-w-0">
            <Skeleton className="h-4 w-28 max-w-full rounded-full" />
            <Skeleton className="h-7 sm:h-8 w-[88%] rounded-full" />
            <Skeleton className="h-7 sm:h-8 w-[60%] rounded-full" />
          </div>
          <div className="flex items-baseline gap-3 min-w-0">
            <Skeleton className="h-8 sm:h-9 w-32 sm:w-36 max-w-[60%] rounded-full" />
            <Skeleton className="h-5 w-20 sm:w-24 max-w-[35%] rounded-full" />
          </div>
          <Skeleton className="h-24 w-full rounded-[14px]" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-20 sm:w-24 rounded-full" />
            <Skeleton className="h-9 w-20 sm:w-24 rounded-full" />
            <Skeleton className="h-9 w-20 sm:w-24 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Skeleton className="h-11 sm:h-12 w-full rounded-full" />
            <Skeleton className="h-11 sm:h-12 w-full rounded-full" />
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
      className="kova-container px-2.5 lg:px-[10px] pt-[14px] pb-10 flex flex-col gap-4 overflow-x-hidden"
    >
      <div className="bg-white border border-[#ececec] px-2.5 pt-2.5 pb-4 flex flex-col gap-3 rounded-[24px]">
        <Skeleton className="w-full h-[160px] sm:h-[280px] rounded-[14px]" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-full shrink-0" />
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              <Skeleton className="h-5 sm:h-6 w-36 sm:w-44 max-w-full rounded-full" />
              <Skeleton className="h-3.5 w-48 sm:w-60 max-w-full rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Skeleton className="h-9 flex-1 sm:flex-none sm:w-24 rounded-full" />
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <Skeleton className="h-9 flex-1 sm:flex-none sm:w-24 rounded-full" />
          </div>
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
      className="kova-container px-2.5 lg:px-6 pt-4 pb-12 flex flex-col gap-4 overflow-x-hidden"
    >
      <Skeleton className="h-3.5 w-36 max-w-full rounded-full" />
      <Skeleton className="h-8 w-44 sm:w-52 max-w-full rounded-full" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-6 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 rounded-[24px] min-w-0"
            >
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#ececec] min-w-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-32 sm:w-36 max-w-full rounded-full" />
                </div>
                <Skeleton className="h-4 w-16 sm:w-20 rounded-full shrink-0" />
              </div>
              <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <Skeleton className="w-[22px] h-[22px] rounded-full shrink-0" />
                  <Skeleton className="w-[84px] h-[84px] sm:w-24 sm:h-24 rounded-[14px] shrink-0" />
                </div>
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <Skeleton className="h-4 w-[85%] rounded-full" />
                  <Skeleton className="h-3.5 w-24 max-w-full rounded-full" />
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-full shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:flex bg-white border border-[#ececec] p-2.5 sm:p-3 flex-col gap-2.5 sm:gap-3 rounded-[24px] min-w-0">
          <Skeleton className="h-6 w-36 max-w-full rounded-full" />
          <Skeleton className="h-10 w-full rounded-full" />
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex justify-between gap-2">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full shrink-0" />
            </div>
            <div className="flex justify-between gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 sm:w-28 rounded-full shrink-0" />
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-full mt-1" />
        </div>
      </div>
    </div>
  );
}

export function CheckoutSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="kova-container px-2.5 lg:px-6 pt-4 pb-12 flex flex-col gap-4 overflow-x-hidden"
    >
      <Skeleton className="h-3.5 w-32 max-w-full rounded-full" />
      <div className="flex flex-col gap-2 min-w-0">
        <Skeleton className="h-8 w-44 max-w-full rounded-full" />
        <Skeleton className="h-4 w-80 max-w-full rounded-full" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 lg:gap-6 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {/* Shipping Address Card */}
          <div className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 rounded-[24px] min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 min-w-0">
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <Skeleton className="h-6 w-40 max-w-full rounded-full" />
                <Skeleton className="h-3.5 w-56 max-w-full rounded-full" />
              </div>
              <Skeleton className="h-9 w-full sm:w-36 rounded-full shrink-0" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-[#f7f7f7] p-2.5 flex flex-col gap-2 rounded-[14px] min-w-0"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <Skeleton className="h-4 w-32 max-w-[70%] rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                  </div>
                  <Skeleton className="h-3.5 w-28 max-w-full rounded-full" />
                  <Skeleton className="h-3 w-[85%] rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Options Section */}
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex flex-col gap-1.5 min-w-0">
              <Skeleton className="h-6 w-48 sm:w-52 max-w-full rounded-full" />
              <Skeleton className="h-3.5 w-60 sm:w-64 max-w-full rounded-full" />
            </div>
            <div className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-3 rounded-[24px] min-w-0">
              <div className="flex items-center justify-between gap-2.5 pb-3 border-b border-[#ececec] min-w-0">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <Skeleton className="h-4 w-36 sm:w-44 max-w-full rounded-full" />
                    <Skeleton className="h-3 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-4 w-16 sm:w-20 rounded-full shrink-0" />
              </div>

              <div className="flex flex-col gap-2.5 min-w-0">
                {Array.from({ length: 2 }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-3 min-w-0">
                    <Skeleton className="w-14 h-14 rounded-[14px] shrink-0" />
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      <Skeleton className="h-4 w-[65%] rounded-full" />
                      <Skeleton className="h-3 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-16 rounded-full shrink-0" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {Array.from({ length: 2 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="bg-[#f7f7f7] p-2.5 flex flex-col gap-2 rounded-[14px] min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <Skeleton className="h-4 w-28 sm:w-32 max-w-[70%] rounded-full" />
                      <Skeleton className="h-4 w-14 rounded-full shrink-0" />
                    </div>
                    <Skeleton className="h-3 w-36 sm:w-40 max-w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Order Summary + Action Card */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="bg-white border border-[#ececec] p-2.5 sm:p-3 flex flex-col gap-3 rounded-[24px] min-w-0">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-6 w-36 max-w-[70%] rounded-full" />
              <Skeleton className="h-3.5 w-16 rounded-full shrink-0" />
            </div>
            <div className="flex flex-col gap-2.5 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Skeleton className="w-4 h-4 rounded-full shrink-0" />
                <Skeleton className="h-3.5 w-28 max-w-full rounded-full" />
              </div>
              <div className="flex justify-between gap-3 pl-5 min-w-0">
                <Skeleton className="h-3.5 w-[64%] rounded-full" />
                <Skeleton className="h-3.5 w-14 rounded-full shrink-0" />
              </div>
              <div className="flex justify-between gap-3 pl-5 min-w-0">
                <Skeleton className="h-3.5 w-[52%] rounded-full" />
                <Skeleton className="h-3.5 w-14 rounded-full shrink-0" />
              </div>
            </div>
            <div className="border-t border-[#ececec] pt-3 flex flex-col gap-2">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full shrink-0" />
              </div>
              <div className="flex justify-between gap-2">
                <Skeleton className="h-4 w-28 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full shrink-0" />
              </div>
              <div className="border-t border-[#ececec] pt-2.5 flex items-baseline justify-between gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-3 w-20 rounded-full" />
                </div>
              </div>
            </div>
            <Skeleton className="h-14 w-full rounded-[14px]" />
          </div>

          <div className="bg-white border border-[#ececec] p-2.5 flex flex-col gap-2.5 rounded-[24px]">
            <Skeleton className="h-11 w-full rounded-full" />
            <Skeleton className="h-10 w-full rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2.5 min-w-0">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-2.5 flex items-start gap-2.5 sm:gap-3 bg-[#f7f7f7] rounded-[14px] min-w-0"
        >
          <Skeleton className="w-9 h-9 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <Skeleton className="h-4 w-32 sm:w-48 max-w-full rounded-full" />
              <Skeleton className="h-3 w-14 sm:w-20 rounded-full shrink-0" />
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
    <div
      aria-hidden="true"
      className="min-h-screen w-full bg-[#f7f7f7] flex overflow-x-hidden"
    >
      {/* Left Sidebar Skeleton */}
      <aside className="hidden lg:flex w-[260px] px-[14px] py-[16px] bg-white border-r border-[#ececec] flex-col justify-between shrink-0 h-screen sticky top-0">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>

          <div className="bg-[#f7f7f7] border border-[#ececec] p-2.5 flex items-center gap-2.5 rounded-[14px]">
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28 max-w-full rounded-full" />
              <Skeleton className="h-2.5 w-36 max-w-full rounded-full" />
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
                  <Skeleton className="w-4 h-4 rounded-full shrink-0" />
                  <Skeleton className="h-3.5 w-28 rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>

        <Skeleton className="h-[84px] w-full rounded-[14px]" />
      </aside>

      {/* Right Workspace Skeleton */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="h-[60px] sm:h-[68px] bg-white border-b border-[#ececec] px-2.5 lg:px-7 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <Skeleton className="h-4 w-24 sm:w-48 max-w-full rounded-full" />
          </div>
          <Skeleton className="hidden md:block h-[38px] w-[280px] rounded-full shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="hidden sm:block h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="hidden sm:block h-8 w-8 rounded-full" />
            <Skeleton className="hidden md:block h-9 w-36 rounded-full" />
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1220px] px-2.5 lg:px-[26px] pt-4 lg:pt-[22px] pb-[36px] flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              <Skeleton className="h-7 w-44 sm:w-64 max-w-full rounded-full" />
              <Skeleton className="h-3.5 w-64 sm:w-72 max-w-full rounded-full" />
            </div>
            <Skeleton className="h-9 w-32 sm:w-28 rounded-full shrink-0" />
          </div>

          <div className="bg-white border border-[#ececec] p-3.5 sm:p-4 max-w-[820px] flex flex-col gap-3 rounded-[24px] min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#ececec] min-w-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-full shrink-0" />
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <Skeleton className="h-5 w-32 sm:w-40 max-w-full rounded-full" />
                  <Skeleton className="h-3.5 w-44 sm:w-52 max-w-full rounded-full" />
                </div>
              </div>
              <Skeleton className="h-9 w-full sm:w-28 rounded-full shrink-0" />
            </div>

            <Skeleton className="h-4 w-36 sm:w-40 max-w-full rounded-full" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-[42px] w-full rounded-full" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="h-[42px] w-full rounded-full" />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-2">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="h-[42px] w-full rounded-full" />
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
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white border border-[#ececec] p-4 sm:p-5 flex flex-col gap-2.5 rounded-[24px] min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <Skeleton className="h-3.5 w-24 sm:w-28 max-w-full rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full shrink-0" />
          </div>
          <Skeleton className="h-8 w-28 sm:w-32 max-w-full rounded-full" />
          <Skeleton className="h-3 w-32 sm:w-36 max-w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DashboardTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      aria-hidden="true"
      className="bg-white border border-[#ececec] p-3.5 sm:p-4 flex flex-col gap-3 rounded-[24px] min-w-0 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2.5 sm:gap-3 min-w-0">
        <Skeleton className="h-5 w-32 sm:w-44 max-w-full rounded-full" />
        <Skeleton className="h-8 w-20 sm:w-28 rounded-full shrink-0" />
      </div>
      <Skeleton className="h-9 w-full rounded-full" />
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-2.5 sm:gap-3 py-2 border-b border-[#ececec] last:border-b-0 min-w-0"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
            <Skeleton className="w-9 h-9 rounded-[10px] shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <Skeleton className="h-3.5 w-28 sm:w-44 max-w-full rounded-full" />
              <Skeleton className="h-2.5 w-20 sm:w-28 max-w-full rounded-full" />
            </div>
          </div>
          <Skeleton className="h-4 w-20 rounded-full hidden md:block shrink-0" />
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
          <Skeleton className="h-4 w-14 rounded-full hidden sm:block shrink-0" />
        </div>
      ))}
    </div>
  );
}
