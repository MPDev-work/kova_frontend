import { Link } from 'react-router-dom';
import { FigmaIcon } from './FigmaIcon';

interface KovaLogoProps {
  className?: string;
  size?: 'md' | 'sm';
  to?: string;
  linkState?: Record<string, unknown>;
}

export function KovaLogo({
  className = '',
  size = 'md',
  to = '/',
  linkState,
}: KovaLogoProps) {
  const textClass = size === 'sm' ? 'text-[30px]' : 'text-[40px]';
  const flameClass = size === 'sm' ? 'w-[22px] h-[22px]' : 'w-[30px] h-[30px]';

  return (
    <Link
      to={to}
      state={linkState}
      className={`inline-flex items-center select-none group ${className}`}
      aria-label="KOVA Home"
    >
      <span
        className={`font-kova-logo leading-none text-[#ff6e20] tracking-[-2px] ${textClass}`}
      >
        K
      </span>
      <span
        className={`relative shrink-0 mx-[-1px] transition-transform group-hover:scale-105 text-[#ff6e20] inline-flex items-center justify-center ${flameClass}`}
      >
        <FigmaIcon name="fire-filled" className="w-full h-full" />
      </span>
      <span
        className={`font-kova-logo leading-none text-[#ff6e20] tracking-[-2px] ${textClass}`}
      >
        VA
      </span>
    </Link>
  );
}
