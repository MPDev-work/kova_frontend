import type { CSSProperties } from 'react';

/**
 * Matching Lucide stroke width for icons missing from `/public/assets/icons - asset/`.
 * Every SVG in `icons - asset` uses a 1px stroke on a 16x16 viewBox, which equals
 * `1 * (24 / 16) = 1.5` on Lucide's 24x24 viewBox.
 */
export const ICON_STROKE_WIDTH = 1.5;

export type FigmaIconName =
  | 'alert-circle'
  | 'alert-triangle'
  | 'arrow-down'
  | 'arrow-left'
  | 'arrow-up-right'
  | 'bell'
  | 'calendar'
  | 'camera'
  | 'check'
  | 'check-circle'
  | 'check-square'
  | 'check-stamp'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-up'
  | 'clock'
  | 'copy'
  | 'download'
  | 'edit'
  | 'edit-2'
  | 'external-link'
  | 'eye'
  | 'eye-off'
  | 'fire-filled'
  | 'grid'
  | 'headphones'
  | 'heart'
  | 'heart-filled'
  | 'help-circle'
  | 'home'
  | 'home-filled'
  | 'image'
  | 'image-plus'
  | 'key'
  | 'list'
  | 'lock'
  | 'log-out'
  | 'mail'
  | 'map'
  | 'map-pin'
  | 'menu'
  | 'message-circle'
  | 'message-square'
  | 'message-square-filled'
  | 'mic'
  | 'minus'
  | 'moon'
  | 'more-horizontal'
  | 'move'
  | 'package'
  | 'pause'
  | 'pause-circle'
  | 'pause-filled'
  | 'phone'
  | 'play'
  | 'play-filled'
  | 'plus'
  | 'printer'
  | 'refresh-cw'
  | 'rotate-ccw'
  | 'search'
  | 'send'
  | 'shield'
  | 'shopping-bag'
  | 'shopping-cart'
  | 'shopping-cart-filled'
  | 'sidebar'
  | 'slash'
  | 'sliders'
  | 'star'
  | 'star-filled'
  | 'sun'
  | 'tag'
  | 'trash'
  | 'truck'
  | 'upload'
  | 'user'
  | 'user-filled'
  | 'user-plus'
  | 'users'
  | 'x'
  | 'zap'
  | 'zoom-in'
  | 'zoom-out';

interface FigmaIconProps {
  name: FigmaIconName;
  className?: string;
  label?: string;
}

/**
 * Renders icons exclusively from `/public/assets/icons - asset/*.svg`
 * using CSS mask-image so every vector preserves exact 16x16 geometry and stroke
 * while inheriting `currentColor`.
 */
export function FigmaIcon({
  name,
  className = 'w-4 h-4',
  label,
}: FigmaIconProps) {
  const url = `url("/assets/icons%20-%20asset/${name}.svg")`;
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
