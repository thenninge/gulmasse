/**
 * Shrink a photo in the browser before upload. Phone photos are often several MB,
 * above both our 5 MB limit and Vercel's ~4.5 MB request limit. Small images are
 * sent unchanged; if the browser can't decode the file, the original is returned.
 */
const MAX_SIDE = 1600;
const SKIP_BELOW_BYTES = 1_500_000;

export async function shrinkImageForUpload(file: File): Promise<File> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return file;
  try {
    const url = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('decode'));
        el.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return file;
    if (file.size <= SKIP_BELOW_BYTES && Math.max(w, h) <= MAX_SIDE) return file;

    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff'; // transparent PNGs would turn black as JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    const base = (file.name || 'bilde').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
