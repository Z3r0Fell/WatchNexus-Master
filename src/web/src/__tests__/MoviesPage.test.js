import { render, screen, waitFor, act, userEvent } from './test-utils'
import { MoviesPage } from '../pages/MoviesPage'
import { marmaladeLibrary, marmaladeMedia } from '../services/marmaladeApi'
import { tmdbApi, watchlistApi } from '../services/api'

jest.mock('../services/marmaladeApi', () => ({
  marmaladeLibrary: { getLibraries: jest.fn(), addLibrary: jest.fn(), scanLibrary: jest.fn() },
  marmaladeMedia: { getMedia: jest.fn(), getRecent: jest.fn() },
  marmaladeStream: {},
  formatDuration: jest.fn((s) => `${Math.floor(s/60)}m`),
  formatFileSize: jest.fn((b) => `${Math.round(b/1024/1024)}MB`),
  getTitle: jest.fn((item) => item.title),
  getMediaType: jest.fn((item) => item.media_type || 'movie'),
}))

jest.mock('../services/api', () => ({
  tmdbApi: { getGenres: jest.fn(), discover: jest.fn(), getNowPlaying: jest.fn(), getOnTheAir: jest.fn() },
  watchlistApi: { get: jest.fn(), add: jest.fn(), remove: jest.fn() },
  progressApi: {},
  libraryApi: {},
}))

jest.mock('../components/media/MediaCard', () => ({
  MediaCard: ({ item, index, onAddToWatchlist, isInWatchlist }) => (
    <div data-testid={`media-card-${item.id}`} key={item.id}>
      <span>{item.title}</span>
      <button data-testid={`add-watchlist-${item.id}`} onClick={() => onAddToWatchlist?.(item)}>
        {isInWatchlist ? 'Remove' : 'Add'}
      </button>
    </div>
  ),
}))

describe('MoviesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    marmaladeLibrary.getLibraries.mockResolvedValue({ data: [] })
    marmaladeMedia.getMedia.mockResolvedValue({ data: [] })
    marmaladeMedia.getRecent.mockResolvedValue({ data: [] })
    tmdbApi.getGenres.mockResolvedValue({ data: { genres: [{ id: 28, name: 'Action' }, { id: 35, name: 'Comedy' }] } })
    tmdbApi.discover.mockResolvedValue({ data: { results: [], total_pages: 1 } })
    watchlistApi.get.mockResolvedValue({ data: [] })
  })

  test('renders movies page with header', async () => {
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument()
  })

  test('shows view mode toggle (Library/Discover)', async () => {
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-view-toggle')).toBeInTheDocument())
    expect(screen.getByTestId('movies-library-tab')).toHaveTextContent('My Library')
    expect(screen.getByTestId('movies-discover-tab')).toHaveTextContent('Discover')
  })

  test('shows empty state when no libraries', async () => {
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByText('No Movie Libraries')).toBeInTheDocument())
    expect(screen.getByText(/Add a movie library to start viewing your collection/)).toBeInTheDocument()
  })

  test('switches to Discover view', async () => {
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('movies-discover-tab'))
    })
    
    expect(screen.getByTestId('movies-discover-tab')).toHaveStyle({ backgroundColor: expect.stringContaining('violet') })
  })

  test('adds movie library', async () => {
    marmaladeLibrary.addLibrary.mockResolvedValue({ data: { id: '1' } })
    marmaladeLibrary.scanLibrary.mockResolvedValue({ data: { new: 10 } })
    
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('add-movie-library-btn'))
    })
    
    await act(async () => {
      await userEvent.type(screen.getByTestId('movie-library-name-input'), 'My Movies')
      await userEvent.type(screen.getByTestId('movie-library-path-input'), '/movies')
      await userEvent.click(screen.getByTestId('movie-library-add-btn'))
    })
    
    expect(marmaladeLibrary.addLibrary).toHaveBeenCalledWith('My Movies', '/movies', 'movies')
  })

  test('scans movie library', async () => {
    marmaladeLibrary.getLibraries.mockResolvedValue({ data: [{ id: '1', name: 'Movies', path: '/movies', media_type: 'movies', item_count: 50 }] })
    marmaladeLibrary.scanLibrary.mockResolvedValue({ data: { new: 5 } })
    
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('scan-library-1'))
    })
    
    expect(marmaladeLibrary.scanLibrary).toHaveBeenCalledWith('1')
  })

  test('searches local movies', async () => {
    marmaladeLibrary.getLibraries.mockResolvedValue({ data: [{ id: '1', name: 'Movies', path: '/movies', media_type: 'movies', item_count: 50 }] })
    marmaladeMedia.getMedia.mockResolvedValue({ data: [{ id: '1', title: 'The Matrix', media_type: 'movie', year: 1999 }] })
    
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    
    await act(async () => {
      await userEvent.type(screen.getByTestId('movies-library-search'), 'Matrix')
    })
    
    // Search is client-side filtering, no API call
    expect(screen.getByText('The Matrix')).toBeInTheDocument()
  })

  test('fetches genres for Discover view', async () => {
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('movies-discover-tab'))
    })
    
    expect(tmdbApi.getGenres).toHaveBeenCalledWith('movie')
  })

  test('filters by genre', async () => {
    tmdbApi.discover.mockResolvedValue({ data: { results: [{ id: 1, title: 'Action Movie', genre_ids: [28] }], total_pages: 1 } })
    
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('movies-discover-tab'))
    })
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('genre-28'))
    })
    
    expect(tmdbApi.discover).toHaveBeenCalledWith('movie', expect.objectContaining({ genre: 28 }))
  })

  test('changes sort order', async () => {
    tmdbApi.discover.mockResolvedValue({ data: { results: [], total_pages: 1 } })
    
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('movies-discover-tab'))
    })
    
    await act(async () => {
      // Click the dropdown trigger
      await userEvent.click(screen.getByText('Most Popular'))
      await userEvent.click(screen.getByText('Top Rated'))
    })
    
    expect(tmdbApi.discover).toHaveBeenCalledWith('movie', expect.objectContaining({ sort_by: 'vote_average.desc' }))
  })

  test('adds to watchlist', async () => {
    tmdbApi.discover.mockResolvedValue({ data: { results: [{ id: 1, title: 'Test Movie', media_type: 'movie', poster_path: '/poster.jpg' }], total_pages: 1 } })
    watchlistApi.get.mockResolvedValue({ data: [] })
    watchlistApi.add.mockResolvedValue({ data: {} })
    
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('movies-discover-tab'))
    })
    
    await waitFor(() => expect(screen.getByTestId('media-card-1')).toBeInTheDocument())
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('add-watchlist-1'))
    })
    
    expect(watchlistApi.add).toHaveBeenCalledWith(expect.objectContaining({ tmdb_id: 1 }))
  })

  test('removes from watchlist', async () => {
    tmdbApi.discover.mockResolvedValue({ data: { results: [{ id: 1, title: 'Test Movie', media_type: 'movie', poster_path: '/poster.jpg' }], total_pages: 1 } })
    watchlistApi.get.mockResolvedValue({ data: [{ tmdb_id: 1 }] })
    watchlistApi.remove.mockResolvedValue({ data: {} })
    
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('movies-discover-tab'))
    })
    
    await waitFor(() => expect(screen.getByTestId('media-card-1')).toBeInTheDocument())
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('add-watchlist-1'))
    })
    
    expect(watchlistApi.remove).toHaveBeenCalledWith(1)
  })

  test('loads more movies on pagination', async () => {
    tmdbApi.discover
      .mockResolvedValueOnce({ data: { results: [{ id: 1, title: 'Movie 1' }], total_pages: 2 } })
      .mockResolvedValueOnce({ data: { results: [{ id: 2, title: 'Movie 2' }], total_pages: 2 } })
    
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('movies-discover-tab'))
    })
    
    await act(async () => {
      await userEvent.click(screen.getByTestId('load-more-btn'))
    })
    
    expect(tmdbApi.discover).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Movie 2')).toBeInTheDocument()
  })

  test('shows recently added movies', async () => {
    marmaladeLibrary.getLibraries.mockResolvedValue({ data: [{ id: '1', name: 'Movies', path: '/movies', media_type: 'movies', item_count: 50 }] })
    marmaladeMedia.getRecent.mockResolvedValue({ data: [{ id: '1', title: 'Recent Movie', media_type: 'movie', year: 2023, poster_url: '/poster.jpg' }] })
    
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    
    expect(screen.getByText('Recently Added')).toBeInTheDocument()
    expect(screen.getByText('Recent Movie')).toBeInTheDocument()
  })

  test('displays movie rating badge', async () => {
    marmaladeLibrary.getLibraries.mockResolvedValue({ data: [{ id: '1', name: 'Movies', path: '/movies', media_type: 'movies', item_count: 1 }] })
    marmaladeMedia.getMedia.mockResolvedValue({ data: [{ id: '1', title: 'Rated Movie', media_type: 'movie', rating: 8.5, poster_url: '/poster.jpg' }] })
    
    render(<MoviesPage />)
    await waitFor(() => expect(screen.getByTestId('movies-page')).toBeInTheDocument())
    
    expect(screen.getByText('Rated Movie')).toBeInTheDocument()
  })

  describe('library cards (beta bug: clicking a library card did nothing)', () => {
    const libs = [
      { id: 'lib-movies', name: 'My Movies', path: '/data/media/Movies', media_type: 'movies', item_count: 1 },
      { id: 'lib-anime', name: 'My Anime Movies', path: '/data/media/AnimeMovies', media_type: 'movies', item_count: 1 },
    ]
    const itemsByLib = {
      'lib-movies': [{ id: 'm1', title: 'Heat', media_type: 'movies', tmdb_id: 949 }],
      'lib-anime': [{ id: 'a1', title: 'Akira', media_type: 'movies', tmdb_id: null }],
    }

    beforeEach(() => {
      marmaladeLibrary.getLibraries.mockResolvedValue({ data: libs })
      marmaladeMedia.getMedia.mockImplementation(({ library_id }) =>
        Promise.resolve({ data: itemsByLib[library_id] || [] }))
    })

    test('fetches each library by library_id, not by a singular media_type', async () => {
      render(<MoviesPage />)
      await waitFor(() => expect(screen.getByText('Heat')).toBeInTheDocument())
      expect(screen.getByText('Akira')).toBeInTheDocument()
      expect(marmaladeMedia.getMedia).toHaveBeenCalledWith(expect.objectContaining({ library_id: 'lib-movies' }))
      expect(marmaladeMedia.getMedia).toHaveBeenCalledWith(expect.objectContaining({ library_id: 'lib-anime' }))
      expect(marmaladeMedia.getMedia).not.toHaveBeenCalledWith(expect.objectContaining({ media_type: 'movie' }))
    })

    test('clicking a library card shows only that library and toggles back', async () => {
      render(<MoviesPage />)
      await waitFor(() => expect(screen.getByText('Heat')).toBeInTheDocument())

      await act(async () => { await userEvent.click(screen.getByTestId('library-card-lib-anime')) })

      expect(screen.getByTestId('library-card-lib-anime')).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByTestId('selected-library-header')).toHaveTextContent('My Anime Movies (1)')
      expect(screen.getByText('Akira')).toBeInTheDocument()
      expect(screen.queryByText('Heat')).not.toBeInTheDocument()

      await act(async () => { await userEvent.click(screen.getByTestId('show-all-libraries-btn')) })
      expect(screen.queryByTestId('selected-library-header')).not.toBeInTheDocument()
      expect(screen.getByText('Heat')).toBeInTheDocument()
    })

    test('library card is keyboard accessible', async () => {
      render(<MoviesPage />)
      await waitFor(() => expect(screen.getByText('Heat')).toBeInTheDocument())
      screen.getByTestId('library-card-lib-movies').focus()
      await act(async () => { await userEvent.keyboard('{Enter}') })
      expect(screen.getByTestId('selected-library-header')).toHaveTextContent('My Movies (1)')
      expect(screen.queryByText('Akira')).not.toBeInTheDocument()
    })

    test('scan button does not toggle the library selection', async () => {
      marmaladeLibrary.scanLibrary.mockResolvedValue({ data: { new: 0 } })
      render(<MoviesPage />)
      await waitFor(() => expect(screen.getByText('Heat')).toBeInTheDocument())
      await act(async () => { await userEvent.click(screen.getByTestId('scan-library-lib-movies')) })
      expect(marmaladeLibrary.scanLibrary).toHaveBeenCalledWith('lib-movies')
      expect(screen.queryByTestId('selected-library-header')).not.toBeInTheDocument()
    })

    test('media items link to details (TMDB match) or straight to the player', async () => {
      render(<MoviesPage />)
      await waitFor(() => expect(screen.getByText('Heat')).toBeInTheDocument())
      expect(screen.getByTestId('local-movie-m1')).toHaveAttribute('href', '/movie/949')
      expect(screen.getByTestId('local-movie-a1')).toHaveAttribute('href', '/watch/a1')
    })

    test('selected empty library shows a hint instead of nothing', async () => {
      marmaladeMedia.getMedia.mockImplementation(({ library_id }) =>
        Promise.resolve({ data: library_id === 'lib-movies' ? itemsByLib['lib-movies'] : [] }))
      render(<MoviesPage />)
      await waitFor(() => expect(screen.getByText('Heat')).toBeInTheDocument())
      await act(async () => { await userEvent.click(screen.getByTestId('library-card-lib-anime')) })
      expect(screen.getByTestId('selected-library-empty')).toBeInTheDocument()
    })
  })
})
