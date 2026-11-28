import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FigmaIcon } from './FigmaIcon';
import { ProductCard } from './ProductCard';
import { RightSlideModal } from './RightSlideModal';
import { ProductGridSkeleton } from './Skeleton';
import { useStore } from '../context/StoreContext';

interface WishlistDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenCart: () => void;
}

export function WishlistDrawer({
  open,
  onClose,
  onOpenCart,
}: WishlistDrawerProps) {
  const {
    bootstrapping,
    isSignedIn,
    wishlist,
    cartCount,
    moveAllWishlistToCart,
  } = useStore();
  const [movingAll, setMovingAll] = useState(false);

  const handleMoveAllToCart = async () => {
    if (movingAll) return;
    setMovingAll(true);
    try {
      const movedCount = await moveAllWishlistToCart();
      if (movedCount > 0) {
        onOpenCart();
      }
    } finally {
      setMovingAll(false);
    }
  };

  const footer =
    isSignedIn && wishlist.length > 0 ? (
      <div className="px-3.5 py-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenCart}
          className="flex-1 bg-white border border-[#ececec] hover:border-[#ff6e20] hover:text-[#ff6e20] text-[13px] font-semibold text-black py-2.5 px-4 rounded-full transition-colors whitespace-nowrap cursor-pointer"
        >
          View cart{cartCount > 0 ? ` (${cartCount})` : ''}
        </button>
        <button
          type="button"
          disabled={movingAll}
          onClick={() => void handleMoveAllToCart()}
          className="flex-1 bg-[#ff6e20] hover:bg-[#e85d12] disabled:opacity-60 text-white text-[13px] font-semibold py-2.5 px-4 rounded-full transition-colors whitespace-nowrap cursor-pointer"
        >
          {movingAll ? 'Moving...' : 'Move all to cart'}
        </button>
      </div>
    ) : undefined;

  const isFullBleedState =
    !(bootstrapping && isSignedIn) && (!isSignedIn || wishlist.length === 0);

  return (
    <RightSlideModal
      open={open}
      onClose={onClose}
      title={`Wishlist (${wishlist.length})`}
      subtitle="Products you saved to your Kova account."
      bodyClassName={isFullBleedState ? 'p-0 flex flex-col bg-white' : 'p-2.5'}
      footer={footer}
      ariaLabel="Wishlist"
    >
      {bootstrapping && isSignedIn ? (
        <ProductGridSkeleton count={4} columnsClass="grid-cols-2" />
      ) : !isSignedIn ? (
        <div className="flex-1 min-h-full w-full bg-white px-6 py-10 flex flex-col items-center justify-center text-center gap-2.5">
          <div className="w-14 h-14 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
            <FigmaIcon name="heart" className="w-7 h-7" />
          </div>
          <h3 className="text-[19px] font-semibold text-black">
            Sign in to view your wishlist
          </h3>
          <p className="text-[13.5px] text-[#767676] max-w-[300px]">
            Save products across sessions with your Kova account.
          </p>
          <Link
            to="/login"
            onClick={onClose}
            className="mt-1 bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold px-6 py-2.5 rounded-full transition-colors"
          >
            Sign in
          </Link>
        </div>
      ) : wishlist.length === 0 ? (
        <div className="flex-1 min-h-full w-full bg-white px-6 py-10 flex flex-col items-center justify-center text-center gap-2.5">
          <div className="w-14 h-14 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
            <FigmaIcon name="heart" className="w-7 h-7" />
          </div>
          <h3 className="text-[19px] font-semibold text-black">
            Your wishlist is empty
          </h3>
          <p className="text-[13.5px] text-[#767676] max-w-[300px]">
            Tap the heart icon on any product to save it here.
          </p>
          <Link
            to="/products"
            onClick={onClose}
            className="mt-1 bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[13.5px] font-semibold px-6 py-2.5 rounded-full transition-colors"
          >
            Discover products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 pb-2">
          {wishlist.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              compact
              onNavigate={onClose}
            />
          ))}
        </div>
      )}
    </RightSlideModal>
  );
}
