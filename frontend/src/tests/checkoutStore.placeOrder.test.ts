import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCheckoutStore } from '../features/checkout/model/useCheckoutStore';
import { checkoutApi } from '../features/checkout/api/checkoutApi';

vi.mock('../features/checkout/api/checkoutApi', () => ({
  checkoutApi: {
    fetchCheckout: vi.fn(),
    setDeliveryMethod: vi.fn(),
    setPickupPoint: vi.fn(),
    updateRecipient: vi.fn(),
    updateAddress: vi.fn(),
    setPaymentMethod: vi.fn(),
    addCard: vi.fn(),
    placeOrder: vi.fn()
  }
}));

const baseData = {
  recipient: { name: 'Иван', phone: '+79990000000', email: 'ivan@test.dev' },
  address: null,
  selectedDeliveryMethod: 'PICKUP_POINT' as const,
  selectedDeliverySubType: null,
  selectedPaymentMethod: 'CARD' as const,
  selectedCardId: 'card-1',
  sellerDropoffStationId: '',
  deliveryMethods: [],
  paymentMethods: [],
  savedCards: [],
  cartItems: [{ productId: 'p1', title: 'Товар', price: 100, quantity: 1 }]
};

describe('useCheckoutStore.placeOrder payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCheckoutStore.setState({
      data: null,
      isLoading: false,
      error: null,
      isSubmittingOrder: false
    });
  });

  it('sends provider=YANDEX_NDD and selected pvzId', async () => {
    vi.mocked(checkoutApi.placeOrder).mockResolvedValue({ orderId: 'order-1' });

    useCheckoutStore.setState({
      data: {
        ...baseData,
        selectedPickupPoint: {
          provider: 'YANDEX_NDD',
          pvzId: 'pvz-123',
          addressFull: 'Москва, ПВЗ 123'
        }
      }
    });

    const orderId = await useCheckoutStore.getState().placeOrder();

    expect(orderId).toBe('order-1');
    expect(checkoutApi.placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery: expect.objectContaining({
          buyerPickupPvz: expect.objectContaining({
            provider: 'YANDEX_NDD',
            pvzId: 'pvz-123'
          })
        })
      })
    );
  });

  it('does not send request when pvzId is missing and sets error', async () => {
    useCheckoutStore.setState({
      data: {
        ...baseData,
        selectedPickupPoint: {
          provider: 'YANDEX_NDD',
          pvzId: '   ',
          addressFull: 'Москва, ПВЗ'
        }
      }
    });

    const orderId = await useCheckoutStore.getState().placeOrder();

    expect(orderId).toBeNull();
    expect(checkoutApi.placeOrder).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().error).toContain('Выберите ПВЗ');
  });
});
