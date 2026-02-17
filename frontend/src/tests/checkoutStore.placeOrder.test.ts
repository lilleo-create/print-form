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
    startPayment: vi.fn()
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
    vi.mocked(checkoutApi.startPayment).mockResolvedValue({ orderId: 'order-1', paymentId: 'pay-1', paymentUrl: 'https://pay' });

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

    const result = await useCheckoutStore.getState().placeOrder();

    expect(result?.orderId).toBe('order-1');
    expect(checkoutApi.startPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: {
          name: 'Иван',
          phone: '+79990000000',
          email: 'ivan@test.dev'
        },
        packagesCount: 1,
        buyerPickupPvz: expect.objectContaining({
          provider: 'YANDEX_NDD',
          pvzId: 'pvz-123'
        })
      })
    );
  });



  it('prevents duplicate submit while payment is in progress', async () => {
    let resolveCall: ((value: { orderId: string; paymentId: string; paymentUrl: string }) => void) | null = null;
    vi.mocked(checkoutApi.startPayment).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCall = resolve;
        })
    );

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

    const first = useCheckoutStore.getState().placeOrder();
    const second = useCheckoutStore.getState().placeOrder();

    expect(await second).toBeNull();
    expect(checkoutApi.startPayment).toHaveBeenCalledTimes(1);

    resolveCall?.({ orderId: 'order-1', paymentId: 'pay-1', paymentUrl: 'https://pay' });
    await first;
  });


  it('shows non-blocking warning when delivery config is missing on startPayment', async () => {
    vi.mocked(checkoutApi.startPayment).mockResolvedValue({
      orderId: 'order-1',
      paymentId: 'pay-1',
      paymentUrl: 'https://pay',
      deliveryConfigMissing: true,
      blockingReason: 'SELLER_DROPOFF_PVZ_REQUIRED'
    });

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

    const result = await useCheckoutStore.getState().placeOrder();

    expect(result?.paymentId).toBe('pay-1');
    expect(useCheckoutStore.getState().error).toContain('Нужно настроить точку отгрузки продавца');
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

    const result = await useCheckoutStore.getState().placeOrder();

    expect(result).toBeNull();
    expect(checkoutApi.startPayment).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().error).toContain('Выберите ПВЗ');
  });
});
