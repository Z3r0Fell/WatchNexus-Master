import WatchPartyDefault, { WatchPartyPage, shouldShowIncoming } from '../../pages/WatchPartyPage'
import { normalizeRequest } from '../../pages/gadgets/RequestsPage'
import { buildChannelPayload, missingChannelFields } from '../../pages/gadgets/NotificationsPage'
import { buildPhotoUrl } from '../../pages/gadgets/PhotosPage'
import { normalizeStation, normalizeFavorite } from '../../pages/gadgets/RadioPage'
import { normalizeWeather, normalizeLocations } from '../../pages/gadgets/WeatherPage'
import { deriveTypeCounts, normalizeRecent } from '../../pages/gadgets/AnalyticsPage'
import { parseGenreList } from '../../pages/gadgets/ParentalControlsPage'
import { normalizeServerConfig, normalizePeer, buildSetupPayload, buildClientConfig } from '../../pages/VpnPage'
import { sameColors } from '../../pages/ThemeCommunityPage'

describe('F5 watch party', () => {
  test('page has a default export for React.lazy', () => {
    expect(WatchPartyDefault).toBe(WatchPartyPage)
  })
  test('drops our own echoed frames only', () => {
    expect(shouldShowIncoming({ client_id: 'me', text: 'x' }, 'me')).toBe(false)
    expect(shouldShowIncoming({ client_id: 'other', text: 'x' }, 'me')).toBe(true)
    expect(shouldShowIncoming({ text: 'legacy' }, 'me')).toBe(true)
  })
})

describe('F5 gadget contracts', () => {
  test('requests normalize camelCase rows', () => {
    expect(normalizeRequest({ mediaType: 'tv', overview: 'n' })).toMatchObject({ media_type: 'tv', description: 'n' })
  })

  test('notification channel payload uses top-level sender fields', () => {
    const ch = { name: ' D ', type: 'discord', fields: { webhook_url: ' https://x ' } }
    expect(buildChannelPayload(ch)).toEqual({ name: 'D', type: 'discord', enabled: true, webhook_url: 'https://x' })
    expect(missingChannelFields({ type: 'telegram', fields: { bot_token: 't' } })).toEqual(['Chat ID'])
  })

  test('photo url encodes segments but keeps slashes', () => {
    expect(buildPhotoUrl('/data/my pics/a#1.jpg')).toBe('/api/gadgets/photos/file/data/my%20pics/a%231.jpg')
  })

  test('radio stations and favorites normalize radio-browser shapes', () => {
    expect(normalizeStation({ stationuuid: 'u1', url_resolved: 'http://s', tags: 'jazz, blues' }))
      .toMatchObject({ id: 'u1', url: 'http://s', tags: ['jazz', 'blues'] })
    expect(normalizeFavorite({ id: 'f1', station_uuid: 'u1', stream_url: 'http://s', tags: null }))
      .toMatchObject({ fav_id: 'f1', station_id: 'u1', url: 'http://s', tags: [] })
  })

  test('weather normalizes open-meteo payloads', () => {
    const w = normalizeWeather({
      current: { temperature_2m: 12.4, apparent_temperature: 10, relative_humidity_2m: 80, wind_speed_10m: 5, weather_code: 61 },
      daily: { time: ['2026-11-02'], weather_code: [0], temperature_2m_max: [14], temperature_2m_min: [6] },
    })
    expect(w.current).toMatchObject({ temperature: 12.4, feels_like: 10, humidity: 80, wind_speed: 5, icon: 'cloud-rain' })
    expect(w.forecast).toEqual([{ date: '2026-11-02', icon: 'sun', temp_max: 14, temp_min: 6 }])
    expect(normalizeWeather({ error: 'No location configured' })).toBeNull()
    expect(normalizeLocations([{ name: 'Paris', latitude: 1, longitude: 2 }])[0]).toMatchObject({ lat: 1, lon: 2 })
  })

  test('analytics derives counts and normalizes recent rows', () => {
    expect(deriveTypeCounts({ by_media_type: [{ type: 'movie', count: 3 }, { type: 'tv', count: 2 }] })).toEqual({ movies: 3, episodes: 2 })
    expect(normalizeRecent({ mediaType: 'tv', startedAt: '2026-01-01T00:00:00Z', durationSeconds: 120 }))
      .toMatchObject({ media_type: 'tv', played_at: '2026-01-01T00:00:00Z', duration_minutes: 2 })
  })

  test('parental genre list parses raw JSON text from the backend', () => {
    expect(parseGenreList('["Horror","Gore"]')).toEqual(['Horror', 'Gore'])
    expect(parseGenreList('Horror, Gore')).toEqual(['Horror', 'Gore'])
  })
})

describe('F5 vpn', () => {
  test('server config / peers normalize camelCase', () => {
    expect(normalizeServerConfig({ is_configured: true, listenPort: 51820, address: '10.0.0.1/24', dns: '1.1.1.1', endpoint: 'h' }))
      .toMatchObject({ configured: true, listen_port: 51820, subnet: '10.0.0.1/24', dns_servers: '1.1.1.1', external_endpoint: 'h' })
    expect(normalizePeer({ isActive: false, address: '10.0.0.2/32', transferRx: 5 }))
      .toMatchObject({ is_enabled: false, assigned_ip: '10.0.0.2/32', bytes_received: 5 })
  })
  test('setup payload matches ServerSetup record and client config is built', () => {
    expect(buildSetupPayload({ listen_port: 1, subnet: 's', dns_servers: 'd', external_endpoint: 'e' }))
      .toEqual({ listenPort: 1, address: 's', dns: 'd', endpoint: 'e' })
    const cfg = buildClientConfig({ privateKey: 'PK', address: '10.0.0.2/32' }, { public_key: 'SPK', endpoint: 'h', listenPort: 51820, dns: '1.1.1.1' })
    expect(cfg).toContain('PrivateKey = PK')
    expect(cfg).toContain('Endpoint = h:51820')
  })
})

describe('F5 themes', () => {
  test('sameColors compares case-insensitively', () => {
    expect(sameColors({ primary: '#AbC', secondary: '', background: '#000', surface: '#111' }, { primary: '#abc', background: '#000', surface: '#111' })).toBe(true)
    expect(sameColors({ primary: '#abc' }, null)).toBe(false)
  })
})
