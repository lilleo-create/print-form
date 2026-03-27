import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewsList } from '../pages/product-reviews/components/ReviewsList';
import { api } from '../shared/api';

vi.mock('../shared/api', () => ({
  api: {
    getReviewReplies: vi.fn(),
    setReviewReaction: vi.fn(),
    updateReview: vi.fn(),
    deleteReview: vi.fn(),
    createReviewReply: vi.fn(),
    updateReviewReply: vi.fn(),
    deleteReviewReply: vi.fn()
  }
}));

describe('ReviewsList reply edit', () => {
  it('shows readable error when reply update fails and keeps edit mode active', async () => {
    vi.mocked(api.updateReviewReply).mockRejectedValue({
      status: 404,
      payload: { error: { code: 'NOT_FOUND' } }
    });

    render(
      <ReviewsList
        reviews={[
          {
            id: 'review-1',
            productId: 'product-1',
            rating: 5,
            pros: 'Плюсы',
            cons: 'Минусы',
            comment: 'Комментарий',
            createdAt: '2026-03-01T10:00:00.000Z',
            replies: [
              {
                id: 'reply-1',
                reviewId: 'review-1',
                text: 'Старый ответ',
                createdAt: '2026-03-02T10:00:00.000Z',
                authorType: 'SELLER',
                isCurrentStoreReply: true,
                canEdit: true
              }
            ]
          }
        ]}
        status="success"
        error={null}
        onPhotoClick={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '⋮' }));
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать' }));

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Новый текст ответа' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(
        screen.getByText('Ответ не найден. Обновите страницу и попробуйте снова.')
      ).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Новый текст ответа')).toBeInTheDocument();
  });
});
