import type { CSSProperties } from 'react';

export type FigmaIconName =
  | 'bell'
  | 'check-stamp'
  | 'clock'
  | 'fire-filled'
  | 'heart'
  | 'heart-filled'
  | 'help-circle'
  | 'home'
  | 'lock'
  | 'mail'
  | 'map-pin'
  | 'menu'
  | 'package'
  | 'phone'
  | 'rotate-ccw'
  | 'search'
  | 'shield'
  | 'shopping-bag'
  | 'shopping-cart'
  | 'sidebar'
  | 'sliders'
  | 'star'
  | 'tag'
  | 'truck'
  | 'upload'
  | 'user'
  | 'x'
  | 'zap';

interface FigmaIconProps {
  name: FigmaIconName;
  className?: string;
  label?: string;
}

/**
 * Renders icons from the Figma "Assets - Icons (Community)" library (/public/assets/icons/figma/*.svg)
 * using CSS mask-image so each vector preserves exact Figma geometry while inheriting `currentColor`.
 */
export function FigmaIcon({
  name,
  className = 'w-4 h-4',
  label,
}: FigmaIconProps) {
  const url = `url("/assets/icons/figma/${name}.svg?v=2")`;
  const style: CSSProperties = {
    backgroundColor: 'currentColor',
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  };

  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={style}
      className={`inline-block shrink-0 align-middle ${className}`}
    />
  );
}
