import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthPage } from '../pages/AuthPage';
import { useAuthStore } from '../app/store/authStore';

const fillAndSubmitLogin = async (phone: string, password: string) => {
  fireEvent.change(screen.getByPlaceholderText('+7 (___) ___-__-__'), { target: { value: phone } });
  fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
};

describe('Auth flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ user: null, token: null });
  });

  it('logs in with seeded credentials', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <AuthPage />
      </MemoryRouter>
    );

    await fillAndSubmitLogin('+7 (999) 000-00-00', 'buyer123');

    await waitFor(() => {
      expect(screen.getByText('Добро пожаловать!')).toBeInTheDocument();
    });
  });

  it('shows error on invalid credentials', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <AuthPage />
      </MemoryRouter>
    );

    await fillAndSubmitLogin('+7 (999) 000-00-00', 'wrongpass');

    await waitFor(() => {
      expect(
        screen.getByText('Неверный номер телефона или пароль.')
      ).toBeInTheDocument();
    });
  });
});
