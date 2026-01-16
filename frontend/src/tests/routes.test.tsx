import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { useAuthStore } from '../app/store/authStore';

describe('Route access control', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('redirects buyer from seller route to account', () => {
    useAuthStore.setState({
      user: { id: 'buyer-1', name: 'Покупатель', email: 'buyer@test.com', role: 'buyer' },
      token: 'token'
    });

    render(
      <MemoryRouter initialEntries={['/seller']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Личный кабинет')).toBeInTheDocument();
  });

  it('shows seller link only for seller', () => {
    useAuthStore.setState({
      user: { id: 'seller-1', name: 'Продавец', email: 'seller@test.com', role: 'seller' },
      token: 'token'
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('Продавец')).toBeInTheDocument();

    useAuthStore.setState({
      user: { id: 'buyer-1', name: 'Покупатель', email: 'buyer@test.com', role: 'buyer' },
      token: 'token'
    });

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.queryByText('Продавец')).not.toBeInTheDocument();
  });
});
