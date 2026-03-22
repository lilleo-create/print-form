import { act, render, screen } from '@testing-library/react';
import { DeviceVerificationStep } from '../pages/DeviceVerificationStep';

describe('DeviceVerificationStep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls verification status and completes login without reload', async () => {
    const onCheckStatus = vi.fn(async () => ({
      status: 'verified' as const,
      verificationResult: 'approved'
    }));
    const onComplete = vi.fn(async () => undefined);
    const onSuccess = vi.fn();
    const setMessage = vi.fn();
    const setError = vi.fn();
    const onBack = vi.fn();

    render(
      <DeviceVerificationStep
        tempToken="temp-token"
        verification={{
          channel: 'PHONE_CALL',
          phone: '79990000000',
          reason: 'Новое устройство'
        }}
        onCheckStatus={onCheckStatus}
        onComplete={onComplete}
        onSuccess={onSuccess}
        onBack={onBack}
        setMessage={setMessage}
        setError={setError}
      />
    );

    expect(screen.getByText('Подтвердите вход')).toBeInTheDocument();
    expect(screen.getByText('Мы позвоним на номер +7 (999) 000-00-00')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onCheckStatus).toHaveBeenCalledWith('temp-token');
    expect(onComplete).toHaveBeenCalledWith({ verificationResult: 'approved' }, 'temp-token');
    expect(onSuccess).toHaveBeenCalled();
  });
});
