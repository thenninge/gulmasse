/** Fallback static images keyed by first name (legacy). */
const STATIC_BY_NAME: Record<string, string> = {
  adam: '/img/adam.png',
  eirik: '/img/eirik.png',
  konrad: '/img/konrad.jpg',
  martin: '/img/martin.jpg',
  tomas: '/img/tomas.jpg',
  roald: '/img/roald.png',
  kathinka: '/img/kathinka.png',
  magnus: '/img/magnus.png',
};

export function staticBeerImageForName(name: string): string | null {
  const key = (name || '').toLowerCase().trim();
  const first = key.split(/\s+/)[0] || key;
  return STATIC_BY_NAME[first] || null;
}

/** Prefer uploaded URL, then legacy static map. */
export function resolveBeerImage(opts: {
  beer_image_url?: string | null;
  name?: string | null;
}): string | null {
  const url = (opts.beer_image_url || '').trim();
  if (url) return url;
  return staticBeerImageForName(opts.name || '');
}

export const BEER_IMAGE_BUCKET = 'beer-images';
export const BEER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BEER_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
