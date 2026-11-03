import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { getTrailerKey } from '../../pages/MediaDetails';
import { isSafeExternalUrl } from '../../pages/PluginMarketplacePage';
import { MusicPage } from '../../pages/MusicPage';
import MenuPage from '../../pages/MenuPage';
import { marmaladeLibrary, marmaladeMedia, marmaladeStream } from '../../services/marmaladeApi';

jest.mock('../../components/layout/Layout', () => ({
  Layout: ({ children }) => <div>{children}</div>,
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('../../hooks/use-confirm', () => ({
  useConfirm: () => ({ confirm: jest.fn(), ConfirmDialog: () => null }),
}));

jest.mock('../../services/marmaladeApi', () => ({
  marmaladeLibrary: { getLibraries: jest.fn(), addLibrary: jest.fn(), scanLibrary: jest.fn() },
  marmaladeMedia: { getMedia: jest.fn(), getRecent: jest.fn() },
  marmaladeStream: { getStreamUrl: jest.fn() },
  formatDuration: () => '0:00',
}));

describe('F3 audit: MediaDetails trailer key', () => {
  test('derives the YouTube trailer from raw TMDB videos', () => {
    const media = {
      videos: {
        results: [
          { site: 'Vimeo', type: 'Trailer', key: 'nope' },
          { site: 'YouTube', type: 'Teaser', key: 'teaser1' },
          { site: 'YouTube', type: 'Trailer', key: 'trailer1' },
        ],
      },
    };
    expect(getTrailerKey(media)).toBe('trailer1');
    expect(getTrailerKey({ trailer_key: 'x' })).toBe('x');
    expect(getTrailerKey({})).toBeNull();
    expect(getTrailerKey(null)).toBeNull();
  });
});

describe('F3 audit: PluginMarketplace external links', () => {
  test('only http(s) URLs are opened', () => {
    expect(isSafeExternalUrl('https://kodi.tv')).toBe(true);
    expect(isSafeExternalUrl('http://kodi.tv')).toBe(true);
    // eslint-disable-next-line no-script-url
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl(undefined)).toBe(false);
  });
});

describe('F3 audit: MusicPage playback', () => {
  let playSpy;
  beforeEach(() => {
    jest.clearAllMocks();
    playSpy = jest.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    jest.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    marmaladeLibrary.getLibraries.mockResolvedValue({ data: [{ id: 'l1', name: 'Music', media_type: 'music' }] });
    marmaladeMedia.getMedia.mockResolvedValue({ data: [{ id: 't1', title: 'Song One', file_size: 1024 }] });
    marmaladeMedia.getRecent.mockResolvedValue({ data: [] });
    marmaladeStream.getStreamUrl.mockResolvedValue('http://localhost/api/marmalade/stream/t1/file?token=abc');
  });
  afterEach(() => jest.restoreAllMocks());

  test('awaits the signed stream URL before playing', async () => {
    render(<MusicPage />);
    const row = await screen.findByText('Song One');
    await act(async () => { fireEvent.click(row); });
    await waitFor(() => expect(playSpy).toHaveBeenCalled());
    expect(marmaladeStream.getStreamUrl).toHaveBeenCalledWith('t1');
    const audio = playSpy.mock.instances[0];
    expect(audio.src).toBe('http://localhost/api/marmalade/stream/t1/file?token=abc');
    expect(audio.src).not.toContain('[object Promise]');
  });
});

describe('F3 audit: MenuPage search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockReset?.();
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/menu/search')) return Promise.resolve({ data: { results: [{ id: 7, title: 'Found Movie', media_type: 'movie' }] } });
      if (url.includes('/api/menu/discover/upcoming')) return Promise.resolve({ data: { results: [{ id: 9, title: 'Upcoming Movie', media_type: 'movie' }] } });
      if (url.includes('/api/menu/discover')) return Promise.resolve({ data: { results: [] } });
      if (url.includes('/requests/stats')) return Promise.resolve({ data: { total: 0 } });
      return Promise.resolve({ data: { results: [] } });
    });
  });

  test('search results are not replaced by the upcoming list', async () => {
    render(<MemoryRouter><MenuPage /></MemoryRouter>);
    const input = await screen.findByTestId('menu-search-input');
    fireEvent.change(input, { target: { value: 'found' } });
    await act(async () => { fireEvent.click(screen.getByTestId('menu-search-btn')); });
    await screen.findByText('Found Movie');
    // Let any effect-triggered fetch settle.
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.getByText('Found Movie')).toBeInTheDocument();
    expect(screen.queryByText('Upcoming Movie')).not.toBeInTheDocument();
    expect(axios.get.mock.calls.some(([u]) => u.includes('discover/upcoming'))).toBe(false);
  });
});
