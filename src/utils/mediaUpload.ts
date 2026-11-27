export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_UPLOAD_LABEL = '20MB';

export type ImageResizePreset = 'standard' | 'avatar' | 'logo' | 'banner' | 'full';

const SKIP_CANVAS_MIME_TYPES = new Set([
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'avif',
  'bmp',
  'ico',
  'svg',
  'tif',
  'tiff',
  'jfif',
  'heic',
  'heif',
  'apng',
]);

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function isSupportedImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  const ext = getExtension(file.name);
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Validates file size (<= 20MB) and basic MIME/extension type.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateUploadFile(
  file: File,
  kind: 'image' | 'audio' = 'image',
): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" is larger than ${MAX_UPLOAD_LABEL} and was ignored. Please choose a file under ${MAX_UPLOAD_LABEL}.`;
  }

  if (kind === 'image' && !isSupportedImageFile(file)) {
    return `"${file.name}" is not a supported image format.`;
  }

  return null;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to decode image.'));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function replaceFileExtension(name: string, ext: string): string {
  const clean = name.replace(/\.[^/.]+$/, '') || 'image';
  return `${clean}.${ext}`;
}

/**
 * Downscales raster images in the browser before uploading to Cloudinary:
 * - 'standard': max 720p (1280x720 landscape / 720x1280 portrait), never upscales.
 * - 'avatar' | 'logo': max 256x256, never upscales.
 * - 'banner' | 'full': keeps full original resolution untouched.
 * Throws if the file exceeds 20MB.
 */
export async function prepareImageForUpload(
  file: File,
  preset: ImageResizePreset = 'standard',
): Promise<File> {
  const err = validateUploadFile(file, 'image');
  if (err) {
    throw new Error(err);
  }

  if (preset === 'banner' || preset === 'full') {
    return file;
  }

  const lowerType = (file.type || '').toLowerCase();
  const ext = getExtension(file.name);
  if (
    SKIP_CANVAS_MIME_TYPES.has(lowerType) ||
    ext === 'gif' ||
    ext === 'svg' ||
    ext === 'ico'
  ) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (!width || !height) {
      return file;
    }

    let maxW = 1280;
    let maxH = 720;
    if (preset === 'avatar' || preset === 'logo') {
      maxW = 256;
      maxH = 256;
    } else if (height > width) {
      // Portrait 720p
      maxW = 720;
      maxH = 1280;
    }

    if (width <= maxW && height <= maxH) {
      // Already within bounds — keep original resolution untouched
      return file;
    }

    const scale = Math.min(maxW / width, maxH / height);
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const preferPng = lowerType === 'image/png';
    const targetMime = preferPng ? 'image/png' : 'image/webp';
    let blob = await canvasToBlob(canvas, targetMime, preferPng ? undefined : 0.88);

    if (!blob) {
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
    }
    if (!blob) return file;

    const outExt =
      blob.type === 'image/png'
        ? 'png'
        : blob.type === 'image/webp'
          ? 'webp'
          : 'jpg';

    return new File([blob], replaceFileExtension(file.name, outExt), {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    // Browser could not decode format (e.g. HEIC/TIFF); let backend & Cloudinary convert/downscale
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
