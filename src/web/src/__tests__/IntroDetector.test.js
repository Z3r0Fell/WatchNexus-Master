import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  defaults: {},
}))
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}))
jest.mock('framer-motion', () => ({
  motion: { div: ({ children, ...p }) => <div>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}))

import axios from 'axios'
import { toast } from 'sonner'
import { IntroDetector } from '../components/media/IntroDetector'

const notFound = () => Promise.reject({ response: { status: 404 } })

describe('IntroDetector graceful degradation', () => {
  let errSpy
  beforeEach(() => { errSpy = jest.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { jest.clearAllMocks(); errSpy.mockRestore() })

  test('renders nothing when chromaprint is not installed', async () => {
    axios.get.mockResolvedValueOnce({ data: { installed: false } })
    const { container } = render(<IntroDetector seriesName="Show" />)
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/system/chromaprint-status')))
    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
    expect(axios.post).not.toHaveBeenCalled()
  })

  test('renders nothing when the status probe fails (404)', async () => {
    axios.get.mockImplementationOnce(notFound)
    const { container } = render(<IntroDetector seriesName="Show" />)
    await act(async () => {})
    expect(container).toBeEmptyDOMElement()
    expect(toast.error).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
  })

  test('shows a disabled hint (no error toast) when the analyze endpoint is missing', async () => {
    axios.get.mockResolvedValueOnce({ data: { installed: true } })
    axios.post.mockImplementationOnce(notFound)
    render(<IntroDetector seriesName="Show" />)
    const btn = await screen.findByTestId('detect-intros-btn')
    await act(async () => { fireEvent.click(btn) })
    const hint = await screen.findByTestId('detect-intros-unavailable')
    expect(hint).toBeInTheDocument()
    expect(screen.getByTestId('detect-intros-btn')).toBeDisabled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
  })

  test('treats 501 as not available', async () => {
    axios.get.mockResolvedValueOnce({ data: { installed: true } })
    axios.post.mockImplementationOnce(() => Promise.reject({ response: { status: 501 } }))
    render(<IntroDetector seriesName="Show" />)
    const btn = await screen.findByTestId('detect-intros-btn')
    await act(async () => { fireEvent.click(btn) })
    expect(await screen.findByTestId('detect-intros-unavailable')).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })
})
