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
    marmaladeStream: { getStreamUrl: jest.fn(), authorizePlayback: jest.fn() },
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

// Shape returned by marmaladeStream.authorizePlayback for a browser-native file.
const direct = (url) => ({
  streamUrl: url, directPlay: true, directUrl: url, transcodeUrl: null,
  mode: 'direct', reason: null, duration: null,
});

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
    marmaladeStream.authorizePlayback.mockResolvedValue(direct(`http://localhost/api/marmalade/stream/${LIBRARY_ID}/file?token=abc`));

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
    expect(marmaladeStream.authorizePlayback).not.toHaveBeenCalled();
  });

  test('shows a graceful error when the stream cannot be authorised', async () => {
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: realMediaResponse });
    marmaladeStream.authorizePlayback.mockRejectedValue(new Error('No stream URL returned from server'));

    renderAt(`/watch/${LIBRARY_ID}`);

    await waitFor(() => expect(screen.getByText('Playback Error')).toBeInTheDocument());
    expect(screen.getByTestId('video-error-back-btn')).toBeInTheDocument();
    expect(screen.queryByText(/Error in Video Player/i)).not.toBeInTheDocument();
  });

  test('shows a graceful error (not a crash) when the <video> element cannot play the file', async () => {
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: realMediaResponse });
    marmaladeStream.authorizePlayback.mockResolvedValue(direct('http://localhost/stream.mkv'));

    renderAt(`/watch/${LIBRARY_ID}`);
    await waitFor(() => expect(screen.getByTestId('video-player')).toBeInTheDocument());

    const video = screen.getByTestId('video-player').querySelector('video');
    Object.defineProperty(video, 'error', { value: { code: 4 }, configurable: true });
    fireEvent.error(video);

    await waitFor(() => expect(screen.getByText('Playback Error')).toBeInTheDocument());
    // No server-side transcode available → the message names the missing component.
    expect(screen.getByText(/not supported/i)).toBeInTheDocument();
    expect(screen.getByText(/FFmpeg/)).toBeInTheDocument();
    expect(screen.queryByText(/Error in Video Player/i)).not.toBeInTheDocument();
  });

  test('an unexpected render error inside the player shows the player error screen, not the route crash screen', async () => {
    // A malformed field (object where a string is expected) makes React throw during render.
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: { ...realMediaResponse, title: { en: 'Oops' } } });
    marmaladeStream.authorizePlayback.mockResolvedValue(direct('http://localhost/stream.mp4'));

    renderAt(`/watch/${LIBRARY_ID}`);

    await waitFor(() => expect(screen.getByText('Playback Error')).toBeInTheDocument());
    expect(screen.getByTestId('video-error-back-btn')).toBeInTheDocument();
    expect(screen.queryByText(/Error in Video Player/i)).not.toBeInTheDocument();
  });

  test('a non-object media payload (e.g. HTML from a proxy) is a graceful error', async () => {
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: '<!doctype html><html></html>' });

    renderAt(`/watch/${LIBRARY_ID}`);

    await waitFor(() => expect(screen.getByText('Playback Error')).toBeInTheDocument());
    expect(marmaladeStream.authorizePlayback).not.toHaveBeenCalled();
  });

  test('back button on a deep-linked player goes to the dashboard', async () => {
    marmaladeMedia.getMediaItem.mockRejectedValue(new Error('Network Error'));
    renderAt('/watch/x');
    await waitFor(() => expect(screen.getByTestId('video-error-back-btn')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('video-error-back-btn'));
    await waitFor(() => expect(screen.getByTestId('home')).toBeInTheDocument());
  });

  // ── Server-side conversion (MKV/AVI/HEVC/AC3 …) ──────────────────
  const TRANSCODE = `http://localhost/api/marmalade/stream/${LIBRARY_ID}/transcode?token=abc`;
  const DIRECT = `http://localhost/api/marmalade/stream/${LIBRARY_ID}/file?token=abc`;
  const videoEl = () => screen.getByTestId('video-player').querySelector('video');

  test('plays the ffmpeg stream when the server says the file is not browser-playable', async () => {
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: realMediaResponse });
    marmaladeStream.authorizePlayback.mockResolvedValue({
      streamUrl: TRANSCODE, directPlay: false, directUrl: DIRECT, transcodeUrl: TRANSCODE,
      mode: 'transcode', reason: 'hevc video is not browser-playable', duration: 600,
    });

    renderAt(`/watch/${LIBRARY_ID}`);
    await waitFor(() => expect(screen.getByTestId('video-player')).toBeInTheDocument());

    expect(videoEl().getAttribute('src')).toBe(TRANSCODE);
    expect(videoEl().getAttribute('data-playback-mode')).toBe('transcode');
    // Duration comes from the server probe (a piped stream has none).
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });

  test('seeking a transcoded stream reopens it at the target time', async () => {
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: realMediaResponse });
    marmaladeStream.authorizePlayback.mockResolvedValue({
      streamUrl: TRANSCODE, directPlay: false, directUrl: DIRECT, transcodeUrl: TRANSCODE,
      mode: 'remux', reason: 'mkv', duration: 600,
    });

    renderAt(`/watch/${LIBRARY_ID}`);
    await waitFor(() => expect(screen.getByTestId('video-player')).toBeInTheDocument());

    fireEvent.keyDown(document, { key: 'ArrowRight' });

    await waitFor(() => expect(videoEl().getAttribute('src')).toBe(`${TRANSCODE}&start=10.00`));
    expect(videoEl().getAttribute('data-playback-mode')).toBe('remux');
    expect(screen.getByText('0:10')).toBeInTheDocument();
  });

  test('falls back to the ffmpeg stream when direct play cannot decode the file', async () => {
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: realMediaResponse });
    marmaladeStream.authorizePlayback.mockResolvedValue({
      streamUrl: DIRECT, directPlay: true, directUrl: DIRECT, transcodeUrl: TRANSCODE,
      mode: 'direct', reason: null, duration: 600,
    });

    renderAt(`/watch/${LIBRARY_ID}`);
    await waitFor(() => expect(screen.getByTestId('video-player')).toBeInTheDocument());
    expect(videoEl().getAttribute('src')).toBe(DIRECT);

    Object.defineProperty(videoEl(), 'error', { value: { code: 4 }, configurable: true });
    fireEvent.error(videoEl());

    await waitFor(() => expect(videoEl().getAttribute('src')).toBe(TRANSCODE));
    expect(screen.queryByText('Playback Error')).not.toBeInTheDocument();
  });

  test('shows the server explanation when ffmpeg is required but missing (503)', async () => {
    marmaladeMedia.getMediaItem.mockResolvedValue({ data: realMediaResponse });
    const detail = "This video can't be played directly in a browser (.mkv container is not browser-playable) and FFmpeg, which is needed to convert it, is not installed on the server.";
    marmaladeStream.authorizePlayback.mockRejectedValue(Object.assign(new Error('503'), {
      response: { status: 503, data: { detail, missing_components: ['ffmpeg'] } },
    }));

    renderAt(`/watch/${LIBRARY_ID}`);

    await waitFor(() => expect(screen.getByText('Playback Error')).toBeInTheDocument());
    expect(screen.getByText(detail)).toBeInTheDocument();
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

describe('VideoPlayer helpers', () => {
  const { shiftVtt, transcodeSrcAt } = jest.requireActual('../components/VideoPlayer');
  const vtt = 'WEBVTT\n\n1\n00:00:05.000 --> 00:00:07.500 line:90%\nHello\n\n2\n00:01:00.000 --> 00:01:02.000\nWorld';

  test('shiftVtt moves cues later/earlier and drops cues before 0', () => {
    expect(shiftVtt(vtt, 0)).toBe(vtt);
    const later = shiftVtt(vtt, 1.25);
    expect(later).toContain('00:00:06.250 --> 00:00:08.750 line:90%');
    expect(later).toContain('00:01:01.250 --> 00:01:03.250');
    // Transcoded stream restarted at 30s: first cue is gone, second re-based.
    const rebased = shiftVtt(vtt, -30);
    expect(rebased).not.toContain('Hello');
    expect(rebased).toContain('00:00:30.000 --> 00:00:32.000\nWorld');
    expect(rebased.startsWith('WEBVTT')).toBe(true);
  });

  test('transcodeSrcAt appends the start offset only when seeking', () => {
    expect(transcodeSrcAt('/t?token=a', 0)).toBe('/t?token=a');
    expect(transcodeSrcAt('/t?token=a', 12.345)).toBe('/t?token=a&start=12.35');
    expect(transcodeSrcAt('/t', 5)).toBe('/t?start=5.00');
  });
});
