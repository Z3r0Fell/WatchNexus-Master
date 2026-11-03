import { renderHook, act, render, screen, fireEvent } from '@testing-library/react';
import { apiClient, downloadsApi, streamingApi } from '../../services/api';
import marmaladeClient, { marmaladeProgress } from '../../services/marmaladeApi';
import { useConfirm } from '../../hooks/use-confirm';
import { usePrompt } from '../../hooks/use-prompt';
import { formatFileSize } from '../../lib/utils';

describe('F9 audit: query-bound endpoints send query params, not a JSON body', () => {
  afterEach(() => jest.restoreAllMocks());

  test('downloadsApi.add -> POST /downloads with params', async () => {
    const spy = jest.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
    await downloadsApi.add('T', 'movie', 5, 10);
    expect(spy).toHaveBeenCalledWith('/downloads', null, { params: { title: 'T', media_type: 'movie', tmdb_id: 5, size: 10 } });
  });

  test('downloadsApi.update -> PATCH with params', async () => {
    const spy = jest.spyOn(apiClient, 'patch').mockResolvedValue({ data: {} });
    await downloadsApi.update('d1', 'paused', 40);
    expect(spy).toHaveBeenCalledWith('/downloads/d1', null, { params: { status: 'paused', progress: 40 } });
  });

  test('streamingApi.update -> PUT with params', async () => {
    const spy = jest.spyOn(apiClient, 'put').mockResolvedValue({ data: {} });
    await streamingApi.update('netflix', true, 'u');
    expect(spy).toHaveBeenCalledWith('/streaming-services/netflix', null, { params: { enabled: true, username: 'u' } });
  });

  test('marmalade progress/watched -> query params', async () => {
    const spy = jest.spyOn(marmaladeClient, 'post').mockResolvedValue({ data: {} });
    await marmaladeProgress.updateProgress('m1', 123.4);
    await marmaladeProgress.markWatched('m1', false);
    expect(spy).toHaveBeenNthCalledWith(1, '/media/m1/progress', null, { params: { progress: 123.4 } });
    expect(spy).toHaveBeenNthCalledWith(2, '/media/m1/watched', null, { params: { watched: false } });
  });
});

describe('F9 audit: confirm/prompt settle on cancel', () => {
  test('useConfirm resolves false on cancel', async () => {
    const { result } = renderHook(() => useConfirm());
    let p;
    act(() => { p = result.current.confirm({ title: 'Delete?' }); });
    const { ConfirmDialog } = result.current;
    render(<ConfirmDialog />);
    fireEvent.click(screen.getByText('Cancel'));
    await expect(p).resolves.toBe(false);
  });

  test('usePrompt resolves null on cancel', async () => {
    const { result } = renderHook(() => usePrompt());
    let p;
    act(() => { p = result.current.prompt({ title: 'Name' }); });
    const { PromptDialog } = result.current;
    render(<PromptDialog />);
    fireEvent.click(screen.getByText('Cancel'));
    await expect(p).resolves.toBeNull();
  });
});

test('formatFileSize tolerates missing/huge values', () => {
  expect(formatFileSize(undefined)).toBe('0 B');
  expect(formatFileSize(0)).toBe('0 B');
  expect(formatFileSize(2048)).toBe('2 KB');
  expect(formatFileSize(1024 ** 6)).toMatch(/TB$/);
});
