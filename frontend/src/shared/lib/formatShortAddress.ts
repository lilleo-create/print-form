export const formatShortAddress = (addressText: string) => {
  const parts = addressText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) {
    return parts.join(', ');
  }

  return parts.slice(-2).join(', ');
};
