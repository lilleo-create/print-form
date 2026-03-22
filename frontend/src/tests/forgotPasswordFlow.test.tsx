import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { api } from '../shared/api';

vi.mock('../shared/api', () => ({
  api: {
    requestPasswordReset: vi.fn(),
    otpStatus: vi.fn(),
    verifyPasswordReset: vi.fn(),
    confirmPasswordReset: vi.fn()
  }
}));

describe('Forgot password recovery flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats nested successful recovery response as call confirmation flow without false error', async () => {
    vi.mocked(api.requestPasswordReset).mockResolvedValue({
      data: {
        success: true,
        data: {
          delivery: {
            verificationType: 'call_to_auth',
            callToAuthNumber: '78005553535',
            phone: '79990000000',
            expiresInSec: 120
          }
        }
      }
    } as never);

    render(
      <MemoryRouter initialEntries={['/auth/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('+7 (___) ___-__-__'), {
      target: { value: '+7 (999) 000-00-00' }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    });

    expect(await screen.findByText('Ожидаем подтверждение звонком')).toBeInTheDocument();
    expect(screen.getByText(/Подтверждение выполняется автоматически после звонка/i)).toBeInTheDocument();
    expect(screen.queryByText('Не удалось запустить подтверждение звонком. Попробуйте ещё раз.')).not.toBeInTheDocument();
    expect(vi.mocked(api.otpStatus)).not.toHaveBeenCalled();
  });

  it('shows call confirmation UI without legacy code copy or early retry CTA', async () => {
    vi.mocked(api.requestPasswordReset).mockResolvedValue({
      data: {
        delivery: {
          requestId: 'req-1',
          verificationType: 'call_to_auth',
          callToAuthNumber: '78005553535',
          phone: '79990000000',
          expiresInSec: 120
        }
      }
    } as never);
    vi.mocked(api.otpStatus).mockResolvedValue({ data: { data: { status: 'pending' } } } as never);

    render(
      <MemoryRouter initialEntries={['/auth/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('+7 (___) ___-__-__'), {
      target: { value: '+7 (999) 000-00-00' }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    });

    expect(await screen.findByText('Ожидаем подтверждение звонком')).toBeInTheDocument();
    expect(screen.getByText(/Подтверждение выполняется автоматически после звонка/i)).toBeInTheDocument();
    expect(screen.queryByText('Код подтверждения')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Запросить звонок повторно' })).not.toBeInTheDocument();
  });

  it('shows retry CTA after confirmation timeout', async () => {
    vi.mocked(api.requestPasswordReset).mockResolvedValue({
      data: {
        delivery: {
          requestId: 'req-1',
          verificationType: 'call_to_auth',
          callToAuthNumber: '78005553535',
          phone: '79990000000',
          expiresInSec: 5
        }
      }
    } as never);
    vi.mocked(api.otpStatus).mockResolvedValue({ data: { data: { status: 'expired' } } } as never);

    render(
      <MemoryRouter initialEntries={['/auth/forgot-password']}>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('+7 (___) ___-__-__'), {
      target: { value: '+7 (999) 000-00-00' }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    });

    expect(await screen.findByText('Ожидаем подтверждение звонком')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Запросить звонок повторно' })).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByText('Подтверждение звонком не завершилось вовремя. Запросите звонок повторно.')).toBeInTheDocument();

  }, 10000);
});
