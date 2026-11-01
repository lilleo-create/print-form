import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PaymentCountdown } from './PaymentCountdown';

afterEach(() => vi.useRealTimers());

it('counts down from the server deadline, stops at zero and refreshes order once', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
  const onExpire = vi.fn();
  render(<PaymentCountdown paymentExpiresAt="2026-11-01T12:00:02Z" onExpire={onExpire} />);
  expect(screen.getByText(/00:02/)).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByText('Время на оплату истекло')).toBeInTheDocument();
  expect(onExpire).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(3000));
  expect(onExpire).toHaveBeenCalledTimes(1);
});
