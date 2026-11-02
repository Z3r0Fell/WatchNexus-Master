import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import VideoPlayer from '../components/VideoPlayer';
import { marmaladeMedia, marmaladeStream, marmaladeProgress } from '../services/marmaladeApi';
import { RouteErrorBoundary } from '../components/RouteErrorBoundary';

// jsdom lacks ResizeObserver (used by the Radix slider); browsers have it.
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

jest.mock('axios');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('../components/ui/sonner', () => ({ toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));
jest.mock('../services/marmaladeApi', () => {
  const actual = jest.requireActual('../services/marmaladeApi');
  return {
    ...actual,
    marmaladeMedia: { getMediaItem: jest.fn() },
    marmaladeStream: { getStreamUrl: jest.fn() },
    marmaladeProgress: { updateProgress: jest.fn(), markWatched: jest.fn() },
  };
});

// Shape returned by GET /api/marmalade/media/{id} (BridgeController.GetMediaItem),
// serialised by ASP.NET with the default camelCase policy.
const LIBRARY_ID = '3f2b9c1e-7a4d-4e1b-9d55-0c2a8f1e6b77';
const realMediaResponse = {
  id: LIBRARY_ID,
  title: 'Big Buck Bunny',
  overview: 'A rabbit.',
  file_path: null,
  file_size: 123456789,
  media_type: 'movie',
  tmdb_id: 10378,
  imdb_id: 'tt1254207',
  rating: 6.5,
  poster_url: null,
  backdrop_url: null,
  genres: 'Animation,Comedy',
  year: 2008,
  runtime: 10,
  library_id: 'lib-1',
  created_at: '2026-10-30T12:00:00Z',
};

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div data-testid="home">home</div>} />
        <Route
          path="/watch/:mediaId"
          element={<RouteErrorBoundary routeName="Video Player"><VideoPlayer /></RouteErrorBoundary>}
        />
      </Routes>
    </MemoryRouter>
  );

describe('VideoPlayer', () => {
  let consoleError;
  let consoleLog;
  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    axios.get.mockRejectedValue(new Error('404'));
    axios.post.mockRejectedValue(new Error('404'));
    marmaladeProgress.updateProgress.mockResolvedValue({});
    marmaladeProgress.markWatched.mockResolvedValue({});
  });
  afterEach(() => {
    consoleError.mockRestore();
    consoleLog.mockRestore();
  });

  test('renders the player for a library item using the real backend response shape', async () => {
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: realMediaResponse });
    marmaladeStream.getStreamUrl.mockResolvedValue(`http://localhost/api/marmalade/stream/${LIBRARY_ID}/file?token=abc`);

    renderAt(`/watch/${LIBRARY_ID}`);

    await waitFor(() => expect(screen.getByTestId('video-player')).toBeInTheDocument());
    expect(marmaladeMedia.getMediaItem).toHaveBeenCalledWith(LIBRARY_ID);
    expect(screen.getByText('Big Buck Bunny')).toBeInTheDocument();
    expect(screen.queryByText(/Error in Video Player/i)).not.toBeInTheDocument();
    const video = screen.getByTestId('video-player').querySelector('video');
    expect(video.getAttribute('src')).toContain(`/stream/${LIBRARY_ID}/file?token=abc`);
  });

  test('shows a graceful error with a back button when the media lookup 404s', async () => {
    const err = Object.assign(new Error('Request failed with status code 404'), {
      response: { status: 404, data: { detail: 'Media item not found' } },
    });
    marmaladeMedia.getMediaItem.mockRejectedValue(err);

    renderAt('/watch/550');

    await waitFor(() => expect(screen.getByText('Playback Error')).toBeInTheDocument());
    expect(screen.getByText(/not found in your library/i)).toBeInTheDocument();
    expect(screen.getByTestId('video-error-back-btn')).toBeInTheDocument();
    expect(screen.queryByText(/Error in Video Player/i)).not.toBeInTheDocument();
    expect(marmaladeStream.getStreamUrl).not.toHaveBeenCalled();
  });

  test('shows a graceful error when the stream cannot be authorised', async () => {
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: realMediaResponse });
    marmaladeStream.getStreamUrl.mockRejectedValue(new Error('No stream URL returned from server'));

    renderAt(`/watch/${LIBRARY_ID}`);

    await waitFor(() => expect(screen.getByText('Playback Error')).toBeInTheDocument());
    expect(screen.getByTestId('video-error-back-btn')).toBeInTheDocument();
    expect(screen.queryByText(/Error in Video Player/i)).not.toBeInTheDocument();
  });

  test('shows a graceful error (not a crash) when the <video> element cannot play the file', async () => {
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: realMediaResponse });
    marmaladeStream.getStreamUrl.mockResolvedValue('http://localhost/stream.mkv');

    renderAt(`/watch/${LIBRARY_ID}`);
    await waitFor(() => expect(screen.getByTestId('video-player')).toBeInTheDocument());

    const video = screen.getByTestId('video-player').querySelector('video');
    Object.defineProperty(video, 'error', { value: { code: 4 }, configurable: true });
    fireEvent.error(video);

    await waitFor(() => expect(screen.getByText('Playback Error')).toBeInTheDocument());
    expect(screen.getByText(/format not supported/i)).toBeInTheDocument();
    expect(screen.queryByText(/Error in Video Player/i)).not.toBeInTheDocument();
  });

  test('an unexpected render error inside the player shows the player error screen, not the route crash screen', async () => {
    // A malformed field (object where a string is expected) makes React throw during render.
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: { ...realMediaResponse, title: { en: 'Oops' } } });
    marmaladeStream.getStreamUrl.mockResolvedValue('http://localhost/stream.mp4');

    renderAt(`/watch/${LIBRARY_ID}`);

    await waitFor(() => expect(screen.getByText('Playback Error')).toBeInTheDocument());
    expect(screen.getByTestId('video-error-back-btn')).toBeInTheDocument();
    expect(screen.queryByText(/Error in Video Player/i)).not.toBeInTheDocument();
  });

  test('a non-object media payload (e.g. HTML from a proxy) is a graceful error', async () => {
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: '<!doctype html><html></html>' });

    renderAt(`/watch/${LIBRARY_ID}`);

    await waitFor(() => expect(screen.getByText('Playback Error')).toBeInTheDocument());
    expect(marmaladeStream.getStreamUrl).not.toHaveBeenCalled();
  });

  test('back button on a deep-linked player goes to the dashboard', async () => {
    marmaladeMedia.getMediaItem.mockRejectedValue(new Error('Network Error'));
    renderAt('/watch/x');
    await waitFor(() => expect(screen.getByTestId('video-error-back-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('video-error-back-btn'));
    await waitFor(() => expect(screen.getByTestId('home')).toBeInTheDocument());
  });

  test('back button returns to the previous page', async () => {
    marmaladeMedia.getMediaItem.mockRejectedValue(new Error('Network Error'));
    render(
      <MemoryRouter initialEntries={['/', '/watch/x']} initialIndex={1}>
        <Routes>
          <Route path="/" element={<div data-testid="home">home</div>} />
          <Route path="/watch/:mediaId" element={<VideoPlayer />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByTestId('video-error-back-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('video-error-back-btn'));
    await waitFor(() => expect(screen.getByTestId('home')).toBeInTheDocument());
  });
});
