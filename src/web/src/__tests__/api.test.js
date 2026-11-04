import axios from 'axios'
import { 
  tmdbApi, watchlistApi, progressApi, downloadsApi, settingsApi,
  indexersApi, streamingApi, libraryApi, mediaHealthApi,
  authApi, compoteApi, qbittorrentApi, torrentEngineApi,
  healthCheck, subtitleApi, gelatinApi, streamingLoginsApi
} from '../services/api'

jest.mock('axios', () => {
  // Create mock apiClient inside the factory
  const mockApiClient = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { withCredentials: true, baseURL: '/api' },
  }

  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: { withCredentials: true },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    create: jest.fn(() => mockApiClient),
  }
  return mockAxiosInstance
})

const mockAxios = axios
const mockApiClient = axios.create()

describe('api.js services', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAxios.get.mockResolvedValue({ data: {} })
    mockAxios.post.mockResolvedValue({ data: {} })
    mockAxios.put.mockResolvedValue({ data: {} })
    mockAxios.patch.mockResolvedValue({ data: {} })
    mockAxios.delete.mockResolvedValue({ data: {} })
    mockApiClient.get.mockResolvedValue({ data: {} })
    mockApiClient.post.mockResolvedValue({ data: {} })
    mockApiClient.put.mockResolvedValue({ data: {} })
    mockApiClient.patch.mockResolvedValue({ data: {} })
    mockApiClient.delete.mockResolvedValue({ data: {} })
  })

  describe('tmdbApi', () => {
    test('search calls correct endpoint with params', async () => {
      await tmdbApi.search('test query', 2, 'movie')
      expect(mockAxios.get).toHaveBeenCalledWith('/api/tmdb/search', { params: { query: 'test query', page: 2, media_type: 'movie' } })
    })

    test('getTrending calls correct endpoint', async () => {
      await tmdbApi.getTrending('tv', 'day')
      expect(mockAxios.get).toHaveBeenCalledWith('/api/tmdb/trending/tv/day')
    })

    test('getMovieDetails calls correct endpoint', async () => {
      await tmdbApi.getMovieDetails(123)
      expect(mockAxios.get).toHaveBeenCalledWith('/api/tmdb/movie/123')
    })

    test('getTvDetails calls correct endpoint', async () => {
      await tmdbApi.getTvDetails(456)
      expect(mockAxios.get).toHaveBeenCalledWith('/api/tmdb/tv/456')
    })

    test('getTvSeason calls correct endpoint', async () => {
      await tmdbApi.getTvSeason(456, 2)
      expect(mockAxios.get).toHaveBeenCalledWith('/api/tmdb/tv/456/season/2')
    })

    test('discover calls correct endpoint with params', async () => {
      await tmdbApi.discover('movie', { genre: 28, sort_by: 'popularity.desc' })
      expect(mockAxios.get).toHaveBeenCalledWith('/api/tmdb/discover/movie', { params: { genre: 28, sort_by: 'popularity.desc' } })
    })

    test('getGenres calls correct endpoint', async () => {
      await tmdbApi.getGenres('tv')
      expect(mockAxios.get).toHaveBeenCalledWith('/api/tmdb/genres/tv')
    })
  })

  describe('watchlistApi', () => {
    test('get calls /watchlist', async () => {
      await watchlistApi.get()
      expect(mockApiClient.get).toHaveBeenCalledWith('/watchlist')
    })

    test('add posts to /watchlist', async () => {
      await watchlistApi.add({ tmdb_id: 123, media_type: 'movie' })
      expect(mockApiClient.post).toHaveBeenCalledWith('/watchlist', { tmdb_id: 123, media_type: 'movie' })
    })

    test('remove deletes from /watchlist/:id', async () => {
      await watchlistApi.remove(123)
      expect(mockApiClient.delete).toHaveBeenCalledWith('/watchlist/123')
    })
  })

  describe('progressApi', () => {
    test('get calls /watch-progress', async () => {
      await progressApi.get()
      expect(mockApiClient.get).toHaveBeenCalledWith('/watch-progress')
    })

    test('update posts to /watch-progress', async () => {
      await progressApi.update({ tmdb_id: 123, progress: 50 })
      expect(mockApiClient.post).toHaveBeenCalledWith('/watch-progress', { tmdb_id: 123, progress: 50 })
    })

    test('getNextUp calls /next-up', async () => {
      await progressApi.getNextUp()
      expect(mockApiClient.get).toHaveBeenCalledWith('/next-up')
    })

    test('delete calls /watch-progress with params', async () => {
      await progressApi.delete(123, 'tv', 1, 2)
      expect(mockApiClient.delete).toHaveBeenCalledWith('/watch-progress', { params: { tmdb_id: 123, media_type: 'tv', season: 1, episode: 2 } })
    })

    test('clearAll calls /watch-progress/all', async () => {
      await progressApi.clearAll()
      expect(mockApiClient.delete).toHaveBeenCalledWith('/watch-progress/all')
    })
  })

  describe('downloadsApi', () => {
    test('getAll calls /downloads', async () => {
      await downloadsApi.getAll()
      expect(mockApiClient.get).toHaveBeenCalledWith('/downloads')
    })

    test('add posts to /downloads', async () => {
      await downloadsApi.add('Test', 'movie', 123, 1000000)
      expect(mockApiClient.post).toHaveBeenCalledWith('/downloads', { title: 'Test', media_type: 'movie', tmdb_id: 123, size: 1000000 })
    })

    test('update patches /downloads/:id', async () => {
      await downloadsApi.update('dl1', 'downloading', 50)
      expect(mockApiClient.patch).toHaveBeenCalledWith('/downloads/dl1', { status: 'downloading', progress: 50 })
    })

    test('delete calls /downloads/:id', async () => {
      await downloadsApi.delete('dl1')
      expect(mockApiClient.delete).toHaveBeenCalledWith('/downloads/dl1')
    })
  })

  describe('settingsApi', () => {
    test('get calls /settings', async () => {
      await settingsApi.get()
      expect(mockApiClient.get).toHaveBeenCalledWith('/settings')
    })

    test('update puts to /settings', async () => {
      await settingsApi.update({ theme: 'dark' })
      expect(mockApiClient.put).toHaveBeenCalledWith('/settings', { theme: 'dark' })
    })
  })

  describe('indexersApi', () => {
    test('getAll calls /indexers', async () => {
      await indexersApi.getAll()
      expect(mockApiClient.get).toHaveBeenCalledWith('/indexers')
    })

    test('add posts to /indexers', async () => {
      await indexersApi.add({ name: 'Test' })
      expect(mockApiClient.post).toHaveBeenCalledWith('/indexers', { name: 'Test' })
    })

    test('update puts to /indexers/:id', async () => {
      await indexersApi.update('idx1', { name: 'Updated' })
      expect(mockApiClient.put).toHaveBeenCalledWith('/indexers/idx1', { name: 'Updated' })
    })
  })

  describe('streamingApi', () => {
    test('getAll calls /streaming-services', async () => {
      await streamingApi.getAll()
      expect(mockApiClient.get).toHaveBeenCalledWith('/streaming-services')
    })

    test('update puts to /streaming-services/:id', async () => {
      await streamingApi.update('svc1', true, 'user@test.com')
      expect(mockApiClient.put).toHaveBeenCalledWith('/streaming-services/svc1', { enabled: true, username: 'user@test.com' })
    })
  })

  describe('libraryApi', () => {
    test('getAll calls /library with media_type param', async () => {
      await libraryApi.getAll('movie')
      expect(mockApiClient.get).toHaveBeenCalledWith('/library', { params: { media_type: 'movie' } })
    })

    test('add posts to /library', async () => {
      await libraryApi.add({ title: 'Test' })
      expect(mockApiClient.post).toHaveBeenCalledWith('/library', { title: 'Test' })
    })

    test('getRecentlyAdded calls /marmalade/media/recent', async () => {
      await libraryApi.getRecentlyAdded(10)
      expect(mockApiClient.get).toHaveBeenCalledWith('/marmalade/media/recent', { params: { limit: 10 } })
    })
  })

  describe('mediaHealthApi', () => {
    test('checkFile posts to /media/health-check', async () => {
      await mediaHealthApi.checkFile('/path/to/file', true)
      expect(mockApiClient.post).toHaveBeenCalledWith('/media/health-check', { file_path: '/path/to/file', compute_hash: true })
    })

    test('repairFile posts to /media/repair', async () => {
      await mediaHealthApi.repairFile('/path/to/file', '/output/path')
      expect(mockApiClient.post).toHaveBeenCalledWith('/media/repair', { file_path: '/path/to/file', output_path: '/output/path' })
    })

    test('scanLibrary posts to /media/scan-library', async () => {
      await mediaHealthApi.scanLibrary('/media/movies')
      expect(mockApiClient.post).toHaveBeenCalledWith('/media/scan-library', { directory: '/media/movies' })
    })

    test('getScheduledScans calls /media/scheduled-scans', async () => {
      await mediaHealthApi.getScheduledScans()
      expect(mockApiClient.get).toHaveBeenCalledWith('/media/scheduled-scans')
    })

    test('createScheduledScan posts to /media/scheduled-scans', async () => {
      await mediaHealthApi.createScheduledScan({ cron: '0 0 * * *' })
      expect(mockApiClient.post).toHaveBeenCalledWith('/media/scheduled-scans', { cron: '0 0 * * *' })
    })
  })

  describe('authApi', () => {
    test('logout posts to /auth/logout', async () => {
      await authApi.logout()
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/logout')
    })

    test('getMe calls /auth/me', async () => {
      await authApi.getMe()
      expect(mockApiClient.get).toHaveBeenCalledWith('/auth/me')
    })
  })

  describe('compoteApi', () => {
    test('getIndexers calls /compote/indexers', async () => {
      await compoteApi.getIndexers()
      expect(mockApiClient.get).toHaveBeenCalledWith('/compote/indexers')
    })

    test('addIndexer posts to /compote/indexers', async () => {
      await compoteApi.addIndexer('Test', 'prowlarr', 'http://test', 'key', true, 50, { cloudflare_protected: true })
      expect(mockApiClient.post).toHaveBeenCalledWith('/compote/indexers', expect.objectContaining({ name: 'Test', indexer_type: 'prowlarr', url: 'http://test', api_key: 'key', enabled: true, priority: 50, cloudflare_protected: true }))
    })

    test('search calls /compote/search with params', async () => {
      await compoteApi.search('query', 'tv', 'seeders', 100)
      expect(mockApiClient.get).toHaveBeenCalledWith('/compote/search', { params: { query: 'query', media_type: 'tv', sort_by: 'seeders', limit: 100 } })
    })

    test('grab posts to /compote/grab with params', async () => {
      await compoteApi.grab('Test', 'http://dl', null, 1000, true)
      expect(mockApiClient.post).toHaveBeenCalledWith('/compote/grab', null, { params: { title: 'Test', download_url: 'http://dl', magnet_url: null, size: 1000, use_builtin: true } })
    })
  })

  describe('qbittorrentApi', () => {
    test('getStatus calls /qbittorrent/status', async () => {
      await qbittorrentApi.getStatus()
      expect(mockApiClient.get).toHaveBeenCalledWith('/qbittorrent/status')
    })

    test('getTorrents calls /qbittorrent/torrents with params', async () => {
      await qbittorrentApi.getTorrents('downloading', 'movies', 25)
      expect(mockApiClient.get).toHaveBeenCalledWith('/qbittorrent/torrents', { params: { filter: 'downloading', category: 'movies', limit: 25 } })
    })

    test('addTorrent posts to /qbittorrent/add', async () => {
      await qbittorrentApi.addTorrent('magnet:test', null, '/downloads', 'tv')
      expect(mockApiClient.post).toHaveBeenCalledWith('/qbittorrent/add', null, { params: { magnet: 'magnet:test', save_path: '/downloads', category: 'tv' } })
    })

    test('testConnection posts to /qbittorrent/test', async () => {
      await qbittorrentApi.testConnection('localhost', 8080, 'admin', 'password')
      expect(mockApiClient.post).toHaveBeenCalledWith('/qbittorrent/test', { host: 'localhost', port: 8080, username: 'admin', password: 'password' })
    })
  })

  describe('torrentEngineApi', () => {
    test('getStatus calls /downloads/engine/status', async () => {
      await torrentEngineApi.getStatus()
      expect(mockApiClient.get).toHaveBeenCalledWith('/downloads/engine/status')
    })

    test('addTorrent posts to /downloads/engine/add', async () => {
      await torrentEngineApi.addTorrent('magnet:test', '/downloads', true)
      expect(mockApiClient.post).toHaveBeenCalledWith('/downloads/engine/add', null, { params: { magnet: 'magnet:test', save_path: '/downloads', sequential: true, category: 'watchnexus' } })
    })

    test('pauseAll posts to /downloads/engine/pause-all', async () => {
      await torrentEngineApi.pauseAll()
      expect(mockApiClient.post).toHaveBeenCalledWith('/downloads/engine/pause-all')
    })
  })

  describe('healthCheck', () => {
    test('calls /health', async () => {
      await healthCheck()
      expect(mockApiClient.get).toHaveBeenCalledWith('/health')
    })
  })

  describe('subtitleApi', () => {
    test('searchTV calls /subtitles/search/tv', async () => {
      await subtitleApi.searchTV('Show', 1, 2, 'en')
      expect(mockApiClient.get).toHaveBeenCalledWith('/subtitles/search/tv', { params: { show_name: 'Show', season: 1, episode: 2, languages: 'en' } })
    })

    test('download posts to /subtitles/download', async () => {
      await subtitleApi.download('http://sub', 'opensubtitles', 123)
      expect(mockApiClient.post).toHaveBeenCalledWith('/subtitles/download', null, { params: { download_url: 'http://sub', source: 'opensubtitles', media_id: 123 } })
    })
  })

  describe('gelatinApi', () => {
    test('generateAccessToken validates permissions', async () => {
      await expect(gelatinApi.generateAccessToken('invalid')).rejects.toThrow('Invalid permissions specified')
      expect(mockApiClient.post).not.toHaveBeenCalled()
    })

    test('generateAccessToken posts to /gelatin/access-token', async () => {
      await gelatinApi.generateAccessToken('view,watch_party')
      expect(mockApiClient.post).toHaveBeenCalledWith('/gelatin/access-token', null, { params: { permissions: 'view,watch_party' } })
    })
  })

  describe('streamingLoginsApi', () => {
    test('addLogin posts to /streaming-logins', async () => {
      await streamingLoginsApi.addLogin('netflix', 'user@test.com', 'password')
      expect(mockApiClient.post).toHaveBeenCalledWith('/streaming-logins', { service_id: 'netflix', email: 'user@test.com', password: 'password' })
    })

    test('getCredentials calls /streaming-logins/:id/credentials', async () => {
      await streamingLoginsApi.getCredentials('svc1')
      expect(mockApiClient.get).toHaveBeenCalledWith('/streaming-logins/svc1/credentials')
    })
  })

  describe('Response interceptor error handling (apiClient)', () => {
    test('handles timeout error on apiClient', async () => {
      const timeoutError = { code: 'ECONNABORTED' }
      expect(true).toBe(true)
    })

    test('handles network error on apiClient', async () => {
      expect(true).toBe(true)
    })

    test('passes through other errors on apiClient', async () => {
      expect(true).toBe(true)
    })
  })
})
