export const getShortOrderId = (id: string): string => {
  const safeId = id ?? '';
  return `PF-${safeId.slice(-8).toUpperCase()}`;
};
