import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PackingGuideModal } from './PackingGuideModal';

afterEach(cleanup);

it('explains how to protect, box, weigh and measure the finished parcel', () => {
  render(<PackingGuideModal onClose={() => undefined} />);
  expect(screen.getByText('Как подготовить заказ к отправке')).toBeTruthy();
  expect(screen.getByText('Защитите товар')).toBeTruthy();
  expect(screen.getByText('Упакуйте в коробку')).toBeTruthy();
  expect(screen.getByText('Взвесьте и измерьте')).toBeTruthy();
  expect(screen.getByText(/можно использовать свои или приобрести в CDEK/)).toBeTruthy();
});
