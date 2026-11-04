import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DownloadsPage, POLL_MS } from '../pages/DownloadsPage'
import { torrentEngineApi, qbittorrentApi } from '../services/api'

// Empty / error states for the Downloads page: the engine API used to 404 and
// the page polled it every 2s forever, failing silently.

jest.mock('../components/layout/Layout', () => ({
  Layout: ({ children }) => <div data-testid="layout">{children}</div>,
}))

jest.mock('../services/api', () => ({
  torrentEngineApi: {
    getStatus: jest.fn(),
    getTorrents: jest.fn(),
    addTorrent: jest.fn(),
    pauseTorrent: jest.fn(),
    resumeTorrent: jest.fn(),
    removeTorrent: jest.fn(),
    setSequential: jest.fn(),
    getFiles: jest.fn(),
  },
  qbittorrentApi: {
    getStatus: jest.fn(),
    getTorrents: jest.fn(),
    pauseTorrent: jest.fn(),
    resumeTorrent: jest.fn(),
    deleteTorrent: jest.fn(),
    addTorrent: jest.fn(),
  },
}))

jest.mock('../hooks/use-confirm', () => ({
  useConfirm: () => ({ confirm: jest.fn().mockResolvedValue(true), ConfirmDialog: () => null }),
}))

const httpError = (status, data = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } })

const renderPage = () => render(<MemoryRouter><DownloadsPage /></MemoryRouter>)

const advance = async (ms) => {
  await act(async () => { jest.advanceTimersByTime(ms) })
}

const setMode = (mode) => {
  window.localStorage.getItem.mockImplementation((k) => (k === 'watchnexus_download_mode' ? mode : null))
}

describe('DownloadsPage empty / error states', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    setMode('builtin')
    qbittorrentApi.getStatus.mockResolvedValue({ data: { connected: false, status: 'not_configured' } })
    qbittorrentApi.getTorrents.mockResolvedValue({ data: [] })
    torrentEngineApi.getTorrents.mockResolvedValue({ data: [] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('engine reports not_configured → shows configure prompt and stops polling', async () => {
    torrentEngineApi.getStatus.mockResolvedValue({
      data: { success: false, configured: false, status: 'not_configured', message: 'No download client is configured. Connect qBittorrent in Settings → Downloads.' },
    })

    renderPage()

    expect(await screen.findByTestId('downloads-client-message')).toBeInTheDocument()
    expect(screen.getByText('Configure a download client')).toBeInTheDocument()
    expect(screen.getByTestId('downloads-client-message-text')).toHaveTextContent('No download client is configured')
    expect(screen.getByText('Open Download Settings').closest('a')).toHaveAttribute('href', '/settings')
    expect(torrentEngineApi.getTorrents).not.toHaveBeenCalled()

    await advance(POLL_MS * 10)
    expect(torrentEngineApi.getStatus).toHaveBeenCalledTimes(1)
  })

  test.each([404, 501])('engine endpoint returns %i → inline message and polling stops', async (status) => {
    torrentEngineApi.getStatus.mockRejectedValue(httpError(status, status === 501 ? { error: 'Engine not supported here', code: 'not_supported' } : { detail: 'Not Found' }))

    renderPage()

    expect(await screen.findByTestId('downloads-client-message')).toBeInTheDocument()
    expect(screen.getByText('Downloads unavailable')).toBeInTheDocument()
    expect(screen.getByTestId('downloads-client-message-text')).toHaveTextContent(
      status === 501 ? 'Engine not supported here' : 'Not Found',
    )
    expect(screen.queryByText('No Downloads')).not.toBeInTheDocument()

    await advance(POLL_MS * 30)
    expect(torrentEngineApi.getStatus).toHaveBeenCalledTimes(1)
  })

  test('tier-locked status shows upgrade message without polling', async () => {
    torrentEngineApi.getStatus.mockResolvedValue({
      data: { success: false, configured: true, status: 'tier_locked', message: 'Download clients require a ultra license.' },
    })

    renderPage()

    expect(await screen.findByText('Upgrade required')).toBeInTheDocument()
    await advance(POLL_MS * 10)
    expect(torrentEngineApi.getStatus).toHaveBeenCalledTimes(1)
  })

  test('transient failure backs off instead of polling every 2s', async () => {
    torrentEngineApi.getStatus.mockRejectedValue(new Error('Network error. Please check your connection.'))

    renderPage()

    expect(await screen.findByText('Download client unreachable')).toBeInTheDocument()
    expect(screen.getByTestId('downloads-client-message-text')).toHaveTextContent('Network error')
    expect(torrentEngineApi.getStatus).toHaveBeenCalledTimes(1)

    // First retry waits 2 * POLL_MS, not POLL_MS.
    await advance(POLL_MS)
    expect(torrentEngineApi.getStatus).toHaveBeenCalledTimes(1)
    await advance(POLL_MS)
    await waitFor(() => expect(torrentEngineApi.getStatus).toHaveBeenCalledTimes(2))

    // Second retry waits 4 * POLL_MS.
    await advance(POLL_MS * 3)
    expect(torrentEngineApi.getStatus).toHaveBeenCalledTimes(2)
    await advance(POLL_MS)
    await waitFor(() => expect(torrentEngineApi.getStatus).toHaveBeenCalledTimes(3))
  })

  test('Retry button resumes polling after a terminal stop', async () => {
    torrentEngineApi.getStatus
      .mockResolvedValueOnce({ data: { success: false, configured: false, status: 'not_configured', message: 'No download client is configured.' } })
      .mockResolvedValue({ data: { success: true, configured: true, status: 'connected', engine: 'qBittorrent', version: 'v4.6.2' } })
    torrentEngineApi.getTorrents.mockResolvedValue({
      data: [{ id: 'a'.repeat(40), name: 'Sintel', state: 'downloading', progress: 25, download_rate: 0, upload_rate: 0, download_rate_formatted: '0 B/s', upload_rate_formatted: '0 B/s', total_size_formatted: '1.0 GB', eta_formatted: '∞', num_seeds: 1, num_peers: 2, sequential: false }],
    })

    renderPage()
    expect(await screen.findByText('Configure a download client')).toBeInTheDocument()

    await act(async () => { fireEvent.click(screen.getByText('Retry')) })

    expect(await screen.findByText('Sintel')).toBeInTheDocument()
    expect(screen.queryByTestId('downloads-client-message')).not.toBeInTheDocument()
    expect(screen.getByText('Connected via qBittorrent v4.6.2')).toBeInTheDocument()
  })

  test('qBittorrent mode: connected=true status (real backend shape) loads torrents', async () => {
    setMode('qbittorrent')
    qbittorrentApi.getStatus.mockResolvedValue({ data: { connected: true, status: 'connected', version: 'v4.6.2' } })
    qbittorrentApi.getTorrents.mockResolvedValue({
      data: [{ hash: 'h1', name: 'Tears of Steel', state: 'downloading', progress: 0.5, dlspeed: 0, upspeed: 0, size: 0, num_seeds: 1, num_leechs: 0 }],
    })

    renderPage()

    expect(await screen.findByText('Tears of Steel')).toBeInTheDocument()
    expect(screen.getByText('qBittorrent v4.6.2')).toBeInTheDocument()
    expect(torrentEngineApi.getStatus).not.toHaveBeenCalled()
  })

  test('qBittorrent mode: not configured shows configure prompt and stops polling', async () => {
    setMode('qbittorrent')

    renderPage()

    expect(await screen.findByText('Configure a download client')).toBeInTheDocument()
    expect(screen.getByTestId('downloads-client-message-text')).toHaveTextContent('qBittorrent is not configured')
    await advance(POLL_MS * 10)
    expect(qbittorrentApi.getStatus).toHaveBeenCalledTimes(1)
    expect(qbittorrentApi.getTorrents).not.toHaveBeenCalled()
  })
})
