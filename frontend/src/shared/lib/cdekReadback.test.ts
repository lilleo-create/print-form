import { describe, expect, it } from 'vitest';
import { cdekReadbackLabel } from './cdekReadback';
import { canCreateCdekShipment } from './orderFulfillment';

describe('CDEK readback seller status', () => {
  it('shows a human pending status without exposing an error code', () => {
    expect(cdekReadbackLabel('PENDING')).toBe('Заявка создана в CDEK, подтверждаем данные');
    expect(cdekReadbackLabel('AUTH_FAILED')).toBe('Заявка создана. Не удалось обновить данные доставки, статус уточняется.');
    expect(cdekReadbackLabel('VERIFIED')).toBeNull();
  });

  it('does not offer a second create action when a local CDEK UUID or shipment exists', () => {
    const base = { status: 'PRINTING', isPacked: true, readyForShipmentAt: null } as any;
    expect(canCreateCdekShipment(base, true)).toBe(true);
    expect(canCreateCdekShipment({ ...base, cdekOrderId: 'uuid-1' }, true)).toBe(false);
    expect(canCreateCdekShipment({ ...base, shipment: { id: 'shipment-1' } }, true)).toBe(false);
  });
});
