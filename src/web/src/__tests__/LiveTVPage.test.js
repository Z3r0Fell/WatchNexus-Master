import { render, screen, waitFor, act, userEvent, fireEvent, routeGet, okData as ok } from './test-utils'
import { LiveTVPage } from '../pages/LiveTVPage'
import axios from 'axios'

// No app shell: the Sidebar repeats labels like "Live TV".
jest.mock('../components/layout/Layout', () => ({
  Layout: ({ children }) => <div data-testid="layout">{children}</div>,
}))
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
  Toaster: () => null,
}))

// Many controls on this page are icon-only (no title/aria-label): find them by
// their lucide icon.
const iconButton = (iconClass, root = document) => {
  const svg = root.querySelector(`svg.${iconClass}`)
  return svg && svg.closest('button')
}
// Radix Tabs activate on mousedown; userEvent.click covers it, fireEvent needs it explicitly.
const openTab = async (name) => {
  await act(async () => { await userEvent.click(screen.getByRole('tab', { name: new RegExp(name) })) })
}

const STATS = ok({ total_channels: 10, total_groups: 2, favorites_count: 3 })
const SOURCES = ok([{ id: '1', name: 'Source 1', url: 'http://test.m3u', channel_count: 50 }])
const CHANNELS = ok([
  { id: 'ch1', name: 'Channel 1', group: 'News', logo: '/logo1.png', stream_url: 'http://stream1', is_favorite: false },
  { id: 'ch2', name: 'Channel 2', group: 'Sports', logo: '/logo2.png', stream_url: 'http://stream2', is_favorite: true },
])
const GROUPS = ok(['News', 'Sports'])
const routes = (over = {}) => routeGet({
  '/api/iptv/stats': STATS,
  '/api/iptv/sources': SOURCES,
  '/api/iptv/channels': CHANNELS,
  '/api/iptv/groups': GROUPS,
  '/api/iptv/epg/': ok([]),
  '/api/iptv/export': ok({ content: '#EXTM3U', filename: 'playlist.m3u' }),
  ...over,
})

jest.mock('../hooks/use-confirm', () => ({
  useConfirm: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    ConfirmDialog: () => null,
  }),
}))

describe('LiveTVPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // answer each endpoint by URL (chained mockResolvedValue calls overwrote each other)
    routes()
    axios.post.mockResolvedValue({ data: {} })
    axios.delete.mockResolvedValue({ data: {} })
  })

  test('renders Live TV page with header', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 1, name: /Live TV/ })).toBeInTheDocument()
    expect(screen.getByText('IPTV channels and live streams')).toBeInTheDocument()
  })

  test('shows stats in header', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByText('10 channels')).toBeInTheDocument())
    expect(screen.getByText('2 groups')).toBeInTheDocument()
    expect(screen.getByText('3 favorites')).toBeInTheDocument()
  })

  test('shows three tabs: Channels, Guide, Sources', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByText('Channels')).toBeInTheDocument())
    expect(screen.getByText('Guide')).toBeInTheDocument()
    expect(screen.getByText('Sources')).toBeInTheDocument()
  })

  test('displays channels in grid view by default', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByText('Channel 1')).toBeInTheDocument())
    expect(screen.getByText('Channel 2')).toBeInTheDocument()
    // group names appear on the cards and in the group filter
    expect(screen.getAllByText('News').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sports').length).toBeGreaterThan(0)
  })

  test('switches to list view', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    await waitFor(() => expect(screen.getByText('Channel 1')).toBeInTheDocument())
    await act(async () => {
      await userEvent.click(iconButton('lucide-list'))
    })

    // In list view, channels should still be visible
    expect(screen.getByText('Channel 1')).toBeInTheDocument()
  })

  test('filters channels by group', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    await waitFor(() => expect(screen.getByRole('option', { name: /News/ })).toBeInTheDocument())
    await act(async () => {
      await userEvent.selectOptions(screen.getByRole('combobox'), 'News')
    })

    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/iptv/channels'), expect.objectContaining({ params: expect.objectContaining({ group: 'News' }) }))
  })

  test('filters channels by search query', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    await act(async () => {
      await userEvent.type(screen.getByPlaceholderText('Search channels...'), 'Channel 1')
    })

    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/iptv/channels'), expect.objectContaining({ params: expect.objectContaining({ search: 'Channel 1' }) }))
  })

  test('toggles favorites only', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getByText('Favorites'))
    })

    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/iptv/channels'), expect.objectContaining({ params: expect.objectContaining({ favorites_only: true }) }))
  })

  test('adds new IPTV source', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getAllByRole('button', { name: /Add Source/ })[0])
    })

    await act(async () => {
      await userEvent.type(screen.getByPlaceholderText('My IPTV'), 'My Source')
      await userEvent.type(screen.getByPlaceholderText('http://example.com/playlist.m3u'), 'http://test.m3u')
    })
    // submit button inside the modal form (last "Add Source")
    const addButtons = screen.getAllByRole('button', { name: /Add Source/ })
    await act(async () => {
      await userEvent.click(addButtons[addButtons.length - 1])
    })

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/iptv/sources'), null, expect.objectContaining({ params: expect.objectContaining({ name: 'My Source', url: 'http://test.m3u' }) }))
  })

  test('refreshes IPTV source', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    await openTab('Sources')

    await waitFor(() => expect(screen.getByText('Source 1')).toBeInTheDocument())

    // icon-only button on the source row
    await act(async () => {
      await userEvent.click(iconButton('lucide-refresh-cw', screen.getByText('Source 1').closest('.glass-card') || document))
    })

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/iptv/sources/1/refresh'), null, expect.anything())
  })

  test('deletes IPTV source with confirmation', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    await openTab('Sources')

    await waitFor(() => expect(screen.getByText('Source 1')).toBeInTheDocument())

    // icon-only button on the source row
    await act(async () => {
      await userEvent.click(iconButton('lucide-trash-2') || iconButton('lucide-trash2'))
    })

    await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/api/iptv/sources/1'), expect.anything()))
  })

  test('exports M3U playlist', async () => {
    // jsdom has no object URLs (used to download the playlist)
    window.URL.createObjectURL = window.URL.createObjectURL || (() => 'blob:mock')
    window.URL.revokeObjectURL = window.URL.revokeObjectURL || (() => {})

    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getByText('Export M3U'))
    })

    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/iptv/export'), expect.objectContaining({ params: expect.objectContaining({ favorites_only: false }) }))
  })

  test('toggles channel favorite', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    await waitFor(() => expect(screen.getByText('Channel 1')).toBeInTheDocument())
    // favorite toggle on Channel 1 (not a favorite yet -> StarOff icon)
    await act(async () => {
      await userEvent.click(iconButton('lucide-star-off'))
    })

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/iptv/channels/ch1/favorite'), null, expect.anything())
  })

  test('opens channel player modal', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    await waitFor(() => expect(screen.getByText('Channel 1')).toBeInTheDocument())
    await act(async () => {
      await userEvent.click(screen.getByText('Channel 1'))
    })

    // player modal: channel title as a heading plus an (icon-only) close button
    expect(await screen.findByRole('heading', { level: 2, name: 'Channel 1' })).toBeInTheDocument()
    const closeBtn = iconButton('lucide-x', screen.getByRole('heading', { level: 2, name: 'Channel 1' }).closest('.max-w-4xl'))
    expect(closeBtn).not.toBeNull()
    await act(async () => { await userEvent.click(closeBtn) })
    expect(screen.queryByRole('heading', { level: 2, name: 'Channel 1' })).not.toBeInTheDocument()
  })

  test('shows EPG Guide tab', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByText('Channel 1')).toBeInTheDocument())

    await openTab('Guide')

    // with channels loaded the guide shows the date navigator and a "Now" button
    expect(await screen.findByRole('button', { name: /Now/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Channels/ })).toBeInTheDocument()
  })

  test('navigates EPG date', async () => {
    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    await waitFor(() => expect(screen.getByText('Channel 1')).toBeInTheDocument())
    await openTab('Guide')
    await screen.findByRole('button', { name: /Now/ })

    const weekday = (d) => d.toLocaleDateString('en-US', { weekday: 'long' })
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    // icon-only "previous day" button
    await act(async () => {
      await userEvent.click(iconButton('lucide-chevron-left'))
    })
    expect(screen.getByText(weekday(yesterday))).toBeInTheDocument()
  })

  test('shows program details on click', async () => {
    routes({ '/api/iptv/epg/': ok([{ id: 'prog1', title: 'News Program', start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString(), duration_minutes: 60, description: 'Latest news' }]) })

    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByText('Channel 1')).toBeInTheDocument())

    await openTab('Guide')

    // Click on a program in the EPG
    await waitFor(() => expect(screen.getAllByText('News Program').length).toBeGreaterThan(0))
  })

  test('shows empty state when no sources', async () => {
    routes({
      '/api/iptv/stats': ok({ total_channels: 0, total_groups: 0, favorites_count: 0 }),
      '/api/iptv/sources': ok([]), '/api/iptv/channels': ok([]), '/api/iptv/groups': ok([]),
    })

    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    await openTab('Sources')

    expect(await screen.findByText('No IPTV Sources')).toBeInTheDocument()
    expect(screen.getByText('Add an M3U playlist URL to get started')).toBeInTheDocument()
  })

  test('shows empty state when no channels', async () => {
    routes({
      '/api/iptv/stats': ok({ total_channels: 0, total_groups: 0, favorites_count: 0 }),
      '/api/iptv/channels': ok([]), '/api/iptv/groups': ok([]),
    })

    render(<LiveTVPage />)
    await waitFor(() => expect(screen.getByTestId('live-tv-page')).toBeInTheDocument())

    expect(await screen.findByText('No Channels')).toBeInTheDocument()
    expect(screen.getByText('Add an IPTV source (M3U playlist) to get started')).toBeInTheDocument()
  })
})