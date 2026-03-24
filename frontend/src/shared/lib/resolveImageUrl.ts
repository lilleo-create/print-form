import { resolveMediaUrl } from './resolveMediaUrl';

export function resolveImageUrl(value?: string | null): string {
  return resolveMediaUrl(value) ?? '';
}
