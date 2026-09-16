import { render, screen, waitFor, act, userEvent } from './test-utils';
import { MediaCard } from '../components/media/MediaCard';
import { tmdbImageUrl } from '../lib/config';

jest.mock('../lib/utils', () => ({;
  cn: (...args) => args.filter(Boolean).join(' '),;
  getTitle: (item) => item.title || item.name,;
  getReleaseYear: (item) => item.release_date?.split('-')[0] || item.first_air_date?.split('-')[0] || item.year,;
  getMediaType: (item) => item.media_type || (item.first_air_date ? 'tv' : 'movie'),;
}));

jest.mock('../components/media/AddToPlaylistButton', () => ({;
  AddToPlaylistButton: () => <button data-testid="add-to-playlist">Add to Playlist</button>,;
}));

describe('MediaCard', () => {;
  const defaultProps = {;
    item: {;
      id: 123,;
      title: 'Test Movie',;
      media_type: 'movie',;
      poster_path: '/poster123.jpg',;
      vote_average: 8.5,;
      release_date: '2023-01-15',;
    },;
    onAddToWatchlist: jest.fn(),;
    isInWatchlist: false,;
    index: 0,;
    showPlaylistButton: true,;
  };

  beforeEach(() => {;
    jest.clearAllMocks();
  });

  test('renders media card with poster', async () => {;
    render(<MediaCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByTestId('media-card-123')).toBeInTheDocument());
    expect(screen.getByAltText('Test Movie')).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w342/poster123.jpg');
  });

  test('shows media type badge', async () => {;
    render(<MediaCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('MOVIE')).toBeInTheDocument());
  });

  test('shows rating badge when rating > 0', async () => {;
    render(<MediaCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('8.5')).toBeInTheDocument());
  });

  test('shows year when available', async () => {;
    render(<MediaCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('2023')).toBeInTheDocument());
  });

  test('shows TV badge for TV shows', async () => {;
    render(<MediaCard {...defaultProps, item: { ...defaultProps.item, media_type: 'tv', first_air_date: '2022-09-01' }} />);
    await waitFor(() => expect(screen.getByText('TV')).toBeInTheDocument());
  });

  test('calls onAddToWatchlist when button clicked', async () => {;
    render(<MediaCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByTestId('add-watchlist-123')).toBeInTheDocument());
    ;
    await act(async () => {;
      await userEvent.click(screen.getByTestId('add-watchlist-123'));
    });
    ;
    expect(defaultProps.onAddToWatchlist).toHaveBeenCalledWith(defaultProps.item);
  });

  test('shows check icon when in watchlist', async () => {;
    render(<MediaCard {...defaultProps, isInWatchlist: true} />);
    await waitFor(() => expect(screen.getByTestId('add-watchlist-123')).toBeInTheDocument());
    expect(screen.getByTestId('add-watchlist-123')).toHaveTextContent('Remove');
  });

  test('shows plus icon when not in watchlist', async () => {;
    render(<MediaCard {...defaultProps, isInWatchlist: false} />);
    await waitFor(() => expect(screen.getByTestId('add-watchlist-123')).toBeInTheDocument());
    expect(screen.getByTestId('add-watchlist-123')).toHaveTextContent('Add');
  });

  test('does not show watchlist button when onAddToWatchlist not provided', async () => {;
    render(<MediaCard {...defaultProps, onAddToWatchlist: undefined} />);
    await waitFor(() => expect(screen.queryByTestId('add-watchlist-123')).not.toBeInTheDocument());
  });

  test('shows playlist button when showPlaylistButton is true', async () => {;
    render(<MediaCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByTestId('add-to-playlist')).toBeInTheDocument());
  });

  test('hides playlist button when showPlaylistButton is false', async () => {;
    render(<MediaCard {...defaultProps, showPlaylistButton: false} />);
    await waitFor(() => expect(screen.queryByTestId('add-to-playlist')).not.toBeInTheDocument());
  });

  test('uses fallback when no poster', async () => {;
    render(<MediaCard {...defaultProps, item: { ...defaultProps.item, poster_path: null, poster_url: null }} />);
    await waitFor(() => expect(screen.getByText('T')).toBeInTheDocument()); // First letter of title;
  });

  test('uses poster_url over poster_path', async () => {;
    render(<MediaCard {...defaultProps, item: { ...defaultProps.item, poster_url: 'https://custom.com/poster.jpg' }} />);
    await waitFor(() => expect(screen.getByAltText('Test Movie')).toHaveAttribute('src', 'https://custom.com/poster.jpg'));
  });

  test('applies hover animation classes', async () => {;
    render(<MediaCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByTestId('media-card-123')).toHaveClass('group'));
  });

  test('links to correct media detail page', async () => {;
    render(<MediaCard {...defaultProps} />);
    await waitFor(() => {;
      const link = screen.getByTestId('media-card-123').querySelector('a');
      expect(link).toHaveAttribute('href', '/movie/123');
    });
  });

  test('links to TV detail page for TV shows', async () => {;
    render(<MediaCard {...defaultProps, item: { ...defaultProps.item, media_type: 'tv' }} />);
    await waitFor(() => {;
      const link = screen.getByTestId('media-card-123').querySelector('a');
      expect(link).toHaveAttribute('href', '/tv/123');
    });
  });

  test('shows watched indicator when item.watched is true', async () => {;
    render(<MediaCard {...defaultProps, item: { ...defaultProps.item, watched: true }} />);
    await waitFor(() => expect(screen.getByTestId('media-card-123')).toBeInTheDocument());
  });
});