import { resolveMediaUrl } from './resolveMediaUrl';

export const resolveReturnPhotoUrl = (value?: string | null): string =>
  resolveMediaUrl(value) ?? '';
