jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  defaults: {},
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn(), handlers: [] },
    response: { use: jest.fn(), eject: jest.fn(), handlers: [] },
  },
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: {},
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn(), handlers: [] },
      response: { use: jest.fn(), eject: jest.fn(), handlers: [] },
    },
  })),
}));

import axios from 'axios';

describe('Services Layer - API Clients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('api.js - Main API Client', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('apiClient configured with withCredentials: true', () => {
      expect(apiModule.apiClient.defaults.withCredentials).toBe(true);
      expect(apiModule.apiClient.defaults.timeout).toBe(30000);
    });

    test('apiClient baseURL uses REACT_APP_BACKEND_URL', () => {
      expect(apiModule.apiClient.defaults.baseURL).toContain('/api');
    });

    test('request interceptor exists', () => {
      expect(apiModule.apiClient.interceptors.request.handlers.length).toBeGreaterThan(0);
    });

    test('response interceptor handles timeout', async () => {
      const timeoutError = new Error('timeout');
      timeoutError.code = 'ECONNABORTED';
      axios.get.mockRejectedValueOnce(timeoutError);

      await expect(apiModule.apiClient.get('/test')).rejects.toThrow('Request timed out');
    });

    test('response interceptor handles network error', async () => {
      const networkError = new Error('Network error');
      networkError.response = undefined;
      axios.get.mockRejectedValueOnce(networkError);

      await expect(apiModule.apiClient.get('/test')).rejects.toThrow('Network error');
    });

    test('response interceptor passes through other errors', async () => {
      const error = { response: { status: 400, data: { message: 'Bad request' } } };
      axios.get.mockRejectedValueOnce(error);

      await expect(apiModule.apiClient.get('/test')).rejects.toEqual(error);
    });
  });

  describe('api.js - TMDB API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('search calls correct endpoint with params', async () => {
      axios.get.mockResolvedValueOnce({ data: { results: [] } });

      await apiModule.tmdbApi.search('test query', 1, 'movie');

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/tmdb/search'),
        expect.objectContaining({
          params: { query: 'test query', page: 1, media_type: 'movie' },
        })
      );
    });

    test('getTrending calls correct endpoint', async () => {
      axios.get.mockResolvedValueOnce({ data: { results: [] } });

      await apiModule.tmdbApi.getTrending('movie', 'week');

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/tmdb/trending/movie/week')
      );
    });

    test('getMovieDetails calls correct endpoint', async () => {
      axios.get.mockResolvedValueOnce({ data: { id: 123 } });

      await apiModule.tmdbApi.getMovieDetails(123);

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/tmdb/movie/123')
      );
    });

    test('getTvDetails calls correct endpoint', async () => {
      axios.get.mockResolvedValueOnce({ data: { id: 456 } });

      await apiModule.tmdbApi.getTvDetails(456);

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/tmdb/tv/456')
      );
    });

    test('discover calls correct endpoint with params', async () => {
      axios.get.mockResolvedValueOnce({ data: { results: [] } });

      await apiModule.tmdbApi.discover('movie', { genre: 'action', year: 2024 });

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/tmdb/discover/movie'),
        expect.objectContaining({
          params: { genre: 'action', year: 2024 },
        })
      );
    });
  });

  describe('api.js - Watchlist API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('get uses apiClient (withCredentials)', async () => {
      apiModule.apiClient.get.mockResolvedValueOnce({ data: [] });

      await apiModule.watchlistApi.get();

      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/watchlist');
    });

    test('add posts to correct endpoint', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.watchlistApi.add({ tmdb_id: 123, media_type: 'movie' });

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/watchlist', { tmdb_id: 123, media_type: 'movie' });
    });

    test('remove deletes correct endpoint', async () => {
      apiModule.apiClient.delete.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.watchlistApi.remove(123);

      expect(apiModule.apiClient.delete).toHaveBeenCalledWith('/watchlist/123');
    });
  });

  describe('api.js - Progress API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('getNextUp calls correct endpoint', async () => {
      apiModule.apiClient.get.mockResolvedValueOnce({ data: [] });

      await apiModule.progressApi.getNextUp();

      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/next-up');
    });

    test('delete handles optional season/episode params', async () => {
      apiModule.apiClient.delete.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.progressApi.delete(123, 'tv', 1, 5);

      expect(apiModule.apiClient.delete).toHaveBeenCalledWith('/watch-progress', {
        params: { tmdb_id: 123, media_type: 'tv', season: 1, episode: 5 },
      });
    });

    test('delete works without season/episode', async () => {
      apiModule.apiClient.delete.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.progressApi.delete(123, 'movie');

      expect(apiModule.apiClient.delete).toHaveBeenCalledWith('/watch-progress', {
        params: { tmdb_id: 123, media_type: 'movie' },
      });
    });
  });

  describe('api.js - Downloads API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('add posts with correct payload', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { id: 1 } });

      await apiModule.downloadsApi.add('Test Movie', 'movie', 123, 1000000);

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/downloads', {
        title: 'Test Movie',
        media_type: 'movie',
        tmdb_id: 123,
        size: 1000000,
      });
    });

    test('update patches correct endpoint', async () => {
      apiModule.apiClient.patch.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.downloadsApi.update(1, 'downloading', 50);

      expect(apiModule.apiClient.patch).toHaveBeenCalledWith('/downloads/1', { status: 'downloading', progress: 50 });
    });
  });

  describe('api.js - Settings API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('get fetches settings', async () => {
      apiModule.apiClient.get.mockResolvedValueOnce({ data: { theme_mode: 'dark' } });

      const result = await apiModule.settingsApi.get();

      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/settings');
      expect(result.data.theme_mode).toBe('dark');
    });

    test('update puts settings', async () => {
      apiModule.apiClient.put.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.settingsApi.update({ theme_mode: 'light' });

      expect(apiModule.apiClient.put).toHaveBeenCalledWith('/settings', { theme_mode: 'light' });
    });
  });

  describe('api.js - Indexers API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('addIndexer sends correct payload', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { id: 1 } });

      await apiModule.indexersApi.add({ name: 'Test', url: 'http://test.com', api_key: 'key' });

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/indexers', { name: 'Test', url: 'http://test.com', api_key: 'key' });
    });
  });

  describe('api.js - Streaming API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('update sends enabled and username', async () => {
      apiModule.apiClient.put.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.streamingApi.update(1, true, 'username');

      expect(apiModule.apiClient.put).toHaveBeenCalledWith('/streaming-services/1', { enabled: true, username: 'username' });
    });
  });

  describe('api.js - Library API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('getAll passes media_type param', async () => {
      apiModule.apiClient.get.mockResolvedValueOnce({ data: [] });

      await apiModule.libraryApi.getAll('movie');

      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/library', { params: { media_type: 'movie' } });
    });

    test('getRecentlyAdded passes limit param', async () => {
      apiModule.apiClient.get.mockResolvedValueOnce({ data: [] });

      await apiModule.libraryApi.getRecentlyAdded(50);

      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/marmalade/media/recent', { params: { limit: 50 } });
    });
  });

  describe('api.js - Media Health API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('checkFile sends file_path and compute_hash', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { healthy: true } });

      await apiModule.mediaHealthApi.checkFile('/path/to/file.mkv', true);

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/media/health-check', { file_path: '/path/to/file.mkv', compute_hash: true });
    });

    test('repairFile sends file_path and output_path', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.mediaHealthApi.repairFile('/path/to/file.mkv', '/path/to/repaired.mkv');

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/media/repair', { file_path: '/path/to/file.mkv', output_path: '/path/to/repaired.mkv' });
    });

    test('scanLibrary sends directory', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.mediaHealthApi.scanLibrary('/media/movies');

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/media/scan-library', { directory: '/media/movies' });
    });
  });

  describe('api.js - Auth API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('logout uses apiClient', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.authApi.logout();

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/auth/logout');
    });

    test('getMe uses apiClient', async () => {
      apiModule.apiClient.get.mockResolvedValueOnce({ data: { id: 1 } });

      await apiModule.authApi.getMe();

      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/auth/me');
    });
  });

  describe('api.js - Compote API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('addIndexer sends all fields', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { id: 1 } });

      await apiModule.compoteApi.addIndexer('Test', 'prowlarr', 'http://test.com', 'apikey', true, 50, { cloudflare_protected: true });

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/compote/indexers', expect.objectContaining({
        name: 'Test',
        indexer_type: 'prowlarr',
        url: 'http://test.com',
        api_key: 'apikey',
        enabled: true,
        priority: 50,
        cloudflare_protected: true,
      }));
    });

    test('search limits results to 200', async () => {
      apiModule.apiClient.get.mockResolvedValueOnce({ data: [] });

      await apiModule.compoteApi.search('test', 'movies', 'seeders', 500);

      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/compote/search', expect.objectContaining({
        params: expect.objectContaining({ limit: 200 }),
      }));
    });

    test('grab sends correct params', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.compoteApi.grab('Test Movie', 'http://download.com', null, 1000000, true);

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/compote/grab', null, expect.objectContaining({
        params: expect.objectContaining({
          title: 'Test Movie',
          download_url: 'http://download.com',
          use_builtin: true,
        }),
      }));
    });
  });

  describe('api.js - qBittorrent API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('addTorrent sends magnet or url', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.qbittorrentApi.addTorrent(null, 'magnet:?xt=...', '/downloads', 'watchnexus');

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/qbittorrent/add', null, expect.objectContaining({
        params: expect.objectContaining({
          magnet: 'magnet:?xt=...',
          save_path: '/downloads',
          category: 'watchnexus',
        }),
      }));
    });

    test('testConnection sends credentials', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.qbittorrentApi.testConnection('localhost', 8080, 'admin', 'password');

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/qbittorrent/test', { host: 'localhost', port: 8080, username: 'admin', password: 'password' });
    });
  });

  describe('api.js - Subtitle API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('searchTV sends correct params', async () => {
      apiModule.apiClient.get.mockResolvedValueOnce({ data: [] });

      await apiModule.subtitleApi.searchTV('Show Name', 1, 5, 'en');

      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/subtitles/search/tv', expect.objectContaining({
        params: { show_name: 'Show Name', season: 1, episode: 5, languages: 'en' },
      }));
    });

    test('searchMovie sends correct params', async () => {
      apiModule.apiClient.get.mockResolvedValueOnce({ data: [] });

      await apiModule.subtitleApi.searchMovie('Movie Name', 2024, 'tt1234567', 'en');

      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/subtitles/search/movie', expect.objectContaining({
        params: { movie_name: 'Movie Name', year: 2024, imdb_id: 'tt1234567', languages: 'en' },
      }));
    });
  });

  describe('api.js - Gelatin API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('generateAccessToken validates permissions', async () => {
      await expect(apiModule.gelatinApi.generateAccessToken('invalid')).rejects.toThrow('Invalid permissions');
    });

    test('generateAccessToken accepts valid permissions', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { token: 'abc' } });

      await apiModule.gelatinApi.generateAccessToken('view,watch_party');

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/gelatin/access-token', null, expect.objectContaining({
        params: { permissions: 'view,watch_party' },
      }));
    });
  });

  describe('api.js - Streaming Logins API', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('addLogin sends service_id, email, password', async () => {
      apiModule.apiClient.post.mockResolvedValueOnce({ data: { success: true } });

      await apiModule.streamingLoginsApi.addLogin('netflix', 'user@test.com', 'password');

      expect(apiModule.apiClient.post).toHaveBeenCalledWith('/streaming-logins', { service_id: 'netflix', email: 'user@test.com', password: 'password' });
    });
  });

  describe('api.js - Health Check', () => {
    let apiModule;

    beforeEach(() => {
      jest.resetModules();
      apiModule = require('../../services/api');
    });

    test('healthCheck calls /health', async () => {
      apiModule.apiClient.get.mockResolvedValueOnce({ data: { status: 'ok' } });

      await apiModule.healthCheck();

      expect(apiModule.apiClient.get).toHaveBeenCalledWith('/health');
    });
  });
});

describe('marmaladeApi.js - Marmalade Client', () => {
  let marmaladeModule;

  beforeEach(() => {
    jest.resetModules();
    marmaladeModule = require('../../services/marmaladeApi');
  });

  test('marmaladeClient configured with withCredentials: true', () => {
    expect(marmaladeModule.default.defaults.withCredentials).toBe(true);
    expect(marmaladeModule.default.defaults.timeout).toBe(30000);
    expect(marmaladeModule.default.defaults.baseURL).toContain('/api/marmalade');
  });

  test('marmaladeLibrary.getLibraries calls correct endpoint', async () => {
    marmaladeModule.default.get.mockResolvedValueOnce({ data: [] });

    await marmaladeModule.marmaladeLibrary.getLibraries();

    expect(marmaladeModule.default.get).toHaveBeenCalledWith('/libraries');
  });

  test('marmaladeLibrary.addLibrary sends correct payload', async () => {
    marmaladeModule.default.post.mockResolvedValueOnce({ data: { id: 1 } });

    await marmaladeModule.marmaladeLibrary.addLibrary('Movies', '/media/movies', 'movies');

    expect(marmaladeModule.default.post).toHaveBeenCalledWith('/libraries', { name: 'Movies', path: '/media/movies', media_type: 'movies' });
  });

  test('marmaladeMedia.getMedia passes params', async () => {
    marmaladeModule.default.get.mockResolvedValueOnce({ data: [] });

    await marmaladeModule.marmaladeMedia.getMedia({ library_id: 1, media_type: 'movie' });

    expect(marmaladeModule.default.get).toHaveBeenCalledWith('/media', { params: { library_id: 1, media_type: 'movie' } });
  });

  test('marmaladeMedia.search limits to 200', async () => {
    marmaladeModule.default.get.mockResolvedValueOnce({ data: [] });

    await marmaladeModule.marmaladeMedia.search('test', 500);

    expect(marmaladeModule.default.get).toHaveBeenCalledWith('/media/search', expect.objectContaining({
      params: { query: 'test', limit: 200 },
    }));
  });

  test('marmaladeStream.getStreamUrl resolves relative URLs', async () => {
    marmaladeModule.default.get.mockResolvedValueOnce({ data: { stream_url: '/stream/123' } });

    const result = await marmaladeModule.marmaladeStream.getStreamUrl(123);

    expect(result).toContain('/stream/123');
  });

  test('marmaladeStream.getStreamUrl uses absolute URLs as-is', async () => {
    marmaladeModule.default.get.mockResolvedValueOnce({ data: { stream_url: 'http://other.com/stream/123' } });

    const result = await marmaladeModule.marmaladeStream.getStreamUrl(123);

    expect(result).toBe('http://other.com/stream/123');
  });

  test('formatDuration formats correctly', () => {
    expect(marmaladeModule.formatDuration(0)).toBe('0:00');
    expect(marmaladeModule.formatDuration(65)).toBe('1:05');
    expect(marmaladeModule.formatDuration(3665)).toBe('1:01:05');
    expect(marmaladeModule.formatDuration(7200)).toBe('2:00:00');
  });

  test('formatResolution formats correctly', () => {
    expect(marmaladeModule.formatResolution(3840, 2160)).toBe('4K');
    expect(marmaladeModule.formatResolution(2560, 1440)).toBe('1440p');
    expect(marmaladeModule.formatResolution(1920, 1080)).toBe('1080p');
    expect(marmaladeModule.formatResolution(1280, 720)).toBe('720p');
    expect(marmaladeModule.formatResolution(854, 480)).toBe('480p');
    expect(marmaladeModule.formatResolution(640, 360)).toBe('360p');
    expect(marmaladeModule.formatResolution(0, 0)).toBe('');
  });
});

describe('nexusApi.js - Nexus API Client', () => {
  let nexusModule;

  beforeEach(() => {
    jest.resetModules();
    nexusModule = require('../../services/nexusApi');
  });

  test('apiClient configured with withCredentials: true', () => {
    expect(nexusModule.apiClient.defaults.withCredentials).toBe(true);
    expect(nexusModule.apiClient.defaults.timeout).toBe(30000);
  });

  test('securityApi.getStats calls correct endpoint', async () => {
    nexusModule.apiClient.get.mockResolvedValueOnce({ data: { stats: {} } });

    await nexusModule.securityApi.getStats();

    expect(nexusModule.apiClient.get).toHaveBeenCalledWith('/security/stats');
  });

  test('securityApi.getAuditLogs passes params', async () => {
    nexusModule.apiClient.get.mockResolvedValueOnce({ data: [] });

    await nexusModule.securityApi.getAuditLogs(2, 25, 'login', 1);

    expect(nexusModule.apiClient.get).toHaveBeenCalledWith('/security/audit', expect.objectContaining({
      params: { page: 2, page_size: 25, action: 'login', user_id: 1 },
    }));
  });

  test('vpnApi.getServerConfig calls correct endpoint', async () => {
    nexusModule.apiClient.get.mockResolvedValueOnce({ data: {} });

    await nexusModule.vpnApi.getServerConfig();

    expect(nexusModule.apiClient.get).toHaveBeenCalledWith('/vpn/server');
  });

  test('vpnApi.wgUp calls correct endpoint', async () => {
    nexusModule.apiClient.post.mockResolvedValueOnce({ data: { success: true } });

    await nexusModule.vpnApi.wgUp();

    expect(nexusModule.apiClient.post).toHaveBeenCalledWith('/vpn/server/wg-up');
  });

  test('systemApi.getHealth calls correct endpoint', async () => {
    nexusModule.apiClient.get.mockResolvedValueOnce({ data: { status: 'ok' } });

    await nexusModule.systemApi.getHealth();

    expect(nexusModule.apiClient.get).toHaveBeenCalledWith('/health');
  });

  test('libraryApi.scan calls correct endpoint', async () => {
    nexusModule.apiClient.post.mockResolvedValueOnce({ data: { success: true } });

    await nexusModule.libraryApi.scan(1);

    expect(nexusModule.apiClient.post).toHaveBeenCalledWith('/libraries/1/scan');
  });

  test('downloadApi.getStats calls engine status', async () => {
    nexusModule.apiClient.get.mockResolvedValueOnce({ data: {} });

    await nexusModule.downloadApi.getStats();

    expect(nexusModule.apiClient.get).toHaveBeenCalledWith('/downloads/engine/status');
  });

  test('logsApi.getLatest passes params', async () => {
    nexusModule.apiClient.get.mockResolvedValueOnce({ data: [] });

    await nexusModule.logsApi.getLatest(200, 'error');

    expect(nexusModule.apiClient.get).toHaveBeenCalledWith('/logs/latest', expect.objectContaining({
      params: { lines: 200, level: 'error' },
    }));
  });

  test('settingsApi.bulkSet posts to bulk endpoint', async () => {
    nexusModule.apiClient.post.mockResolvedValueOnce({ data: { success: true } });

    await nexusModule.settingsApi.bulkSet({ theme_mode: 'dark', ui_accent: 'violet' });

    expect(nexusModule.apiClient.post).toHaveBeenCalledWith('/settings/bulk', { theme_mode: 'dark', ui_accent: 'violet' });
  });

  test('integrationApi.updateTmdb sends api_key', async () => {
    nexusModule.apiClient.put.mockResolvedValueOnce({ data: { success: true } });

    await nexusModule.integrationApi.updateTmdb('test-api-key');

    expect(nexusModule.apiClient.put).toHaveBeenCalledWith('/settings/integrations/tmdb', { api_key: 'test-api-key' });
  });

  test('lobsterApi.pair calls correct endpoint', async () => {
    nexusModule.apiClient.post.mockResolvedValueOnce({ data: { success: true } });

    await nexusModule.lobsterApi.pair();

    expect(nexusModule.apiClient.post).toHaveBeenCalledWith('/lobster/pair');
  });
});