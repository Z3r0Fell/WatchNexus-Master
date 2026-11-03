import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import axios from 'axios';
import { toWebVtt } from '../../components/VideoPlayer';
import { HeroBanner } from '../../components/media/HeroBanner';
import { MemoryRouter } from 'react-router-dom';

jest.mock('axios');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('../../hooks/use-confirm', () => ({
  useConfirm: () => ({ confirm: jest.fn(() => Promise.resolve(true)), ConfirmDialog: () => null }),
}));
jest.mock('../../hooks/use-prompt', () => ({
  usePrompt: () => ({ prompt: jest.fn(() => Promise.resolve('My List')), PromptDialog: () => null }),
}));

describe('F6 audit regressions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('toWebVtt converts SRT timestamps and adds header', () => {
    const srt = '﻿1\r\n00:00:01,500 --> 00:00:03,250\r\nHello\r\n';
    const vtt = toWebVtt(srt);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:01.500 --> 00:00:03.250');
    expect(vtt).not.toContain('\r');
  });

  test('toWebVtt passes WebVTT through unchanged', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n';
    expect(toWebVtt(vtt)).toBe(vtt);
  });

  test('PlaylistsManager reads the bare-array playlist response and creates via JSON body', async () => {
    const { PlaylistsManager } = require('../../components/drizzle/PlaylistComponents');
    axios.get.mockImplementation((url) => {
      if (url.endsWith('/api/drizzle/playlists')) {
        return Promise.resolve({ data: [{ id: 'p1', name: 'Existing', item_count: 2 }] });
      }
      return Promise.resolve({ data: [] });
    });
    axios.post.mockResolvedValue({ data: { id: 'p2', name: 'My List', status: 'created' } });

    render(<PlaylistsManager />);
    expect(await screen.findByText('Existing')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('create-playlist-btn'));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/drizzle\/playlists$/), { name: 'My List' },
    ));
    expect(await screen.findByText('My List')).toBeInTheDocument();
  });

  test('PlaylistCard exposes a working delete button', () => {
    const { PlaylistCard } = require('../../components/drizzle/PlaylistComponents');
    const onDelete = jest.fn();
    const onSelect = jest.fn();
    render(<PlaylistCard playlist={{ id: 'p1', name: 'X', item_count: 0 }} onSelect={onSelect} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('delete-playlist-p1'));
    expect(onDelete).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('HeroBanner add button is only rendered when wired, and calls the handler', () => {
    const item = { id: 1, title: 'Movie', media_type: 'movie' };
    const { rerender } = render(<MemoryRouter><HeroBanner items={[item]} autoRotate={false} /></MemoryRouter>);
    expect(screen.queryByTestId('hero-add-btn')).toBeNull();
    const onAdd = jest.fn();
    rerender(<MemoryRouter><HeroBanner items={[item]} autoRotate={false} onAddToWatchlist={onAdd} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('hero-add-btn'));
    expect(onAdd).toHaveBeenCalledWith(item);
  });
});
