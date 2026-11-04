import { 
  marmaladeStatus, marmaladeLibrary, marmaladeMedia, marmaladeStream, marmaladeProgress,
  formatDuration, formatResolution
} from '../services/marmaladeApi'
import axios from 'axios'

// marmaladeApi.js talks to an axios.create() instance (baseURL /api/marmalade,
// withCredentials set on the instance, not per call). The instance delegates to
// the top-level jest.fn()s the tests stub/assert, and runs results through the
// response interceptor the module registers so error mapping is exercised.
jest.mock('axios', () => {
  const responseHandlers = []
  const top = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: { withCredentials: true },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  }
  const through = (fn) => (...args) => {
    let p = Promise.resolve().then(() => fn(...args))
    responseHandlers.forEach(([ok, err]) => { p = p.then(ok, err) })
    return p
  }
  top.create = (config) => ({
    get: through((...a) => top.get(...a)),
    post: through((...a) => top.post(...a)),
    put: through((...a) => top.put(...a)),
    patch: through((...a) => top.patch(...a)),
    delete: through((...a) => top.delete(...a)),
    defaults: { ...config },
    interceptors: {
      request: { use: () => 0 },
      response: { use: (ok, err) => { responseHandlers.push([ok || (r => r), err || (e => Promise.reject(e))]); return 0 } },
    },
  })
  return top
})

const mockAxios = axios

describe('marmaladeApi.js services', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAxios.get.mockResolvedValue({ data: {} })
    mockAxios.post.mockResolvedValue({ data: {} })
    mockAxios.put.mockResolvedValue({ data: {} })
    mockAxios.delete.mockResolvedValue({ data: {} })
  })

  describe('marmaladeStatus', () => {
    test('getStatus calls /status', async () => {
      await marmaladeStatus.getStatus()
      expect(mockAxios.get).toHaveBeenCalledWith('/status')
    })
  })

  describe('marmaladeLibrary', () => {
    test('getLibraries calls /libraries', async () => {
      await marmaladeLibrary.getLibraries()
      expect(mockAxios.get).toHaveBeenCalledWith('/libraries')
    })

    test('addLibrary posts to /libraries with params', async () => {
      await marmaladeLibrary.addLibrary('Movies', '/movies', 'movies')
      expect(mockAxios.post).toHaveBeenCalledWith('/libraries', { name: 'Movies', path: '/movies', media_type: 'movies' })
    })

    test('removeLibrary deletes /libraries/:id', async () => {
      await marmaladeLibrary.removeLibrary('lib1')
      expect(mockAxios.delete).toHaveBeenCalledWith('/libraries/lib1')
    })

    test('scanLibrary posts to /libraries/:id/scan', async () => {
      await marmaladeLibrary.scanLibrary('lib1')
      // long-running synchronous scan gets an extended timeout
      expect(mockAxios.post).toHaveBeenCalledWith('/libraries/lib1/scan', null, expect.objectContaining({ timeout: expect.any(Number) }))
    })

    test('refreshMetadata posts to /libraries/:id/refresh-metadata', async () => {
      await marmaladeLibrary.refreshMetadata('lib1')
      expect(mockAxios.post).toHaveBeenCalledWith('/libraries/lib1/refresh-metadata', null, expect.objectContaining({ timeout: expect.any(Number) }))
    })
  })

  describe('marmaladeMedia', () => {
    test('getMedia calls /media with params', async () => {
      await marmaladeMedia.getMedia({ media_type: 'movie', limit: 50 })
      expect(mockAxios.get).toHaveBeenCalledWith('/media', { params: { media_type: 'movie', limit: 50 } })
    })

    test('getMediaItem calls /media/:id', async () => {
      await marmaladeMedia.getMediaItem('media1')
      expect(mockAxios.get).toHaveBeenCalledWith('/media/media1')
    })

    test('getRecent calls /media/recent with limit', async () => {
      await marmaladeMedia.getRecent(10)
      expect(mockAxios.get).toHaveBeenCalledWith('/media/recent', { params: { limit: 10 } })
    })

    test('search calls /media/search with params', async () => {
      await marmaladeMedia.search('query', 100)
      expect(mockAxios.get).toHaveBeenCalledWith('/media/search', { params: { query: 'query', limit: 100 } })
    })

    test('getContinueWatching calls /continue-watching', async () => {
      await marmaladeMedia.getContinueWatching(5)
      expect(mockAxios.get).toHaveBeenCalledWith('/continue-watching', { params: { limit: 5 } })
    })

    test('getTVSeriesGrouped calls /tv-series', async () => {
      await marmaladeMedia.getTVSeriesGrouped('lib1')
      expect(mockAxios.get).toHaveBeenCalledWith('/tv-series', { params: { library_id: 'lib1' } })
    })
  })

  describe('marmaladeProgress', () => {
    test('updateProgress posts to /media/:id/progress', async () => {
      await marmaladeProgress.updateProgress('media1', 50)
      // backend binds progress/watched from the query string
      expect(mockAxios.post).toHaveBeenCalledWith('/media/media1/progress', null, { params: { progress: 50 } })
    })

    test('markWatched posts to /media/:id/watched', async () => {
      await marmaladeProgress.markWatched('media1', true)
      expect(mockAxios.post).toHaveBeenCalledWith('/media/media1/watched', null, { params: { watched: true } })
    })
  })

  describe('marmaladeStream', () => {
    test('getStreamInfo calls /stream/:id with quality', async () => {
      await marmaladeStream.getStreamInfo('media1', '1080p')
      expect(mockAxios.get).toHaveBeenCalledWith('/stream/media1', { params: { quality: '1080p' } })
    })

    test('getStreamUrl resolves absolute URL', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { stream_url: 'http://stream/server/video.mp4' } })
      const url = await marmaladeStream.getStreamUrl('media1')
      expect(url).toBe('http://stream/server/video.mp4')
    })

    test('getStreamUrl resolves relative URL', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { stream_url: '/api/marmalade/stream/video.mp4' } })
      const url = await marmaladeStream.getStreamUrl('media1')
      expect(url).toContain('/api/marmalade/stream/video.mp4')
    })

    test('getStreamUrl throws on missing stream_url', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: {} })
      await expect(marmaladeStream.getStreamUrl('media1')).rejects.toThrow('No stream URL returned from server')
    })
  })

  describe('formatDuration', () => {
    test('formats seconds to M:SS', () => {
      expect(formatDuration(90)).toBe('1:30')
      expect(formatDuration(3661)).toBe('1:01:01')
      expect(formatDuration(0)).toBe('0:00')
      expect(formatDuration(null)).toBe('0:00')
    })
  })

  describe('formatResolution', () => {
    test('returns 4K for 2160p+', () => {
      expect(formatResolution(3840, 2160)).toBe('4K')
    })

    test('returns 1440p for 1440p+', () => {
      expect(formatResolution(2560, 1440)).toBe('1440p')
    })

    test('returns 1080p for 1080p+', () => {
      expect(formatResolution(1920, 1080)).toBe('1080p')
    })

    test('returns 720p for 720p+', () => {
      expect(formatResolution(1280, 720)).toBe('720p')
    })

    test('returns 480p for 480p+', () => {
      expect(formatResolution(854, 480)).toBe('480p')
    })

    test('returns {height}p for other', () => {
      expect(formatResolution(640, 360)).toBe('360p')
    })

    test('returns empty string for missing dimensions', () => {
      expect(formatResolution(null, 1080)).toBe('')
      expect(formatResolution(1920, null)).toBe('')
    })
  })

  describe('Error handling', () => {
    test('handles timeout error', async () => {
      const timeoutError = { code: 'ECONNABORTED' }
      mockAxios.get.mockRejectedValue(timeoutError)
      
      await expect(marmaladeStatus.getStatus()).rejects.toThrow('Request timed out. Please try again.')
    })

    test('handles network error', async () => {
      const networkError = { code: 'ERR_NETWORK' }
      delete networkError.response
      mockAxios.get.mockRejectedValue(networkError)
      
      await expect(marmaladeStatus.getStatus()).rejects.toThrow('Network error. Please check your connection.')
    })

    test('passes through API errors', async () => {
      const apiError = { response: { status: 404, data: { detail: 'Not found' } } }
      mockAxios.get.mockRejectedValue(apiError)
      
      await expect(marmaladeStatus.getStatus()).rejects.toEqual(apiError)
    })
  })
})