import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FigmaIcon } from './FigmaIcon';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

// ==========================================
// Status Pill (Exact Figma Market - v2 palette)
// ==========================================
export type BadgeTone = 'green' | 'orange' | 'red' | 'neutral' | 'blue';

const TONE_CLASSES: Record<BadgeTone, string> = {
  green: 'bg-[#e7f6e7] text-[#029500]',
  orange: 'bg-[#ffefe6] text-[#ff6e20]',
  red: 'bg-[#fdecec] text-[#e5322d]',
  neutral: 'bg-[#f4f4f4] text-[#666666]',
  blue: 'bg-[#eaf3ff] text-[#1877f2]',
};

function inferStatusTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (
    [
      'approved',
      'active',
      'published',
      'successful',
      'success',
      'paid',
      'connected',
      'delivered',
      'completed',
      'verified',
      'healthy',
      'resolved_customer',
      'resolved_store',
      'in stock',
      'live',
    ].includes(s)
  ) {
    return 'green';
  }
  if (
    [
      'pending',
      'processing',
      'requested',
      'shipped',
      'ready',
      'draft',
      'scheduled',
      'in review',
      'open',
      'under_review',
    ].includes(s)
  ) {
    return 'orange';
  }
  if (
    [
      'suspended',
      'rejected',
      'failed',
      'expired',
      'cancelled',
      'canceled',
      'disconnected',
      'out of stock',
      'low stock',
      'escalated',
      'urgent',
      'refunded',
    ].includes(s)
  ) {
    return 'red';
  }
  return 'neutral';
}

export function StatusPill({
  label,
  tone,
  className = '',
}: {
  label: string;
  tone?: BadgeTone;
  className?: string;
}) {
  const resolved = tone ?? inferStatusTone(label);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-semibold leading-tight capitalize whitespace-nowrap ${TONE_CLASSES[resolved]} ${className}`}
    >
      {label.replace(/_/g, ' ')}
    </span>
  );
}

// ==========================================
// Page Header
// ==========================================
export function DashboardPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[25px] sm:text-[26px] font-bold text-black tracking-[-0.02em] leading-[1.2]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-[#767676] mt-1 leading-[1.45]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

// ==========================================
// KPI Card (Exact Figma rounded-[18px] proportion)
// ==========================================
export interface KpiCardItem {
  label: string;
  value: string;
  sub: string;
  badge?: string;
  tone?: BadgeTone;
}

export function KpiCard({
  label,
  value,
  sub,
  badge,
  tone = 'neutral',
}: KpiCardItem) {
  return (
    <div className="bg-white border border-[#ececec] p-4 sm:p-5 flex flex-col justify-between gap-2.5 min-w-0 rounded-[24px]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-[#767676] truncate">
          {label}
        </p>
        {badge && <StatusPill label={badge} tone={tone} />}
      </div>
      <p className="text-[24px] sm:text-[26px] font-bold text-black tracking-[-0.025em] leading-[1.1] truncate">
        {value}
      </p>
      <p className="text-[11.5px] text-[#8a8a8a] truncate">{sub}</p>
    </div>
  );
}

export function KpiGrid({ items }: { items: KpiCardItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  );
}

// ==========================================
// Pill Filter Tabs (White bordered inactive + solid orange active)
// ==========================================
export interface FilterTabOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

export function FilterPillTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: FilterTabOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`px-3.5 py-[7px] rounded-full text-[12px] transition-colors whitespace-nowrap ${
              active
                ? 'bg-[#ff6e20] text-white font-semibold border border-[#ff6e20]'
                : 'bg-white text-[#555555] font-medium border border-[#ececec] hover:border-[#cccccc] hover:text-black'
            }`}
          >
            {opt.label}
            {opt.count !== undefined ? ` (${opt.count})` : ''}
          </button>
        );
      })}
    </div>
  );
}

// ==========================================
// Smooth Dual-Line Area Chart (matches Figma Admin · 01 & Seller · 01)
// ==========================================
export interface TrendSeriesPoint {
  label: string;
  primary: number;
  secondary?: number;
}

function buildSmoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cx = ((p0.x + p1.x) / 2).toFixed(1);
    d += ` C ${cx} ${p0.y.toFixed(1)}, ${cx} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

export function TrendAreaChart({
  title,
  subtitle,
  badge,
  badgeTone = 'green',
  primaryLabel,
  secondaryLabel,
  secondaryDashed = false,
  points,
  emptyHint = 'Live chart updates automatically as orders and payments settle.',
}: {
  title: string;
  subtitle: string;
  badge?: string;
  badgeTone?: BadgeTone;
  primaryLabel: string;
  secondaryLabel?: string;
  secondaryDashed?: boolean;
  points: TrendSeriesPoint[];
  emptyHint?: string;
}) {
  const gradId = useId().replace(/:/g, '');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const safePoints: TrendSeriesPoint[] =
    points.length >= 2
      ? points
      : [
          { label: points[0]?.label || 'Start', primary: 0, secondary: 0 },
          {
            label: points[0]?.label || 'Today',
            primary: points[0]?.primary ?? 0,
            secondary: points[0]?.secondary ?? 0,
          },
        ];

  const width = 680;
  const height = 205;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 18;
  const padBottom = 16;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxVal = Math.max(
    ...safePoints.map((p) => Math.max(p.primary, p.secondary ?? 0)),
    0,
  );
  const hasData = maxVal > 0;
  const ceiling = hasData ? maxVal * 1.15 : 100;

  const mapY = (val: number) =>
    hasData
      ? padTop + innerH - (Math.max(val, 0) / ceiling) * innerH
      : padTop + innerH - 6;

  const primaryCoords = safePoints.map((p, idx) => ({
    x: padLeft + (innerW * idx) / (safePoints.length - 1),
    y: mapY(p.primary),
  }));

  const secondaryCoords = safePoints.map((p, idx) => ({
    x: padLeft + (innerW * idx) / (safePoints.length - 1),
    y: mapY(p.secondary ?? 0),
  }));

  const primaryPath = buildSmoothPath(primaryCoords);
  const secondaryPath = secondaryLabel ? buildSmoothPath(secondaryCoords) : '';
  const areaPath =
    primaryCoords.length > 0
      ? `${primaryPath} L ${primaryCoords[primaryCoords.length - 1].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${primaryCoords[0].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`
      : '';

  const hovered = hoveredIdx !== null ? safePoints[hoveredIdx] : null;

  return (
    <section className="bg-white border border-[#ececec] p-4 sm:p-5 flex flex-col gap-3 min-w-0 rounded-[24px]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15.5px] font-bold text-black leading-snug">
            {title}
          </h2>
          <p className="text-[12px] text-[#8a8a8a] mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-medium text-[#767676]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff6e20]" />
              {primaryLabel}
            </span>
            {secondaryLabel && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#029500]" />
                {secondaryLabel}
              </span>
            )}
          </div>
          {badge && <StatusPill label={badge} tone={badgeTone} />}
        </div>
      </div>

      <div className="relative w-full pt-1">
        {hovered && hoveredIdx !== null && (
          <div className="absolute right-2 top-0 z-10 bg-black text-white rounded-[10px] px-3 py-1.5 text-[11px] shadow-md pointer-events-none">
            <p className="font-semibold text-white/80">{hovered.label}</p>
            <p className="font-bold text-[#ff8b4d]">
              {primaryLabel}: ${hovered.primary.toFixed(2)}
            </p>
            {secondaryLabel && hovered.secondary !== undefined && (
              <p className="font-semibold text-[#6ee777]">
                {secondaryLabel}: ${hovered.secondary.toFixed(2)}
              </p>
            )}
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[196px] overflow-visible"
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient
              id={`kovaGrad-${gradId}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#ff6e20" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#ff6e20" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + innerH * ratio;
            return (
              <line
                key={ratio}
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#f0f0f0"
                strokeWidth="1"
              />
            );
          })}

          {areaPath && <path d={areaPath} fill={`url(#kovaGrad-${gradId})`} />}

          {secondaryPath && (
            <path
              d={secondaryPath}
              fill="none"
              stroke="#029500"
              strokeWidth="2"
              strokeDasharray={secondaryDashed ? '5 4' : undefined}
              strokeLinecap="round"
            />
          )}

          {primaryPath && (
            <path
              d={primaryPath}
              fill="none"
              stroke="#ff6e20"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {primaryCoords.map((pt, idx) => (
            <g key={idx}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredIdx === idx ? 5 : 3.5}
                fill={hoveredIdx === idx ? '#ff6e20' : '#ffffff'}
                stroke="#ff6e20"
                strokeWidth="2"
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            </g>
          ))}
        </svg>

        <div className="flex items-center justify-between px-1 pt-1 text-[10.5px] text-[#979797]">
          {safePoints.map((pt, idx) => {
            const show =
              safePoints.length <= 7 ||
              idx === 0 ||
              idx === safePoints.length - 1 ||
              idx % Math.ceil(safePoints.length / 6) === 0;
            return (
              <span
                key={`${pt.label}-${idx}`}
                className={show ? '' : 'hidden sm:inline'}
              >
                {show ? pt.label : ''}
              </span>
            );
          })}
        </div>

        {!hasData && (
          <p className="text-[11.5px] text-[#8a8a8a] text-center pt-1.5">
            {emptyHint}
          </p>
        )}
      </div>
    </section>
  );
}

// ==========================================
// Horizontal Progress Breakdown Card
// (matches Figma Admin · 01 Payment methods & Seller · 01 Order stats)
// ==========================================
export interface BreakdownBarItem {
  label: string;
  rightText: string;
  percent: number;
  color: 'orange' | 'green' | 'neutral' | 'red';
}

const BAR_COLORS: Record<BreakdownBarItem['color'], string> = {
  orange: 'bg-[#ff6e20]',
  green: 'bg-[#029500]',
  neutral: 'bg-[#767676]',
  red: 'bg-[#e5322d]',
};

export function ProgressBreakdownCard({
  title,
  subtitle,
  items,
  footerPills,
}: {
  title: string;
  subtitle: string;
  items: BreakdownBarItem[];
  footerPills?: { label: string; tone: BadgeTone }[];
}) {
  return (
    <section className="bg-white border border-[#ececec] p-4 sm:p-5 flex flex-col justify-between gap-3.5 min-w-0 rounded-[24px]">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-[15.5px] font-bold text-black leading-snug">
            {title}
          </h2>
          <p className="text-[12px] text-[#8a8a8a] mt-0.5">{subtitle}</p>
        </div>

        <div className="flex flex-col gap-3.5">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="font-semibold text-black truncate">
                  {item.label}
                </span>
                <span className="text-[#767676] font-medium shrink-0">
                  {item.rightText}
                </span>
              </div>
              <div className="w-full h-[7px] rounded-full bg-[#f1f1f1] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${BAR_COLORS[item.color]}`}
                  style={{
                    width: `${Math.max(Math.min(item.percent, 100), item.percent > 0 ? 4 : 0)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {footerPills && footerPills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#f1f1f1]">
          {footerPills.map((p) => (
            <StatusPill key={p.label} label={p.label} tone={p.tone} />
          ))}
        </div>
      )}
    </section>
  );
}

// ==========================================
// Table Pagination Footer (matches Figma Seller · 02 & Seller · 07)
// ==========================================
export function TablePagination({
  page,
  lastPage,
  total,
  perPage,
  itemLabel = 'items',
  onPageChange,
}: {
  page: number;
  lastPage: number;
  total: number;
  perPage: number;
  itemLabel?: string;
  onPageChange: (nextPage: number) => void;
}) {
  if (total === 0) return null;
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const pages: number[] = [];
  for (let p = 1; p <= lastPage; p++) {
    if (p === 1 || p === lastPage || Math.abs(p - page) <= 1) {
      pages.push(p);
    }
  }

  return (
    <div className="pt-3.5 border-t border-[#f1f1f1] flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#767676]">
      <span>
        Showing {start}–{end} of {total} {itemLabel}
      </span>
      {lastPage > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-3 py-1.5 rounded-full border border-[#ececec] bg-white text-black font-medium hover:border-[#cccccc] disabled:opacity-40"
          >
            Prev
          </button>
          {pages.map((p, idx) => {
            const prev = pages[idx - 1];
            const showGap = prev !== undefined && p - prev > 1;
            return (
              <span key={p} className="inline-flex items-center gap-1.5">
                {showGap && <span className="px-1 text-[#979797]">...</span>}
                <button
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`w-8 h-8 rounded-full font-semibold transition-colors ${
                    p === page
                      ? 'bg-[#ff6e20] text-white'
                      : 'bg-white border border-[#ececec] text-black hover:border-[#cccccc]'
                  }`}
                >
                  {p}
                </button>
              </span>
            );
          })}
          <button
            type="button"
            disabled={page >= lastPage}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1.5 rounded-full border border-[#ececec] bg-white text-black font-medium hover:border-[#cccccc] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Centered Modal (shared across Customer, Seller & Root Admin)
// ==========================================
export function SlideOverDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClass = 'max-w-[620px]',
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-5 bg-black/50 backdrop-blur-[3px] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${widthClass} bg-white rounded-[24px] max-h-[88vh] shadow-[0_24px_64px_rgba(0,0,0,0.22)] flex flex-col overflow-hidden my-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 sm:px-5 py-3.5 border-b border-[#ececec] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[17px] sm:text-[18px] font-bold text-black leading-snug truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[12.5px] text-[#767676] mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full bg-[#e8e8e8] hover:bg-[#dcdcdc] border border-[#d4d4d4] text-[#171717] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <FigmaIcon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5">{children}</div>

        {footer && (
          <div className="px-3.5 sm:px-5 py-3 border-t border-[#ececec] bg-[#fafafa] flex flex-nowrap items-center justify-end gap-2 overflow-x-auto shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export const DashboardModal = SlideOverDrawer;
