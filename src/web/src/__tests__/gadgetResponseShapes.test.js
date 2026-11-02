import { parseSavedLocation } from '../pages/gadgets/WeatherPage'
import { normalizeEpisodes, parseDurationSeconds } from '../pages/gadgets/PodcastsPage'
import { isKodiUnsupportedError } from '../pages/PluginMarketplacePage'

describe('weather settings shape', () => {
  test('parses stored JSON-string location from GET /weather/settings', () => {
    const loc = parseSavedLocation({ location: '{"lat":51.5,"lon":-0.1,"name":"London"}', unit: 'celsius' })
    expect(loc).toEqual({ lat: 51.5, lon: -0.1, name: 'London' })
  })
  test('returns null when no location is saved', () => {
    expect(parseSavedLocation({ location: null, unit: 'celsius' })).toBeNull()
  })
  test('accepts a bare { lat, lon } object', () => {
    expect(parseSavedLocation({ lat: 1, lon: 2 })).toEqual({ lat: 1, lon: 2 })
  })
})

describe('podcast episodes shape', () => {
  test('derives ids and parses itunes durations', () => {
    const eps = normalizeEpisodes([
      { title: 'A', audio_url: 'https://x/a.mp3', duration: '01:02:03' },
      { title: 'B', duration: '1834' },
    ])
    expect(eps[0].id).toBe('https://x/a.mp3')
    expect(eps[0].duration).toBe(3723)
    expect(eps[1].id).toBe('B-1')
    expect(eps[1].duration).toBe(1834)
  })
  test('tolerates missing/invalid durations', () => {
    expect(parseDurationSeconds(null)).toBeNull()
    expect(parseDurationSeconds('abc')).toBeNull()
  })
})

describe('kodi availability', () => {
  test('404/405/501 mean the Kodi API is absent', () => {
    expect(isKodiUnsupportedError({ response: { status: 404 } })).toBe(true)
    expect(isKodiUnsupportedError({ response: { status: 501 } })).toBe(true)
    expect(isKodiUnsupportedError({ response: { status: 500 } })).toBe(false)
    expect(isKodiUnsupportedError(new Error('network'))).toBe(false)
  })
})
