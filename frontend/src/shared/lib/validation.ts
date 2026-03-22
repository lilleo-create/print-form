export const normalizePhone = (v: string) => (v ?? '').replace(/\D/g, '');

export const toCanonicalRuPhone = (input: string) => {
  const digits = normalizePhone(input);
  const localDigits = digits.length >= 10 ? digits.slice(-10) : digits;

  if (localDigits.length !== 10) {
    return input.trim();
  }

  return `+7${localDigits}`;
};

export const isRuPhone = (input: string) => {
  const digits = normalizePhone(input);

  // Допускаем 11 цифр, начинается на 7 или 8
  if (digits.length !== 11) return false;
  if (!(digits.startsWith('7') || digits.startsWith('8'))) return false;

  // Приводим к виду 7XXXXXXXXXX
  const normalized = digits.startsWith('8') ? `7${digits.slice(1)}` : digits;

  // После нормализации должно быть 11 и начинаться на 7
  return normalized.length === 11 && normalized.startsWith('7');
};

export const toE164Ru = (input: string) => {
  return toCanonicalRuPhone(input);
};
export const formatRuPhoneInput = (value: string) => {
  const digits = normalizePhone(value);

  // убираем лидирующие 7/8
  let d = digits;
  if (d.startsWith('7')) d = d.slice(1);
  if (d.startsWith('8')) d = d.slice(1);

  // максимум 10 цифр (без +7)
  d = d.slice(0, 10);

  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 8);
  const p4 = d.slice(8, 10);

  if (d.length === 0) return '';
  if (d.length <= 3) return `+7 (${p1}`;
  if (d.length <= 6) return `+7 (${p1}) ${p2}`;
  if (d.length <= 8) return `+7 (${p1}) ${p2}-${p3}`;
  return `+7 (${p1}) ${p2}-${p3}-${p4}`;
};

export const isValidEmailOptional = (v?: string) => {
  const s = (v ?? '').trim();
  if (!s) return true;
  // простая, но нормальная проверка
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
};
