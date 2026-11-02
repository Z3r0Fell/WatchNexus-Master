import axios from 'axios'

jest.mock('axios', () => {
  const client = {
    get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    defaults: {},
  }
  return { create: jest.fn(() => client), defaults: {}, __client: client }
})

// eslint-disable-next-line import/first
import { handleUnauthorized, __resetUnauthorizedGuard } from '../services/api'

const fakeWindow = (pathname = '/movies', search = '') => ({
  location: { pathname, search, assign: jest.fn() },
  localStorage: { removeItem: jest.fn() },
})

// The first interceptor registered in services/api.js belongs to the base
// apiClient. Capture it at load time (CRA's resetMocks clears calls per test).
const capturedRejectHandler = axios.__client.interceptors.response.use.mock.calls[0][1]
const responseRejectHandler = () => capturedRejectHandler

describe('apiClient 401 handling', () => {
  beforeEach(() => __resetUnauthorizedGuard())

  test('redirects to /login and clears legacy tokens on 401', () => {
    const win = fakeWindow('/movies', '?page=2')
    expect(handleUnauthorized({ url: '/settings' }, win)).toBe(true)
    expect(win.location.assign).toHaveBeenCalledWith('/login?redirect=%2Fmovies%3Fpage%3D2')
    expect(win.localStorage.removeItem).toHaveBeenCalledWith('token')
    expect(win.localStorage.removeItem).toHaveBeenCalledWith('watchnexus_user')
  })

  test('does not redirect for the login request itself', () => {
    const win = fakeWindow()
    expect(handleUnauthorized({ baseURL: '/api', url: '/auth/login' }, win)).toBe(false)
    expect(win.location.assign).not.toHaveBeenCalled()
  })

  test('does not redirect when already on the login page (no loop)', () => {
    const win = fakeWindow('/login')
    expect(handleUnauthorized({ url: '/settings' }, win)).toBe(false)
    expect(win.location.assign).not.toHaveBeenCalled()
  })

  test('only redirects once for a burst of 401s', () => {
    const win = fakeWindow()
    handleUnauthorized({ url: '/a' }, win)
    handleUnauthorized({ url: '/b' }, win)
    expect(win.location.assign).toHaveBeenCalledTimes(1)
  })

  test('interceptor rejects with the original error on 401 and leaves non-401 alone', async () => {
    const onRejected = responseRejectHandler()
    // On /login already, so the redirect is suppressed in jsdom.
    window.history.pushState({}, '', '/login')
    const err401 = { response: { status: 401 }, config: { url: '/settings' } }
    await expect(onRejected(err401)).rejects.toBe(err401)
    const err500 = { response: { status: 500 }, config: { url: '/settings' } }
    await expect(onRejected(err500)).rejects.toBe(err500)
  })

  test('interceptor triggers the redirect on 401 from a protected page', async () => {
    const onRejected = responseRejectHandler()
    const original = window.location
    delete window.location
    window.location = { pathname: '/settings', search: '', assign: jest.fn() }
    try {
      const err = { response: { status: 401 }, config: { url: '/media/notifications' } }
      await expect(onRejected(err)).rejects.toBe(err)
      expect(window.location.assign).toHaveBeenCalledWith('/login?redirect=%2Fsettings')
    } finally {
      window.location = original
    }
  })
})
