import type { Store } from '../types/marketplace';

export function extractStoreLocationTags(store: Store): string[] {
  const tags: string[] = [];
  const pushUnique = (val?: string | null) => {
    const clean = val?.trim();
    if (!clean) return;
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      tags.push(clean);
    }
  };

  pushUnique(store.province);
  pushUnique(store.district);
  pushUnique(store.commune);

  if (tags.length === 0 && store.address) {
    store.address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 4)
      .forEach((part) => pushUnique(part));
  }

  if (tags.length === 0) {
    tags.push('Cambodia');
  }

  return tags;
}

export function getStoreGoogleMapsHref(store: Store): string {
  if (store.google_maps_url && store.google_maps_url.trim()) {
    return store.google_maps_url.trim();
  }
  const queryParts = [
    store.name,
    store.commune,
    store.district,
    store.province,
    store.address,
    'Cambodia',
  ]
    .map((p) => p?.trim())
    .filter(Boolean);
  const uniqueQuery = Array.from(new Set(queryParts)).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(uniqueQuery)}`;
}
