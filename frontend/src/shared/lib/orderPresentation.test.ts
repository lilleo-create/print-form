import { describe, expect, it } from 'vitest';
import type { Order } from '../types';
import { getHumanOrderStatus, getOrderSteps, getSellerNextAction } from './orderPresentation';

const base = { id: 'one', status: 'PAID', paymentStatus: 'PAID', paidAt: '2026-10-30T10:00:00Z', items: [] } as unknown as Order;
const withState = (patch: Partial<Order>) => ({ ...base, ...patch });

describe('order timeline and next action', () => {
  it.each([
    ['PAID', {}, 'paid', 'production'],
    ['PRINTING', { status: 'PRINTING' }, 'production', 'pack'],
    ['PACKED', { status: 'PRINTING', isPacked: true, packedAt: '2026-10-30T12:00:00Z' }, 'packed', 'shipment'],
    ['CDEK CREATED', { status: 'READY_FOR_SHIPMENT', cdekOrderId: 'uuid' }, 'created', 'handoff'],
    ['HANDED', { status: 'HANDED_TO_DELIVERY', cdekOrderId: 'uuid' }, 'handed', 'tracking'],
    ['IN_TRANSIT', { status: 'IN_TRANSIT', cdekOrderId: 'uuid' }, 'transit', 'tracking'],
    ['READY_FOR_PICKUP', { status: 'IN_TRANSIT', cdekOrderId: 'uuid', shipment: { status: 'READY_FOR_PICKUP' } as Order['shipment'] }, 'pickup', 'tracking'],
    ['DELIVERED', { status: 'DELIVERED', cdekOrderId: 'uuid' }, 'delivered', null]
  ] as const)('%s seller state', (_name, patch, current, action) => {
    const order = withState(patch as Partial<Order>);
    expect(getOrderSteps(order, 'seller').find(step => step.current)?.key).toBe(current);
    expect(getSellerNextAction(order)).toBe(action);
    expect(getOrderSteps(order, 'buyer').some(step => step.key === 'packed')).toBe(false);
  });

  it('uses human copy for pending CDEK readback', () => {
    expect(getHumanOrderStatus(withState({ cdekOrderId: 'uuid', shipment: { id: 's', readbackStatus: 'PENDING' } as Order['shipment'] }))).toBe('Заявка создана в CDEK, подтверждаем данные');
  });
  it('does not invent event dates', () => {
    const steps = getOrderSteps(withState({ status: 'IN_TRANSIT', cdekOrderId: 'uuid' }), 'seller');
    expect(steps.find(step => step.key === 'handed')?.date).toBeNull();
    expect(steps.find(step => step.key === 'paid')?.date).toBe(base.paidAt);
  });
  it('shows buyer stages without seller-only preparation steps', () => {
    const order = withState({ status: 'IN_TRANSIT', cdekOrderId: 'uuid' });
    const steps = getOrderSteps(order, 'buyer');
    expect(steps.map(step => step.label)).toEqual([
      'Заказ оплачен', 'Продавец готовит заказ', 'Передан в CDEK',
      'В пути', 'Ждёт в пункте выдачи', 'Получен'
    ]);
    expect(steps.find(step => step.current)?.label).toBe('В пути');
  });
  it('shows payment waiting instead of a completed paid step', () => {
    const order = withState({ status: 'CREATED', paymentStatus: 'PENDING_PAYMENT', paidAt: null });
    expect(getOrderSteps(order, 'buyer')[0]).toMatchObject({ label: 'Ожидает оплаты', complete: false, date: null });
  });
});
