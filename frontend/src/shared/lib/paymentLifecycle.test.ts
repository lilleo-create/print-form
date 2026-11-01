import { describe, expect, it } from 'vitest';
import type { Order } from '../types';
import { buyerCancellationAction, paymentSecondsRemaining } from './paymentLifecycle';

const order = (status: string, paymentStatus: string, extras: Partial<Order> = {}) => ({
  id: 'order-1', status, paymentStatus, items: [], paidAt: paymentStatus === 'PAID' ? '2026-11-01T12:00:00.000Z' : null,
  ...extras
}) as Order;

describe('buyer payment and cancellation presentation', () => {
  it('uses the server deadline for the countdown', () => {
    expect(paymentSecondsRemaining('2026-11-01T12:20:00.000Z', Date.parse('2026-11-01T12:00:18.000Z'))).toBe(1182);
    expect(paymentSecondsRemaining('2026-11-01T12:20:00.000Z', Date.parse('2026-11-01T12:21:00.000Z'))).toBe(0);
  });
  it('allows self cancellation only before production starts', () => {
    expect(buyerCancellationAction(order('CREATED', 'PENDING_PAYMENT'))).toBe('cancel');
    expect(buyerCancellationAction(order('PAID', 'PAID'))).toBe('cancel');
    expect(buyerCancellationAction(order('PRINTING', 'PAID'))).toBe('request');
    expect(buyerCancellationAction(order('READY_FOR_SHIPMENT', 'PAID', { cdekOrderId: 'cdek-1' }))).toBe('support');
    expect(buyerCancellationAction(order('DELIVERED', 'PAID'))).toBeNull();
  });
});
