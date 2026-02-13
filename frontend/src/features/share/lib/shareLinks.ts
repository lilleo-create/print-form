export const buildTelegramShareLink = (url: string, text: string) =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

export const buildWhatsappShareLink = (url: string, text: string) =>
  `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`.trim())}`;
