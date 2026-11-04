import { render, screen, waitFor, act, userEvent } from './test-utils'
import { DownloadsPage } from '../pages/DownloadsPage'
import { torrentEngineApi, qbittorrentApi } from '../services/api'
import { useConfirm } from '../hooks/use-confirm'

jest.mock('../services/api', () => ({
  ...jest.requireActual('../services/api'),
  torrentEngineApi: {
    getStatus: jest.fn(),
    getTorrents: jest.fn(),
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
  formatFileSize: jest.fn((b) => `${Math.round(b/1024/1024)}MB`),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
  Toaster: () => null,
}))

// The Pause/Resume and Remove buttons are icon-only (no title/aria-label), so
// locate them by their lucide icon inside the torrent card.
const iconButton = (iconClass) => {
  const svg = document.querySelector(`svg.${iconClass}`)
  return svg && svg.closest('button')
}

jest.mock('../hooks/use-confirm', () => ({
  useConfirm: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    ConfirmDialog: () => null,
  }),
}))

jest.mock('../components/ui/progress', () => ({
  Progress: ({ value }) => <div data-testid="progress" style={{ width: `${value}%` }} />,
}))

describe('DownloadsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()

    qbittorrentApi.getStatus.mockResolvedValue({ data: { success: true, version: '4.5.0' } })
    qbittorrentApi.getTorrents.mockResolvedValue({ data: [
      // qBittorrent reports progress as a 0..1 fraction (the page shows it x100)
      { hash: 'hash1', name: 'Test Movie', state: 'downloading', progress: 0.5, dlspeed: 1024*1024, upspeed: 512*1024, size: 1024*1024*1024, num_seeds: 10, num_leechs: 5 },
      { hash: 'hash2', name: 'Test Show', state: 'seeding', progress: 1, dlspeed: 0, upspeed: 1024*1024, size: 1024*1024*500, num_seeds: 5, num_leechs: 0 },
    ]})
    torrentEngineApi.getStatus.mockResolvedValue({ data: { success: false } })
    torrentEngineApi.getTorrents.mockResolvedValue({ data: [] })
  })

  test('renders downloads page with header', async () => {
    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByTestId('downloads-page')).toBeInTheDocument())
    // "Downloads" is also a Sidebar entry: target the page heading
    expect(screen.getByRole('heading', { level: 1, name: 'Downloads' })).toBeInTheDocument()
    expect(screen.getByText('Manage your download queue')).toBeInTheDocument()
  })

  test('shows stats cards', async () => {
    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByText('Test Movie')).toBeInTheDocument())
    // "Active" counts only downloading torrents (1 of the 2; the other is seeding)
    expect(screen.getByText('Active').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('↓ Speed')).toBeInTheDocument()
    expect(screen.getByText('↑ Speed')).toBeInTheDocument()
  })

  test('shows mode toggle (Built-in / qBittorrent)', async () => {
    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByText('Built-in (soon)')).toBeInTheDocument())
    expect(screen.getByText('qBittorrent')).toBeInTheDocument()
  })

  test('shows qBittorrent as active by default', async () => {
    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByText('qBittorrent v4.5.0')).toBeInTheDocument())
    // the built-in-engine notice only appears in Built-in mode
    expect(screen.queryByTestId('builtin-engine-notice')).not.toBeInTheDocument()
  })

  test('shows torrent list', async () => {
    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByText('Test Movie')).toBeInTheDocument())
    expect(screen.getByText('Test Show')).toBeInTheDocument()
    expect(screen.getByText('downloading')).toBeInTheDocument()
    expect(screen.getByText('seeding')).toBeInTheDocument()
  })

  test('shows progress bars', async () => {
    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getAllByTestId('progress')).toHaveLength(2))
    expect(screen.getAllByTestId('progress')[0]).toHaveStyle({ width: '50%' })
  })

  test('shows speed and ETA', async () => {
    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getAllByText('1 MB/s').length).toBeGreaterThan(0))
    expect(screen.getByText('Seeds: 10')).toBeInTheDocument()
    expect(screen.getByText('Peers: 5')).toBeInTheDocument()
  })

  test('pauses/resumes torrent', async () => {
    qbittorrentApi.pauseTorrent.mockResolvedValue({ data: {} })
    qbittorrentApi.resumeTorrent.mockResolvedValue({ data: {} })
    qbittorrentApi.getTorrents.mockResolvedValue({ data: [{ hash: 'hash1', name: 'Test Movie', state: 'downloading', progress: 0.5, dlspeed: 0, upspeed: 0, size: 1024*1024*1024, num_seeds: 10, num_leechs: 5 }] })

    const { unmount } = render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByText('Test Movie')).toBeInTheDocument())

    // downloading -> Pause button pauses
    await act(async () => {
      await userEvent.click(iconButton('lucide-pause'))
    })
    expect(qbittorrentApi.pauseTorrent).toHaveBeenCalledWith('hash1')

    // paused -> the same button (Play icon) resumes
    qbittorrentApi.getTorrents.mockResolvedValue({ data: [{ hash: 'hash1', name: 'Test Movie', state: 'pausedDL', progress: 0.5, dlspeed: 0, upspeed: 0, size: 1024*1024*1024, num_seeds: 10, num_leechs: 5 }] })
    unmount()
    render(<DownloadsPage />)
    await waitFor(() => expect(iconButton('lucide-play')).not.toBeNull())
    await act(async () => {
      await userEvent.click(iconButton('lucide-play'))
    })
    expect(qbittorrentApi.resumeTorrent).toHaveBeenCalledWith('hash1')
  })

  test('deletes torrent with confirmation', async () => {
    qbittorrentApi.deleteTorrent.mockResolvedValue({ data: {} })

    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByText('Test Movie')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(iconButton('lucide-trash-2') || iconButton('lucide-trash2'))
    })

    expect(qbittorrentApi.deleteTorrent).toHaveBeenCalledWith('hash1', false)
  })

  test('adds magnet link', async () => {
    qbittorrentApi.addTorrent.mockResolvedValue({ data: {} })
    qbittorrentApi.getTorrents.mockResolvedValue({ data: [] })

    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByTestId('downloads-page')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getAllByText('Add Magnet')[0]) // header button (empty state has another)
    })

    await act(async () => {
      await userEvent.type(screen.getByPlaceholderText('magnet:?xt=urn:btih:...'), 'magnet:?xt=urn:btih:test123')
      await userEvent.click(screen.getByText('Add'))
    })

    expect(qbittorrentApi.addTorrent).toHaveBeenCalledWith(null, 'magnet:?xt=urn:btih:test123')
  })

  test('pastes magnet from clipboard', async () => {
    navigator.clipboard.readText.mockResolvedValue('magnet:?xt=urn:btih:clipboard123')

    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByTestId('downloads-page')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getAllByText('Add Magnet')[0]) // header button (empty state has another)
      await userEvent.click(screen.getByTitle('Paste from clipboard'))
    })

    expect(screen.getByPlaceholderText('magnet:?xt=urn:btih:...')).toHaveValue('magnet:?xt=urn:btih:clipboard123')
  })

  test('shows empty state when no torrents', async () => {
    qbittorrentApi.getTorrents.mockResolvedValue({ data: [] })

    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByText('No Downloads')).toBeInTheDocument())
    expect(screen.getByText(/Your download queue is empty/)).toBeInTheDocument()
  })

  test('expands torrent details on click', async () => {
    torrentEngineApi.getFiles.mockResolvedValue({ data: [{ index: 0, path: 'video.mkv', size_formatted: '1GB', progress: 50 }] })
    torrentEngineApi.getTorrents.mockResolvedValue({ data: [{ id: 't1', name: 'Test', state: 'downloading', progress: 50, download_rate_formatted: '1MB/s', upload_rate_formatted: '0B/s', total_size_formatted: '1GB', eta_formatted: '1h', num_seeds: 10, num_peers: 5, sequential: false, info_hash: 'hash123' }] })
    torrentEngineApi.getStatus.mockResolvedValue({ data: { success: true } })
    localStorage.setItem('watchnexus_download_mode', 'builtin')

    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByTestId('downloads-page')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getByText('Test'))
    })

    await waitFor(() => expect(screen.getByText('Files (1)')).toBeInTheDocument())
    expect(screen.getByText('video.mkv')).toBeInTheDocument()
  })

  test('toggles sequential download', async () => {
    torrentEngineApi.setSequential.mockResolvedValue({ data: {} })
    torrentEngineApi.getTorrents.mockResolvedValue({ data: [{ id: 't1', name: 'Test', state: 'downloading', progress: 50, download_rate_formatted: '1MB/s', upload_rate_formatted: '0B/s', total_size_formatted: '1GB', eta_formatted: '1h', num_seeds: 10, num_peers: 5, sequential: false, info_hash: 'hash123' }] })
    torrentEngineApi.getStatus.mockResolvedValue({ data: { success: true } })
    torrentEngineApi.getFiles.mockResolvedValue({ data: [] })
    localStorage.setItem('watchnexus_download_mode', 'builtin')

    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByTestId('downloads-page')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getByText('Test'))
      await userEvent.click(screen.getByText('Sequential (Off)'))
    })

    expect(torrentEngineApi.setSequential).toHaveBeenCalledWith('t1', true)
  })

  test('switches download mode and persists to localStorage', async () => {
    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByTestId('downloads-page')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getByText('Built-in (soon)'))
    })

    expect(localStorage.setItem).toHaveBeenCalledWith('watchnexus_download_mode', 'builtin')
  })

  test('shows loading state initially', async () => {
    qbittorrentApi.getStatus.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: { success: true } }), 100)))
    qbittorrentApi.getTorrents.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: [] }), 100)))

    render(<DownloadsPage />)
    expect(screen.getByText('Loading downloads...')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByTestId('downloads-page')).toBeInTheDocument())
  })

  test('shows error when magnet link is invalid', async () => {
    render(<DownloadsPage />)
    await waitFor(() => expect(screen.getByTestId('downloads-page')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getAllByText('Add Magnet')[0]) // header button (empty state has another)
      await userEvent.type(screen.getByPlaceholderText('magnet:?xt=urn:btih:...'), 'not-a-magnet')
      await userEvent.click(screen.getByText('Add'))
    })

    const toast = require('sonner').toast
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Please enter a valid magnet link'))
  })
})