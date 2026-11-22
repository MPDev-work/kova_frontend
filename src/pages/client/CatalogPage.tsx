import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FigmaIcon } from '../../components/FigmaIcon';
import { useStore } from '../../context/StoreContext';
import { catalogApi } from '../../services/api';
import { ProductCard } from '../../components/ProductCard';
import { ProductGridSkeleton } from '../../components/Skeleton';
import type { Product } from '../../types/marketplace';

const PRICE_RANGES = [
  { id: 'any', label: 'Any Price', min: undefined, max: undefined },
  { id: 'under15', label: 'Under $15', min: undefined, max: 15 },
  { id: '15to50', label: '$15 – $50', min: 15, max: 50 },
  { id: '50to150', label: '$50 – $150', min: 50, max: 150 },
];

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'price_low_to_high', label: 'Price: Low to High' },
  { id: 'price_high_to_low', label: 'Price: High to Low' },
  { id: 'name_asc', label: 'Name A–Z' },
];

interface CatalogPageProps {
  mode?: 'all' | 'promotion' | 'free-delivery';
}

export function CatalogPage({ mode = 'all' }: CatalogPageProps) {
  const { categories } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';
  const initialSort = searchParams.get('sort') || 'newest';

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [priceRange, setPriceRange] = useState('any');
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState(initialSort);
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState<Product[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const range = PRICE_RANGES.find((r) => r.id === priceRange);

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await catalogApi.getProducts({
          search: initialQuery || undefined,
          category: selectedCategory || undefined,
          has_discount: mode === 'promotion' || undefined,
          free_shipping: mode === 'free-delivery' || undefined,
          verified_only: onlyVerified || undefined,
          in_stock: onlyInStock || undefined,
          min_price: range?.min,
          max_price: range?.max,
          sort: sortBy,
          page,
          per_page: 20,
        });
        if (active) {
          setProducts(res.products);
          setLastPage(res.lastPage);
          setTotal(res.total);
        }
      } catch {
        if (active) {
          setProducts([]);
          setTotal(0);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchProducts();
    return () => {
      active = false;
    };
  }, [
    initialQuery,
    selectedCategory,
    priceRange,
    onlyVerified,
    onlyInStock,
    sortBy,
    page,
    mode,
  ]);

  const clearAllFilters = () => {
    setSelectedCategory('');
    setPriceRange('any');
    setOnlyVerified(false);
    setOnlyInStock(false);
    setSortBy('newest');
    setPage(1);
    setSearchParams({});
  };

  const title = initialQuery
    ? `Search results for “${initialQuery}”`
    : selectedCategory
      ? `Category: ${selectedCategory}`
      : 'All Products · Kova Marketplace';

  return (
    <div className="kova-container px-2.5 lg:px-[10px] pt-[14px] pb-7 flex flex-col gap-4">
      {/* Filter Matrix */}
      <section className="bg-white border border-[#ececec] rounded-[20px] px-[18px] py-3.5 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <div>
            <h1 className="text-[20px] font-bold text-black leading-[1.35]">
              {title}
            </h1>
            <p className="text-[12.5px] text-[#767676]">
              {loading
                ? 'Loading products...'
                : `${total} matching product${total === 1 ? '' : 's'}`}
            </p>
          </div>
          {(selectedCategory ||
            priceRange !== 'any' ||
            onlyVerified ||
            onlyInStock ||
            initialQuery) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[12.5px] font-semibold text-[#ff6e20] hover:underline"
            >
              Reset all filters
            </button>
          )}
        </div>

        {/* Category Row */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-semibold text-[#767676] w-[96px] shrink-0">
              Category:
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-[12px] transition-colors ${
                selectedCategory === ''
                  ? 'bg-[#ff6e20] text-white font-semibold'
                  : 'bg-[#f7f7f7] text-black font-medium hover:bg-[#ffefe6] hover:text-[#ff6e20]'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.slug);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-[12px] transition-colors ${
                  selectedCategory === cat.slug
                    ? 'bg-[#ff6e20] text-white font-semibold'
                    : 'bg-[#f7f7f7] text-black font-medium hover:bg-[#ffefe6] hover:text-[#ff6e20]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Price & Filters Row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-semibold text-[#767676] w-[96px] shrink-0">
            Price &amp; Perks:
          </span>
          {PRICE_RANGES.map((pr) => (
            <button
              key={pr.id}
              type="button"
              onClick={() => {
                setPriceRange(pr.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-[12px] transition-colors ${
                priceRange === pr.id
                  ? 'bg-[#ff6e20] text-white font-semibold'
                  : 'bg-[#f7f7f7] text-black font-medium hover:bg-[#ffefe6] hover:text-[#ff6e20]'
              }`}
            >
              {pr.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setOnlyVerified((v) => !v);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-[12px] transition-colors ${
              onlyVerified
                ? 'bg-[#ffefe6] text-[#ff6e20] border border-[#ff6e20] font-semibold'
                : 'bg-[#f7f7f7] text-black font-medium hover:bg-[#ffefe6] hover:text-[#ff6e20]'
            }`}
          >
            Verified Stores Only
          </button>
        </div>
      </section>

      {/* Sort Bar */}
      <section className="bg-white border border-[#ececec] rounded-[14px] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSortBy(opt.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-[12px] transition-colors ${
                  active
                    ? 'bg-[#ff6e20] text-white font-semibold'
                    : 'bg-[#f7f7f7] text-black font-medium hover:bg-[#ffefe6] hover:text-[#ff6e20]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setOnlyInStock((v) => !v);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-[12px] transition-colors ${
              onlyInStock
                ? 'bg-[#e7f6e7] text-[#029500] font-semibold'
                : 'bg-[#f7f7f7] text-black font-medium hover:bg-[#ffefe6]'
            }`}
          >
            In Stock Only
          </button>
        </div>

        <div className="flex items-center gap-3 text-[12.5px] font-semibold text-[#ff6e20]">
          <span>
            Page {page} / {Math.max(1, lastPage)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-full bg-[#f7f7f7] disabled:opacity-40 hover:bg-[#ffefe6] text-black hover:text-[#ff6e20] transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              className="px-3 py-1 rounded-full bg-[#f7f7f7] disabled:opacity-40 hover:bg-[#ffefe6] text-black hover:text-[#ff6e20] transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Product Grid or Empty State */}
      {loading ? (
        <ProductGridSkeleton count={10} />
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#ececec] rounded-[24px] py-16 px-6 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#ffefe6] text-[#ff6e20] flex items-center justify-center">
            <FigmaIcon name="search" className="w-8 h-8" />
          </div>
          <h2 className="text-[24px] font-semibold text-black">
            No matching products found
          </h2>
          <p className="text-[14.5px] text-[#767676] max-w-[440px]">
            No products matched your filters yet, or no store listings have been
            published to the backend database.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <button
              type="button"
              onClick={clearAllFilters}
              className="bg-[#ff6e20] hover:bg-[#e85d12] text-white text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
            >
              Clear all filters
            </button>
            <Link
              to="/"
              className="bg-white border border-[#ececec] hover:bg-[#f7f7f7] text-black text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
            >
              Back to home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
