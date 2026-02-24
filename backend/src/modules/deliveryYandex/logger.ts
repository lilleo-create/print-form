/**
 * Unified log format for delivery Yandex module. Every Yandex call should log once in this shape.
 */

import type { CorrelationId } from './domain/types';

export type LogOperation =
  | 'pickupPoints.list'
  | 'location.detect'
  | 'offers.create'
  | 'offers.confirm'
  | 'offers.info'
  | 'request.create'
  | 'request.info'
  | 'request.actual_info'
  | 'request.history'
  | 'request.cancel';

export type DeliveryYandexLogPayload = {
  operation: LogOperation;
  requestId?: CorrelationId | string;
  yandexRequestId?: string | null;
  durationMs: number;
  /** Key params (no tokens) */
  params?: Record<string, unknown>;
  result: 'ok' | 'error';
  errorCode?: string | null;
};

export function logDeliveryYandex(payload: DeliveryYandexLogPayload): void {
  const level = payload.result === 'ok' ? 'info' : 'error';
  (console[level] as (msg: string, obj: unknown) => void)(
    '[DELIVERY_YANDEX]',
    payload
  );
}
