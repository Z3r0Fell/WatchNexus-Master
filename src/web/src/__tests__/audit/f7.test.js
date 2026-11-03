import { render, screen, waitFor, fireEvent } from '@testing-library/react'

jest.mock('axios', () => {
  const m = { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn(), defaults: {} }
  m.create = jest.fn(() => ({
    ...m,
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  }))
  return m
})
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}))

import axios from 'axios'
import { FFmpegSettings } from '../../components/settings/FFmpegSettings'
import { IPTVSettings } from '../../components/settings/IPTVSettings'
import { ActivationSettings } from '../../components/settings/ActivationSettings'
import { mergeUserPreferences } from '../../components/settings/GeneralSettings'

afterEach(() => jest.clearAllMocks())

test('FFmpegSettings renders without crashing (SettingsTabHeader needs tabs)', async () => {
  axios.get.mockResolvedValueOnce({ data: { ffmpeg_installed: true, ffprobe_installed: true } })
  render(<FFmpegSettings />)
  expect(await screen.findByText('FFmpeg detected')).toBeInTheDocument()
})

test('IPTVSettings lists sources from the bare-array GET response', async () => {
  axios.get.mockResolvedValueOnce({ data: [{ id: 's1', name: 'My Source', url: 'http://x/y.m3u' }] })
  render(<IPTVSettings />)
  expect(await screen.findByText('My Source')).toBeInTheDocument()
})

test('mergeUserPreferences keeps existing keys', async () => {
  axios.get.mockResolvedValueOnce({ data: { visible_tabs: ['Movies'], theme_mode: 'dark' } })
  axios.put.mockResolvedValueOnce({ data: { status: 'saved' } })
  await mergeUserPreferences({ download_mode: 'qbittorrent' })
  expect(axios.put.mock.calls[0][1]).toEqual({
    visible_tabs: ['Movies'], theme_mode: 'dark', download_mode: 'qbittorrent',
  })
})

test('ActivationSettings deactivate opens a confirm dialog', async () => {
  axios.get.mockImplementation((url) => Promise.resolve(url.endsWith('/status')
    ? { data: { tier: 'pro', activated: true, serial: 'WNX-PRO-****', total_modules: 3 } }
    : { data: { tiers: {} } }))
  render(<ActivationSettings />)
  fireEvent.click(await screen.findByTestId('deactivate-license-btn'))
  await waitFor(() => expect(screen.getByText('Deactivate License')).toBeInTheDocument())
})

test('serial formatter keeps every character when pasting undashed input', async () => {
  axios.get.mockImplementation(() => Promise.resolve({ data: { tier: 'standard', tiers: {} } }))
  render(<ActivationSettings />)
  const input = await screen.findByTestId('serial-number-input')
  fireEvent.change(input, { target: { value: 'wnxproa' } })
  expect(input.value).toBe('WNX-PRO-A')
})
