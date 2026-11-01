import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, apiClient } from './api';

describe('chat message request bodies', () => {
  afterEach(() => vi.restoreAllMocks());

  it('omits frontend files from text-only JSON, even when files is empty', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue({ data: {} });
    await api.chats.sendMessage('support-1', { text: 'привет', files: [] });
    expect(request).toHaveBeenCalledWith('/chats/support-1/messages', {
      method: 'POST', body: { text: 'привет' }
    });
  });

  it('sends text and a photo as multipart data', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue({ data: {} });
    const photo = new File(['image'], 'photo.png', { type: 'image/png' });
    await api.chats.sendMessage('support-1', { text: 'привет', files: [photo] });
    const body = request.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('text')).toBe('привет');
    expect((body as FormData).getAll('files')).toEqual([photo]);
  });

  it('sends a photo-only message as multipart data', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue({ data: {} });
    const photo = new File(['image'], 'photo.png', { type: 'image/png' });
    await api.chats.sendMessage('support-1', { text: '', files: [photo] });
    const body = request.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('text')).toBe('');
    expect((body as FormData).getAll('files')).toEqual([photo]);
  });
});
