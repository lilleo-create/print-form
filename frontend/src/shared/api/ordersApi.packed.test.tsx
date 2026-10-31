import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { api } from './index';
import { ordersApi } from './ordersApi';
import { PackedOrderModal } from '../../components/orders/PackedOrderModal';
import { canCreateCdekShipment, readyToShipDisabledReason } from '../lib/orderFulfillment';

vi.mock('./index', () => ({ api: { getSellerOrders: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const rawOrder = (isPacked = true) => ({
  id: 'order-18', publicNumber: 'PF-18', buyerId: 'buyer-1',
  status: 'PRINTING', paymentStatus: 'PAID', paidAt: '2026-10-31T18:00:00.000Z',
  isPacked, packedWeightGrams: isPacked ? 400 : null,
  packedLengthCm: isPacked ? 15 : null,
  packedWidthCm: isPacked ? 15 : null,
  packedHeightCm: isPacked ? 15 : null,
  packedDeliveryAmountKopecks: isPacked ? 20475 : null,
  packedAt: isPacked ? '2026-10-31T19:28:26.500Z' : null,
  packedQuoteCalculatedAt: isPacked ? '2026-10-31T19:28:26.500Z' : null,
  checkoutDeliveryEstimateKopecks: 20475,
  actualDeliveryAmountKopecks: null,
  actualDeliveryUpdatedAt: null,
  financials: { sellerNetAfterDeliveryAmount: 129425 },
  sellerDropoffPvzMeta: { addressFull: 'PVZ' },
  buyerPickupPvzMeta: { addressFull: 'PVZ' },
  shippingAddressId: 'address-1', total: 149900,
  createdAt: '2026-10-31T17:00:00.000Z',
  items: [{ id: 'item-1', productId: 'product-1', quantity: 1,
    priceAtPurchase: 149900, product: { sellerId: 'seller-1' } }]
});

describe('seller packed order mapping', () => {
  it('keeps pending CDEK readback from seller orders and hides another create action', async () => {
    const raw = { ...rawOrder(), cdekOrderId: 'cdek-uuid',
      shipment: { id: 'shipment-1', provider: 'CDEK', status: 'READY_TO_SHIP',
        sourceStationId: 'SPB123', readbackStatus: 'PENDING' } };
    vi.mocked(api.getSellerOrders).mockResolvedValue({ data: { data: [raw] } } as never);
    const [order] = await ordersApi.listBySeller('seller-1');
    expect(order.shipment?.readbackStatus).toBe('PENDING');
    expect(canCreateCdekShipment(order, true)).toBe(false);
  });
  it('keeps packed parcel and delivery economics fields, enabling ready-to-ship', async () => {
    vi.mocked(api.getSellerOrders).mockResolvedValue({ data: { data: [rawOrder()] } } as never);
    const [order] = await ordersApi.listBySeller('seller-1');
    expect(order).toMatchObject({
      isPacked: true, packedWeightGrams: 400, packedLengthCm: 15,
      packedWidthCm: 15, packedHeightCm: 15,
      packedDeliveryAmountKopecks: 20475,
      packedAt: '2026-10-31T19:28:26.500Z',
      packedQuoteCalculatedAt: '2026-10-31T19:28:26.500Z',
      checkoutDeliveryEstimateKopecks: 20475,
      actualDeliveryAmountKopecks: null,
      actualDeliveryUpdatedAt: null
    });
    expect(readyToShipDisabledReason(order, null)).toBeNull();
  });

  it('reopens packing modal with the saved parcel values', async () => {
    vi.mocked(api.getSellerOrders).mockResolvedValue({ data: { data: [rawOrder()] } } as never);
    const [order] = await ordersApi.listBySeller('seller-1');
    render(<PackedOrderModal sellerNetBeforeDeliveryKopecks={149900}
      initial={{ weightGrams: order.packedWeightGrams ?? undefined,
        lengthCm: order.packedLengthCm ?? undefined,
        widthCm: order.packedWidthCm ?? undefined,
        heightCm: order.packedHeightCm ?? undefined }}
      onClose={() => undefined} onQuote={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getAllByRole('spinbutton').map(input => (input as HTMLInputElement).value))
      .toEqual(['400', '15', '15', '15']);
  });

  it('keeps an unpacked order blocked', async () => {
    vi.mocked(api.getSellerOrders).mockResolvedValue({ data: { data: [rawOrder(false)] } } as never);
    const [order] = await ordersApi.listBySeller('seller-1');
    expect(readyToShipDisabledReason(order, null)).toBe('Сначала укажите параметры готовой посылки');
  });

  it('keeps confirmed actual delivery cost and update time', async () => {
    const raw = { ...rawOrder(), actualDeliveryAmountKopecks: 26100,
      actualDeliveryUpdatedAt: '2026-11-01T08:00:00.000Z' };
    vi.mocked(api.getSellerOrders).mockResolvedValue({ data: { data: [raw] } } as never);
    const [order] = await ordersApi.listBySeller('seller-1');
    expect(order.actualDeliveryAmountKopecks).toBe(26100);
    expect(order.actualDeliveryUpdatedAt).toBe('2026-11-01T08:00:00.000Z');
  });
});
