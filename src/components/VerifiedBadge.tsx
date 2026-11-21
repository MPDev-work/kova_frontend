interface VerifiedBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const SIZE_MAP = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 21,
} as const;

/**
 * Facebook-style blue scalloped verified badge (#1877F2) with white checkmark.
 */
export function VerifiedBadge({
  size = 'sm',
  className = '',
  label = 'Verified',
}: VerifiedBadgeProps) {
  const px = SIZE_MAP[size];

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 align-middle ${className}`}
      title={label}
      aria-label={label}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_1px_1px_rgba(24,119,242,0.22)]"
      >
        <path
          d="M12 1.75L14.56 3.55L17.66 3.31L18.88 6.18L21.55 7.77L20.99 10.83L22.5 13.56L20.38 15.85L20.23 18.96L17.24 19.83L15.33 22.28L12.37 21.35L9.47 22.45L7.42 20.12L4.38 19.43L4.04 16.34L1.79 14.18L3.13 11.37L2.39 8.35L4.96 6.61L6.01 3.68L9.12 3.74L12 1.75Z"
          fill="#1877F2"
        />
        <path
          d="M16.65 8.85C17.04 9.24 17.04 9.87 16.65 10.26L11.2 15.71C10.81 16.1 10.18 16.1 9.79 15.71L7.35 13.27C6.96 12.88 6.96 12.25 7.35 11.86C7.74 11.47 8.37 11.47 8.76 11.86L10.5 13.59L15.24 8.85C15.63 8.46 16.26 8.46 16.65 8.85Z"
          fill="#FFFFFF"
        />
      </svg>
    </span>
  );
}
