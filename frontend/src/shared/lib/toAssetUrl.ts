// shared/lib/toAssetUrl.ts
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function toAssetUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  // важно из-за пробелов и кириллицы
  return new URL(encodeURI(path), API_BASE).toString();
}
