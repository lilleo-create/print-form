import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Footer } from './Footer';

describe('Footer', () => {
  it('contains only working buyer, seller, support and legal destinations', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    const footer = screen.getByRole('contentinfo');
    const buyer = within(footer).getByRole('navigation', { name: 'Покупателям' });
    expect(within(buyer).getByRole('link', { name: 'Заказы' })).toHaveAttribute('href', '/account?tab=orders');
    expect(within(buyer).getByRole('link', { name: 'Купленные товары' })).toHaveAttribute('href', '/account?tab=purchases');
    expect(within(footer).getByRole('navigation', { name: 'Продавцам' })).toHaveTextContent('Стать продавцом');
    expect(within(footer).getByRole('navigation', { name: 'Юридическая информация' })).toHaveTextContent('Оферта');
    expect(within(footer).queryByRole('link', { name: /О проекте|Производства|Материалы|Конфигуратор|Настройки/ })).not.toBeInTheDocument();
    expect(within(footer).getByText(/© 2026 Print-Form/)).toBeInTheDocument();
  });
});
