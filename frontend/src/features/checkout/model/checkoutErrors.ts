import { normalizeApiError } from '../../../shared/api/client';

const messages: Record<string, string> = {
  PRODUCT_NOT_FOUND: 'Товар больше недоступен. Обновите корзину.',
  PRODUCT_NOT_AVAILABLE: 'Товар больше недоступен. Обновите корзину.',
  SELLER_NOT_AVAILABLE: 'Товар сейчас недоступен для заказа.',
  VARIANT_INVALID: 'Выбранный вариант больше недоступен. Обновите корзину.',
  PRODUCT_PRICE_CHANGED: 'Цена товара изменилась. Обновите корзину и проверьте сумму.',
  CHECKOUT_CHANGED: 'Данные заказа изменились. Проверьте корзину и повторите оформление.',
  PVZ_INVALID: 'Проверьте выбранный пункт выдачи.',
  CDEK_PVZ_LOOKUP_FAILED: 'Не удалось проверить пункт выдачи. Повторите попытку позже.',
  QUANTITY_INVALID: 'Проверьте количество товаров в корзине.',
  DUPLICATE_ORDER_ITEM: 'В корзине повторяется одинаковый товар. Обновите корзину.'
};

export const checkoutErrorMessage = (error: unknown): string => {
  const normalized = normalizeApiError(error);
  return normalized.code ? messages[normalized.code] ?? 'Не удалось оформить заказ. Попробуйте ещё раз.'
    : 'Не удалось оформить заказ. Попробуйте ещё раз.';
};
