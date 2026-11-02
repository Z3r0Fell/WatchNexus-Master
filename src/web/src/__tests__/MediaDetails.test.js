import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import { MediaDetails, normalizeDetailsType } from '../pages/MediaDetails';
import { tmdbApi, watchlistApi } from '../services/api';
import { marmaladeMedia } from '../services/marmaladeApi';

global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

jest.mock('../components/layout/Layout', () => ({ Layout: ({ children }) => <div>{children}</div> }));
jest.mock('../components/media/AddToPlaylistButton', () => ({ AddToPlaylistButton: () => null }));
jest.mock('../components/media/IntroDetector', () => ({ IntroDetector: () => null }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('../services/api', () => ({
  tmdbApi: { getMovieDetails: jest.fn(), getTvDetails: jest.fn(), getTvSeason: jest.fn() },
  watchlistApi: { get: jest.fn(), add: jest.fn(), remove: jest.fn() },
  downloadsApi: { add: jest.fn() },
  progressApi: { get: jest.fn() },
}));
jest.mock('../services/marmaladeApi', () => ({ marmaladeMedia: { getByTmdb: jest.fn() } }));

const Watch = () => <div data-testid="watch">{useParams().mediaId}</div>;
const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/watch/:mediaId" element={<Watch />} />
      <Route path="/:type/:id" element={<MediaDetails />} />
    </Routes>
  </MemoryRouter>
);

describe('MediaDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    watchlistApi.get.mockResolvedValue({ data: [] });
    marmaladeMedia.getByTmdb.mockResolvedValue({ data: [] });
  });

  test('normalizes plural library media types', () => {
    expect(normalizeDetailsType('movies')).toBe('movie');
    expect(normalizeDetailsType('movie')).toBe('movie');
    expect(normalizeDetailsType('tv')).toBe('tv');
    expect(normalizeDetailsType('anime')).toBe('tv');
  });

  test('/movies/<tmdb id> loads movie details (not TV) and offers Play for a local file', async () => {
    tmdbApi.getMovieDetails.mockResolvedValue({ data: { id: 550, title: 'Fight Club', overview: '' } });
    marmaladeMedia.getByTmdb.mockResolvedValue({ data: [{ id: 'lib-guid-1', title: 'Fight Club', media_type: 'movies', tmdb_id: 550 }] });

    renderAt('/movies/550');

    await waitFor(() => expect(screen.getByText('Fight Club')).toBeInTheDocument());
    expect(tmdbApi.getMovieDetails).toHaveBeenCalledWith('550');
    expect(tmdbApi.getTvDetails).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('play-local-btn'));
    expect(screen.getByTestId('watch')).toHaveTextContent('lib-guid-1');
  });

  test('a library GUID in the URL redirects to the player instead of querying TMDB', async () => {
    renderAt('/movies/3f2b9c1e-7a4d-4e1b-9d55-0c2a8f1e6b77');
    await waitFor(() => expect(screen.getByTestId('watch')).toHaveTextContent('3f2b9c1e-7a4d-4e1b-9d55-0c2a8f1e6b77'));
    expect(tmdbApi.getMovieDetails).not.toHaveBeenCalled();
    expect(tmdbApi.getTvDetails).not.toHaveBeenCalled();
  });

  test('TMDB error payload is shown as not found', async () => {
    tmdbApi.getMovieDetails.mockResolvedValue({ data: { success: false, status_code: 34, status_message: 'not found' } });
    renderAt('/movie/999999');
    await waitFor(() => expect(screen.getByText('Content not found')).toBeInTheDocument());
  });

  test('clicking a TV episode that exists locally plays it; missing episodes do not navigate', async () => {
    tmdbApi.getTvDetails.mockResolvedValue({ data: { id: 1399, name: 'Show', seasons: [{ season_number: 1, episode_count: 2 }] } });
    tmdbApi.getTvSeason.mockResolvedValue({ data: { episodes: [
      { id: 11, episode_number: 1, name: 'Pilot' },
      { id: 12, episode_number: 2, name: 'Second' },
    ] } });
    marmaladeMedia.getByTmdb.mockResolvedValue({ data: [
      { id: 'ep-guid-1', media_type: 'tv', tmdb_id: 1399, season_number: 1, episode_number: 1 },
    ] });

    renderAt('/tv/1399');

    await waitFor(() => expect(screen.getByTestId('episode-2')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('episode-2'));
    expect(require('sonner').toast.info).toHaveBeenCalled();
    expect(screen.queryByTestId('watch')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('episode-1'));
    expect(screen.getByTestId('watch')).toHaveTextContent('ep-guid-1');
  });
});
