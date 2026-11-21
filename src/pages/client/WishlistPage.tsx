import { Link } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../../components/ProductCard';
import { ProductGridSkeleton } from '../../components/Skeleton';

export function WishlistPage() {
  const { bootstrapping, isSignedIn, wishlist } = useStore();

  return (
    <div className="kova-container px-4 lg:px-6 pt-5 pb-12 flex flex-col gap-5">
      <p className="text-[12px] text-[#767676]">Home &nbsp;/&nbsp; Wishlist</p>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold text-black leading-[1.2]">
            Wishlist ({wishlist.length})
          </h1>
          <p className="text-[15px] text-[#767676] mt-1">
            Products you saved to your Kova account.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/cart"
            className="bg-white border border-[#ececec] hover:border-[#ff6e20] text-[14px] font-semibold text-black px-5 py-2.5 rounded-full transition-colors"
          >
            View cart
          </Link>
          <Link
            to="/products"
            className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-5 py-2.5 rounded-full transition-colors"
          >
            Browse products
          </Link>
        </div>
      </div>

      {bootstrapping && isSignedIn ? (
        <ProductGridSkeleton count={5} />
      ) : !isSignedIn ? (
        <div className="bg-white border border-[#ececec] rounded-[24px] py-16 px-6 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
            <FigmaIcon name="heart" className="w-8 h-8" />
          </div>
          <h2 className="text-[24px] font-semibold text-black">
            Sign in to view your wishlist
          </h2>
          <p className="text-[14.5px] text-[#767676] max-w-[420px]">
            Save products across sessions with your Kova account.
          </p>
          <Link
            to="/login"
            className="mt-1 bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
          >
            Sign in
          </Link>
        </div>
      ) : wishlist.length === 0 ? (
        <div className="bg-white border border-[#ececec] rounded-[24px] py-16 px-6 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
            <FigmaIcon name="heart" className="w-8 h-8" />
          </div>
          <h2 className="text-[24px] font-semibold text-black">
            Your wishlist is empty
          </h2>
          <p className="text-[14.5px] text-[#767676] max-w-[420px]">
            Tap the heart icon on any product to save it here.
          </p>
          <Link
            to="/products"
            className="mt-1 bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
          >
            Discover products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {wishlist.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
