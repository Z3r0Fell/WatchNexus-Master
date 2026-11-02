import { render, screen, waitFor, act } from '@testing-library/react'

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  defaults: {},
}))

import axios from 'axios'
import { AuthProvider, useAuth } from '../context/AuthContext'

const Probe = () => {
  const { user, isAuthenticated, loading } = useAuth()
  if (loading) return <div data-testid="auth-loading">loading</div>
  return (
    <div>
      <div data-testid="auth-state">{isAuthenticated ? 'in' : 'out'}</div>
      <div data-testid="auth-user">{user?.username || 'none'}</div>
    </div>
  )
}

describe('AuthContext (httpOnly cookie auth)', () => {
  afterEach(() => jest.clearAllMocks())

  test('starts unauthenticated when /users/me returns 401', async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 401 } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('out'))
    expect(screen.getByTestId('auth-user')).toHaveTextContent('none')
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/users/me'), expect.objectContaining({ withCredentials: true }))
  })

  test('hydrates session from /users/me cookie probe and normalizes PascalCase', async () => {
    axios.get.mockResolvedValueOnce({ data: { Id: '1', Username: 'owner', Email: 'owner@watchnexus.local', Role: 'admin' } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('in'))
    expect(screen.getByTestId('auth-user')).toHaveTextContent('owner')
  })

  test('login sets user state from backend response', async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 401 } })
    axios.post.mockResolvedValueOnce({ data: { user: { id: '1', username: 'owner' } } })

    let auth
    const Grab = () => { auth = useAuth(); return <Probe />; }
    render(<AuthProvider><Grab /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('out'))

    await act(async () => { await auth.login('owner@watchnexus.local', 'password123'); })
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      { email: 'owner@watchnexus.local', password: 'password123' },
      expect.objectContaining({ withCredentials: true })
    )
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('in'))
  })

  test('login normalizes camelCase user (createdAt) to the same shape as fetchUser', async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 401 } })
    axios.post.mockResolvedValueOnce({ data: { user: {
      id: '1', email: 'owner@watchnexus.local', username: 'owner', avatar: null, role: 'admin', createdAt: '2026-01-02T03:04:05Z',
    } } })

    let auth
    const Grab = () => { auth = useAuth(); return <Probe />; }
    render(<AuthProvider><Grab /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('out'))

    let returned
    await act(async () => { returned = await auth.login('owner@watchnexus.local', 'password123'); })
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('in'))
    const expected = {
      id: '1', email: 'owner@watchnexus.local', username: 'owner', avatar: null, role: 'admin', created_at: '2026-01-02T03:04:05Z',
    }
    expect(auth.user).toEqual(expected)
    expect(returned).toEqual(expected)
    expect(auth.user).not.toHaveProperty('createdAt')
  })

  test('fetchUser accepts camelCase createdAt too', async () => {
    axios.get.mockResolvedValueOnce({ data: { id: '1', username: 'owner', createdAt: '2026-01-02T03:04:05Z' } })
    let auth
    const Grab = () => { auth = useAuth(); return <Probe />; }
    render(<AuthProvider><Grab /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('in'))
    expect(auth.user.created_at).toBe('2026-01-02T03:04:05Z')
  })

  test('logout calls backend and clears state even if request fails', async () => {
    axios.get.mockResolvedValueOnce({ data: { Id: '1', Username: 'owner' } })
    axios.post.mockRejectedValueOnce(new Error('network'))

    let auth
    const Grab = () => { auth = useAuth(); return <Probe />; }
    render(<AuthProvider><Grab /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('in'))

    await act(async () => { await auth.logout(); })
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/auth/logout'), {}, expect.objectContaining({ withCredentials: true }))
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('out'))
  })
})
