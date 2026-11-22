import { Link } from 'react-router-dom';
import { FigmaIcon } from './FigmaIcon';
import { useStore } from '../context/StoreContext';
import { formatKhr } from '../utils/currency';
import { VerifiedBadge } from './VerifiedBadge';
import type { Product } from '../types/marketplace';

interface ProductCardProps {
  product: Product;
  previewOnly?: boolean;
  onPreviewClick?: (product: Product) => void;
}

export function ProductCard({
  product,
  previewOnly = false,
  onPreviewClick,
}: ProductCardProps) {
  const { wishlistIds, toggleWishlist, khrRate } = useStore();
  const isSaved = wishlistIds.includes(product.id);

  return (
    <div
      onClick={previewOnly ? () => onPreviewClick?.(product) : undefined}
      className={`group bg-white border border-[#ececec] hover:border-[#ff6e20]/60 hover:shadow-md transition-all rounded-[20px] flex flex-col gap-2 pb-3 overflow-hidden ${
        previewOnly ? 'cursor-pointer' : ''
      }`}
    >
      {/* Photo Box */}
      <div className="relative aspect-[276/260] w-full overflow-hidden rounded-[20px] bg-[#f7f7f7]">
        {previewOnly ? (
          <div className="block w-full h-full">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#979797]">
                <FigmaIcon name="package" className="w-10 h-10" />
              </div>
            )}
          </div>
        ) : (
          <Link to={`/product/${product.slug}`} className="block w-full h-full">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#979797]">
                <FigmaIcon name="package" className="w-10 h-10" />
              </div>
            )}
          </Link>
        )}

        {/* Wishlist quick toggle */}
        {!previewOnly && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              void toggleWishlist(product.id);
            }}
            aria-label={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
            className={`absolute top-2.5 left-2.5 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-all ${
              isSaved
                ? 'bg-[#ff6e20] text-white'
                : 'bg-white/85 text-[#767676] opacity-0 group-hover:opacity-100 hover:text-[#ff6e20]'
            }`}
          >
            <FigmaIcon
              name={isSaved ? 'heart-filled' : 'heart'}
              className="w-4 h-4"
            />
          </button>
        )}

        {/* Discount Badge */}
        {product.discount_percent > 0 && (
          <div className="absolute top-2.5 right-2.5 bg-[#e5322d] text-white text-[11px] font-bold leading-[1.35] px-2 py-[3px] rounded-full">
            -{product.discount_percent}%
          </div>
        )}

        {/* Free Delivery Badge (bottom-left corner) */}
        {(product.has_free_delivery || product.free_shipping) && (
          <div className="absolute bottom-0 left-0 z-10 bg-green-600 rounded-tr-[14px] px-2.5 py-1 flex items-center gap-1 leading-none shadow-sm">
            <span className="text-[11.5px] text-[#ffe169]">Free</span>
            <span className="text-[11.5px] text-white">Delivery</span>
          </div>
        )}

        {!product.in_stock && (
          <div className="absolute bottom-2 right-2 bg-black/75 text-white text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full">
            Out of stock
          </div>
        )}
      </div>

      {/* Info */}
      {previewOnly ? (
        <div className="px-2.5 flex flex-col gap-[5px] flex-1">
          <p className="text-[14px] font-medium leading-[1.35] text-black line-clamp-2 min-h-[38px] group-hover:text-[#ff6e20] transition-colors">
            {product.name}
          </p>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="bg-[#ffefe6] text-[#ff6e20] text-[10px] font-semibold leading-[1.35] px-1.5 py-[2px] rounded-[6px] inline-flex items-center gap-1 max-w-[140px]">
              <span className="truncate">{product.store_name}</span>
              {product.store_verified && <VerifiedBadge size="xs" />}
            </span>
            {product.reviews_count > 0 && (
              <span className="text-[11px] text-[#979797] leading-[1.35]">
                ★ {product.rating.toFixed(1)} ({product.reviews_count})
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1.5 mt-auto pt-0.5">
            <span className="text-[21px] font-bold leading-[1.2] text-[#ff6e20]">
              ${product.price.toFixed(2)}
            </span>
            <span className="text-[11px] font-semibold text-[#ff6e20]">USD</span>
            {product.regular_price > product.price && (
              <span className="text-[11px] text-[#979797] line-through">
                ${product.regular_price.toFixed(2)}
              </span>
            )}
          </div>

          <p className="text-[11px] text-[#767676] leading-[1.35]">
            {formatKhr(product.price, product.price >= 300, khrRate)}
          </p>
        </div>
      ) : (
        <Link
          to={`/product/${product.slug}`}
          className="px-2.5 flex flex-col gap-[5px] flex-1"
        >
          <p className="text-[14px] font-medium leading-[1.35] text-black line-clamp-2 min-h-[38px] group-hover:text-[#ff6e20] transition-colors">
            {product.name}
          </p>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="bg-[#ffefe6] text-[#ff6e20] text-[10px] font-semibold leading-[1.35] px-1.5 py-[2px] rounded-[6px] inline-flex items-center gap-1 max-w-[140px]">
              <span className="truncate">{product.store_name}</span>
              {product.store_verified && <VerifiedBadge size="xs" />}
            </span>
            {product.reviews_count > 0 && (
              <span className="text-[11px] text-[#979797] leading-[1.35]">
                ★ {product.rating.toFixed(1)} ({product.reviews_count})
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1.5 mt-auto pt-0.5">
            <span className="text-[21px] font-bold leading-[1.2] text-[#ff6e20]">
              ${product.price.toFixed(2)}
            </span>
            <span className="text-[11px] font-semibold text-[#ff6e20]">USD</span>
            {product.regular_price > product.price && (
              <span className="text-[11px] text-[#979797] line-through">
                ${product.regular_price.toFixed(2)}
              </span>
            )}
          </div>

          <p className="text-[11px] text-[#767676] leading-[1.35]">
            {formatKhr(product.price, product.price >= 300, khrRate)}
          </p>
        </Link>
      )}
    </div>
  );
}
