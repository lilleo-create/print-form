import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PackingGuideModal } from './PackingGuideModal';

afterEach(cleanup);

it('shows five illustrated steps and changes them only with manual controls', () => {
  render(<PackingGuideModal onClose={() => undefined} />);
  expect(screen.getByText('Подготовьте товар')).toBeTruthy();
  expect(screen.getByRole('img', { name: /изделие/i })).toBeTruthy();
  expect(screen.queryByText('Защитите товар')).toBeNull();
  expect(screen.getByRole('button', { name: 'Назад' })).toHaveProperty('disabled', true);

  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  expect(screen.getByText('Защитите товар')).toBeTruthy();
  expect(screen.getByRole('img', { name: /пузырчатая плёнка/i })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
  expect(screen.getByText('Подготовьте товар')).toBeTruthy();

  for (let step = 0; step < 4; step++) fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  expect(screen.getByText('Сдача в CDEK')).toBeTruthy();
  expect(screen.getByRole('img', { name: /пункт CDEK/i })).toBeTruthy();
  expect(screen.getByText('5 / 5')).toBeTruthy();
});
