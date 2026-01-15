import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { useAuthStore } from '../app/store/authStore';

describe('Route access control', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({
      user: { id: 'buyer-1', name: 'Алина Смирнова', email: 'buyer@3dmarket.ru', role: 'buyer' },
      token: 'token'
    });
  });

  it('redirects buyer from seller route to account', () => {
    render(
      <MemoryRouter initialEntries={["/seller"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Личный кабинет')).toBeInTheDocument();
  });
});
