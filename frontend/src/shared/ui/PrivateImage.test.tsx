import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../api/api';
import { PrivateImage, privateMediaPath } from './PrivateImage';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('private media', () => {
  it('maps historical private paths to authorized endpoints', () => {
    expect(privateMediaPath('/uploads/chats/a.png')).toBe('/private-files/chats/a.png');
    expect(privateMediaPath('/uploads/returns/a.png')).toBe('/private-files/returns/legacy/a.png');
    expect(privateMediaPath('/uploads/product.png')).toBeNull();
  });

  it('loads a chat photo with authenticated blob request, never through its public URL', async () => {
    const request = vi.spyOn(apiClient, 'requestBlob').mockResolvedValue(new Blob(['photo'], { type: 'image/png' }));
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:private-photo', revokeObjectURL: () => {} });
    const view = render(<PrivateImage url="/uploads/chats/a.png" alt="Фото" openable />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Фото' })).toHaveAttribute('src', 'blob:private-photo'));
    expect(request).toHaveBeenCalledWith('/private-files/chats/a.png', expect.any(AbortSignal));
    expect(screen.getByRole('link')).not.toHaveAttribute('href', '/uploads/chats/a.png');
    view.unmount();
  });
});
