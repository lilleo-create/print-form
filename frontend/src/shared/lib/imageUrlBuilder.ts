import { resolveImageUrl } from './resolveImageUrl';

export type ImageSizePreset = 'card' | 'detail' | 'thumb' | 'preview';

const PRESET_WIDTH: Record<ImageSizePreset, number> = {
  card: 300,
  detail: 800,
  thumb: 120,
  preview: 40
};

const CDN_BASE = import.meta.env.VITE_CDN_IMAGE_BASE?.trim() ?? '';

const normalizeBase = (value: string): string => value.replace(/\/$/, '');

const toAbsoluteUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    if (typeof window === 'undefined' || !window.location?.origin) {
      return null;
    }

    try {
      return new URL(value, `${window.location.origin}/`);
    } catch {
      return null;
    }
  }
};

const withTransformParams = (
  baseUrl: string,
  params: {
    width: number;
    format?: 'webp';
    quality?: number;
    blur?: number;
  }
): string => {
  const target = toAbsoluteUrl(baseUrl);

  if (CDN_BASE) {
    const cdnUrl = toAbsoluteUrl(normalizeBase(CDN_BASE));
    if (cdnUrl) {
      cdnUrl.searchParams.set('url', baseUrl);
      cdnUrl.searchParams.set('w', String(params.width));
      if (params.format) cdnUrl.searchParams.set('format', params.format);
      if (params.quality) cdnUrl.searchParams.set('q', String(params.quality));
      if (params.blur) cdnUrl.searchParams.set('blur', String(params.blur));
      return cdnUrl.toString();
    }
  }

  if (!target) return baseUrl;

  target.searchParams.set('w', String(params.width));
  if (params.format) target.searchParams.set('format', params.format);
  if (params.quality) target.searchParams.set('q', String(params.quality));
  if (params.blur) target.searchParams.set('blur', String(params.blur));

  return target.toString();
};

export const getPresetWidth = (preset: ImageSizePreset): number => PRESET_WIDTH[preset];

export const buildImageVariants = (
  rawUrl?: string | null,
  preset: ImageSizePreset = 'card'
): {
  fallback: string;
  webp: string;
  previewFallback: string;
  previewWebp: string;
} => {
  const source = resolveImageUrl(rawUrl);
  if (!source) {
    return {
      fallback: '',
      webp: '',
      previewFallback: '',
      previewWebp: ''
    };
  }

  const width = getPresetWidth(preset);
  const previewWidth = Math.max(24, Math.round(width / 8));

  return {
    fallback: withTransformParams(source, { width, quality: 75 }),
    webp: withTransformParams(source, { width, format: 'webp', quality: 72 }),
    previewFallback: withTransformParams(source, { width: previewWidth, quality: 35, blur: 12 }),
    previewWebp: withTransformParams(source, { width: previewWidth, format: 'webp', quality: 30, blur: 12 })
  };
};
