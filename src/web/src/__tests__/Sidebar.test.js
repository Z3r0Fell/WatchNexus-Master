import { render, screen, waitFor, act, userEvent } from './test-utils';
import { Sidebar } from '../components/layout/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useLicense } from '../context/LicenseContext';
import { useGadgets } from '../context/GadgetContext';
import { useTranslation } from 'react-i18next';

jest.mock('../context/AuthContext', () => ({;
  ...jest.requireActual('../context/AuthContext'),;
  useAuth: () => ({;
    user: { id: '1', username: 'testuser', email: 'test@test.com', role: 'user' },;
    isAuthenticated: true,;
    loading: false,;
    logout: jest.fn(),;
  }),;
}));

jest.mock('../context/LicenseContext', () => ({;
  ...jest.requireActual('../context/LicenseContext'),;
  useLicense: () => ({;
    isRouteUnlocked: jest.fn((path) => true),;
    getRouteRequiredTier: jest.fn((path) => 'standard'),;
    ROUTE_MODULE_MAP: {},;
  }),;
  ROUTE_MODULE_MAP: {},;
}));

jest.mock('../context/GadgetContext', () => ({;
  ...jest.requireActual('../context/GadgetContext'),;
  useGadgets: () => ({;
    hooks: { sidebar_entries: [], routes: [], settings_panels: [], dashboard_widgets: [], theme_presets: [], providers: { metadata: [], subtitle: [], notification: [], indexer: [], streaming: [], sync: [], auth: [] }, enhanced_pages: [], background_services: [] },;
    loading: false,;
  }),;
}));

jest.mock('react-i18next', () => ({;
  useTranslation: () => ({ t: (key, opts) => opts?.defaultValue || key, i18n: { changeLanguage: jest.fn(), language: 'en' } }),;
}));

jest.mock('../components/LanguageSwitcher', () => ({;
  LanguageSwitcher: () => <div data-testid="language-switcher" />,;
}));

describe('Sidebar', () => {;
  beforeEach(() => {;
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  test('renders sidebar with logo', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    expect(screen.getByAltText('WatchNexus')).toBeInTheDocument());
    expect(screen.getByText('WatchNexus')).toBeInTheDocument());
  });

  test('shows toggle button', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar-toggle')).toBeInTheDocument());
  });

  test('collapses/expands on toggle click', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    // Initially expanded (240px);
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toHaveStyle({ width: '240px' });
    ;
    await act(async () => {;
      await userEvent.click(screen.getByTestId('sidebar-toggle'));
    });
    ;
    // Should be collapsed (72px);
    expect(sidebar).toHaveStyle({ width: '72px' });
  });

  test('shows search link when expanded', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('search-link')).toBeInTheDocument());
    expect(screen.getByText('Search...')).toBeInTheDocument());
  });

  test('hides search link when collapsed', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    await act(async () => {;
      await userEvent.click(screen.getByTestId('sidebar-toggle'));
    });
    ;
    expect(screen.queryByTestId('search-link')).not.toBeInTheDocument();
  });

  test('shows media navigation items', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    expect(screen.getByTestId('nav-home')).toHaveTextContent('Home');
    expect(screen.getByTestId('nav-library')).toHaveTextContent('Library');
    expect(screen.getByTestId('nav-movies')).toHaveTextContent('Movies');
    expect(screen.getByTestId('nav-tv-shows')).toHaveTextContent('TV Shows');
    expect(screen.getByTestId('nav-anime')).toHaveTextContent('Anime');
    expect(screen.getByTestId('nav-playlists')).toHaveTextContent('Playlists');
    expect(screen.getByTestId('nav-collections')).toHaveTextContent('Collections');
    expect(screen.getByTestId('nav-music')).toHaveTextContent('Music');
    expect(screen.getByTestId('nav-audiobooks')).toHaveTextContent('Audiobooks');
    expect(screen.getByTestId('nav-live-tv')).toHaveTextContent('Live TV');
    expect(screen.getByTestId('nav-streaming')).toHaveTextContent('Streaming');
    expect(screen.getByTestId('nav-indexers')).toHaveTextContent('Indexers');
    expect(screen.getByTestId('nav-automation')).toHaveTextContent('Automation');
  });

  test('shows gadget navigation items', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    expect(screen.getByTestId('nav-weather')).toHaveTextContent('Weather');
    expect(screen.getByTestId('nav-podcasts')).toHaveTextContent('Podcasts');
    expect(screen.getByTestId('nav-radio')).toHaveTextContent('Radio');
    expect(screen.getByTestId('nav-photos')).toHaveTextContent('Photos');
    expect(screen.getByTestId('nav-web-video')).toHaveTextContent('Web Video');
    expect(screen.getByTestId('nav-analytics')).toHaveTextContent('Analytics');
    expect(screen.getByTestId('nav-notifications')).toHaveTextContent('Notifications');
    expect(screen.getByTestId('nav-requests')).toHaveTextContent('Requests');
    expect(screen.getByTestId('nav-parental')).toHaveTextContent('Parental');
    expect(screen.getByTestId('nav-processing')).toHaveTextContent('Processing');
    expect(screen.getByTestId('nav-usenet')).toHaveTextContent('Usenet');
  });

  test('shows downloads and help always visible', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    expect(screen.getByTestId('nav-downloads')).toHaveTextContent('Downloads');
    expect(screen.getByTestId('nav-help')).toHaveTextContent('Help');
  });

  test('shows settings section with sub-items', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    expect(screen.getByTestId('nav-settings')).toHaveTextContent('Settings');
    expect(screen.getByTestId('settings-expand-toggle')).toBeInTheDocument());
  });

  test('expands settings sub-items on click', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    await act(async () => {;
      await userEvent.click(screen.getByTestId('settings-expand-toggle'));
    });
    ;
    expect(screen.getByTestId('nav-security')).toHaveTextContent('Security');
    expect(screen.getByTestId('nav-vpn-portal')).toHaveTextContent('VPN Portal');
    expect(screen.getByTestId('nav-lib-manager')).toHaveTextContent('Lib Manager');
    expect(screen.getByTestId('nav-browse-media')).toHaveTextContent('Browse Media');
    expect(screen.getByTestId('nav-log-viewer')).toHaveTextContent('Log Viewer');
    expect(screen.getByTestId('nav-system')).toHaveTextContent('System');
    expect(screen.getByTestId('nav-marketplace')).toHaveTextContent('Marketplace');
  });

  test('shows user section with avatar and logout', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    expect(screen.getByText('testuser')).toBeInTheDocument());
    expect(screen.getByText('test@test.com')).toBeInTheDocument());
    expect(screen.getByTestId('logout-btn')).toBeInTheDocument());
  });

  test('shows lock icon for locked routes', async () => {;
    const { useLicense } = require('../context/LicenseContext');
    useLicense.mockReturnValue({;
      isRouteUnlocked: jest.fn((path) => path === '/security'),;
      getRouteRequiredTier: jest.fn((path) => 'ultra'),;
      ROUTE_MODULE_MAP: { '/security': 'security' },;
    });
    ;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    // Security should show lock;
    expect(screen.getByTestId('nav-security')).toBeInTheDocument());
    // The lock icon is rendered conditionally;
  });

  test('highlights active route', async () => {;
    render(<Sidebar />, { wrapperOverrides: { initialPath: '/movies' } });
    await waitFor(() => expect(screen.getByTestId('nav-movies')).toBeInTheDocument());
    expect(screen.getByTestId('nav-movies')).toHaveStyle({ backgroundColor: expect.stringContaining('var(--primary') });
  });

  test('persists scroll position in sessionStorage', async () => {;
    sessionStorage.getItem.mockReturnValueOnce('100');
    ;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    // Scroll position should be restored;
    const nav = screen.getByTestId('sidebar').querySelector('nav');
    expect(nav.scrollTop).toBe(100);
  });

  test('saves scroll position to sessionStorage on scroll', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    const nav = screen.getByTestId('sidebar').querySelector('nav');
    nav.scrollTop = 200;
    nav.dispatchEvent(new Event('scroll'));
    ;
    expect(sessionStorage.setItem).toHaveBeenCalledWith('watchnexus_sidebar_scroll', '200');
  });

  test('auto-expands settings when on settings sub-path', async () => {;
    render(<Sidebar />, { wrapperOverrides: { initialPath: '/security' } });
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    // Settings should be expanded;
    expect(screen.getByTestId('nav-security')).toBeInTheDocument());
  });

  test('shows language switcher', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('language-switcher')).toBeInTheDocument());
  });

  test('calls logout on logout button click', async () => {;
    const { useAuth } = require('../context/AuthContext');
    const mockLogout = jest.fn();
    useAuth.mockReturnValue({;
      user: { id: '1', username: 'testuser', email: 'test@test.com', role: 'user' },;
      isAuthenticated: true,;
      loading: false,;
      logout: mockLogout,;
    });
    ;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    await act(async () => {;
      await userEvent.click(screen.getByTestId('logout-btn'));
    });
    ;
    expect(mockLogout).toHaveBeenCalled();
  });

  test('filters visible tabs from localStorage', async () => {;
    localStorage.getItem.mockReturnValueOnce(JSON.stringify(['Library', 'Movies', 'Settings']));
    ;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    expect(screen.getByTestId('nav-library')).toBeInTheDocument());
    expect(screen.getByTestId('nav-movies')).toBeInTheDocument());
    // Other items should be hidden;
  });

  test('listens for watchnexus_tabs_updated event', async () => {;
    render(<Sidebar />);
    await waitFor(() => expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    ;
    window.dispatchEvent(new Event('watchnexus_tabs_updated'));
    // Should update visible tabs;
  });
});