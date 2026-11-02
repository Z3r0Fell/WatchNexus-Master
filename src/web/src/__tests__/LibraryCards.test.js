import { render, screen, waitFor, act, userEvent } from './test-utils'
import { TVShowsPage } from '../pages/TVShowsPage'
import AnimePage from '../pages/AnimePage'
import { MediaCard } from '../components/media/MediaCard'
import { normalizeMediaType, isMediaType, localMediaHref } from '../lib/utils'
import { marmaladeLibrary, marmaladeMedia } from '../services/marmaladeApi'

jest.mock('../services/marmaladeApi', () => ({
  marmaladeLibrary: { getLibraries: jest.fn(), addLibrary: jest.fn(), scanLibrary: jest.fn() },
  marmaladeMedia: { getMedia: jest.fn(), getRecent: jest.fn(), getTVSeriesGrouped: jest.fn() },
  marmaladeStream: {},
  formatDuration: jest.fn(() => '1m'),
}))

jest.mock('../services/api', () => ({
  tmdbApi: { getGenres: jest.fn(() => Promise.resolve({ data: { genres: [] } })), discover: jest.fn(() => Promise.resolve({ data: { results: [], total_pages: 1 } })), search: jest.fn() },
  watchlistApi: { get: jest.fn(() => Promise.resolve({ data: [] })), add: jest.fn(), remove: jest.fn() },
  progressApi: {},
  libraryApi: {},
}))

jest.mock('../components/media/AddToPlaylistButton', () => ({
  AddToPlaylistButton: () => null,
}))

describe('normalizeMediaType', () => {
  test.each([
    ['movie', 'movie'], ['movies', 'movie'], ['Movies', 'movie'],
    ['tv', 'tv'], ['episode', 'tv'], ['tv_shows', 'tv'],
    ['audiobook', 'audiobook'], ['audiobooks', 'audiobook'],
    ['anime', 'anime'], ['music', 'music'], ['person', 'person'], [undefined, ''],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeMediaType(input)).toBe(expected)
  })

  test('isMediaType tolerates singular and plural', () => {
    expect(isMediaType('movies', 'movie')).toBe(true)
    expect(isMediaType('episode', 'tv')).toBe(true)
    expect(isMediaType('tv', 'movie')).toBe(false)
  })

  test('localMediaHref picks details for TMDB matches, otherwise the player', () => {
    expect(localMediaHref({ id: 'g1', media_type: 'movies', tmdb_id: 5 })).toBe('/movie/5')
    expect(localMediaHref({ id: 'g1', media_type: 'tv', tmdb_id: 7 })).toBe('/tv/7')
    expect(localMediaHref({ id: 'g1', media_type: 'movies' })).toBe('/watch/g1')
  })
})

describe('MediaCard', () => {
  test('honors onClick instead of navigating', async () => {
    const onClick = jest.fn()
    const item = { id: 'abc', title: 'Local Thing', media_type: 'movies', library_id: 'lib1' }
    render(<MediaCard item={item} onClick={onClick} />)
    await act(async () => { await userEvent.click(screen.getByTestId('media-card-abc').querySelector('a')) })
    expect(onClick).toHaveBeenCalledWith(item)
  })

  test('plural media_type does not produce a /movies/<id> route', () => {
    render(<MediaCard item={{ id: 42, title: 'X', media_type: 'movies' }} />)
    expect(screen.getByTestId('media-card-42').querySelector('a')).toHaveAttribute('href', '/movie/42')
  })

  test('local library items link by TMDB id or to the player, never by GUID', () => {
    render(<MediaCard item={{ id: 'guid-1', title: 'Y', media_type: 'movies', library_id: 'l', tmdb_id: 99 }} />)
    expect(screen.getByTestId('media-card-guid-1').querySelector('a')).toHaveAttribute('href', '/movie/99')
  })
})

describe('TV and Anime library cards', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    marmaladeMedia.getRecent.mockResolvedValue({ data: [] })
    marmaladeMedia.getTVSeriesGrouped.mockResolvedValue({ data: [] })
  })

  test('TV: clicking a library card filters series to that library', async () => {
    marmaladeLibrary.getLibraries.mockResolvedValue({ data: [
      { id: 'tv1', name: 'Shows', path: '/s', media_type: 'tv', item_count: 1 },
      { id: 'tv2', name: 'Kids Shows', path: '/k', media_type: 'tv', item_count: 1 },
    ] })
    marmaladeMedia.getMedia.mockImplementation(({ library_id }) => Promise.resolve({ data:
      library_id === 'tv1'
        ? [{ id: 'e1', title: 'The Wire', media_type: 'tv', tmdb_id: 1438 }]
        : [{ id: 'e2', title: 'Bluey', media_type: 'tv', tmdb_id: null }],
    }))

    render(<TVShowsPage />)
    await waitFor(() => expect(screen.getByText('The Wire')).toBeInTheDocument())
    expect(screen.getByText('Bluey')).toBeInTheDocument()

    await act(async () => { await userEvent.click(screen.getByTestId('library-card-tv2')) })
    expect(screen.getByTestId('selected-library-header')).toHaveTextContent('Kids Shows (1)')
    expect(screen.queryByText('The Wire')).not.toBeInTheDocument()
    expect(screen.getByTestId('local-series-0')).toHaveAttribute('href', '/watch/e2')
  })

  test('Anime: items stored as "anime" are shown and filtered per library card', async () => {
    marmaladeLibrary.getLibraries.mockResolvedValue({ data: [
      { id: 'an1', name: 'Anime', path: '/a', media_type: 'anime', item_count: 1 },
      { id: 'an2', name: 'Anime Movies', path: '/am', media_type: 'anime', item_count: 1 },
    ] })
    marmaladeMedia.getMedia.mockImplementation(({ library_id }) => Promise.resolve({ data:
      library_id === 'an1'
        ? [{ id: 'x1', title: 'Cowboy Bebop', media_type: 'anime' }]
        : [{ id: 'x2', title: 'Perfect Blue', media_type: 'anime', tmdb_id: 10494 }],
    }))

    render(<AnimePage />)
    await waitFor(() => expect(screen.getByText('Cowboy Bebop')).toBeInTheDocument())

    await act(async () => { await userEvent.click(screen.getByTestId('library-card-an2')) })
    expect(screen.getByTestId('selected-library-header')).toHaveTextContent('Anime Movies (1)')
    expect(screen.queryByText('Cowboy Bebop')).not.toBeInTheDocument()
    expect(screen.getByTestId('local-anime-0')).toHaveAttribute('href', '/movie/10494')
  })
})
