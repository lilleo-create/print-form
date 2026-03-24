export type ProductColorOption = {
  value: string;
  label: string;
  hex: string;
  needsBorder?: boolean;
};

export const PRODUCT_COLOR_OPTIONS: ProductColorOption[] = [
  { value: 'white', label: 'Белый', hex: '#ffffff', needsBorder: true },
  { value: 'black', label: 'Черный', hex: '#111111' },
  { value: 'gray', label: 'Серый', hex: '#9ca3af' },
  { value: 'silver', label: 'Серебристый', hex: '#c0c0c0' },
  { value: 'graphite', label: 'Графитовый', hex: '#4b5563' },
  { value: 'red', label: 'Красный', hex: '#dc2626' },
  { value: 'burgundy', label: 'Бордовый', hex: '#7f1d1d' },
  { value: 'pink', label: 'Розовый', hex: '#ec4899' },
  { value: 'peach', label: 'Персиковый', hex: '#fdba74' },
  { value: 'orange', label: 'Оранжевый', hex: '#f97316' },
  { value: 'yellow', label: 'Желтый', hex: '#facc15', needsBorder: true },
  { value: 'gold', label: 'Золотой', hex: '#ca8a04' },
  { value: 'beige', label: 'Бежевый', hex: '#d6b88d' },
  { value: 'brown', label: 'Коричневый', hex: '#7c2d12' },
  { value: 'green', label: 'Зеленый', hex: '#16a34a' },
  { value: 'lime', label: 'Салатовый', hex: '#84cc16' },
  { value: 'turquoise', label: 'Бирюзовый', hex: '#14b8a6' },
  { value: 'sky', label: 'Голубой', hex: '#0ea5e9' },
  { value: 'blue', label: 'Синий', hex: '#2563eb' },
  { value: 'navy', label: 'Темно-синий', hex: '#1e3a8a' },
  { value: 'purple', label: 'Фиолетовый', hex: '#7c3aed' },
  { value: 'lilac', label: 'Сиреневый', hex: '#a78bfa' },
  { value: 'transparent', label: 'Прозрачный', hex: 'linear-gradient(135deg, #f8fafc 40%, #cbd5e1 40% 60%, #f8fafc 60%)', needsBorder: true },
  { value: 'multicolor', label: 'Многоцветный', hex: 'linear-gradient(90deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7)' },
];

const colorAliases = new Map<string, string>();

for (const option of PRODUCT_COLOR_OPTIONS) {
  colorAliases.set(option.value.toLowerCase(), option.label);
  colorAliases.set(option.label.toLowerCase(), option.label);
}

export const normalizeProductColor = (rawColor: string): string => {
  const normalized = rawColor.trim().toLowerCase();
  return colorAliases.get(normalized) ?? rawColor.trim();
};

export const findColorOptionByLabel = (label: string): ProductColorOption | null => {
  const target = label.trim().toLowerCase();
  return PRODUCT_COLOR_OPTIONS.find((option) => option.label.toLowerCase() === target) ?? null;
};
