import { normalizeChannel, normalizeGroups } from '../../pages/LiveTVPage';

jest.mock('../../components/layout/Layout', () => ({ Layout: ({ children }) => children }));

describe('F2 audit: LiveTV IPTV contract', () => {
  test('groups from /api/iptv/groups ([{name,count}]) become strings, not objects', () => {
    expect(normalizeGroups([{ name: 'News', count: 3 }, { name: null }, 'Sports'])).toEqual(['News', 'Sports']);
    expect(normalizeGroups(null)).toEqual([]);
  });

  test('channel logo_url / group_title map to logo / group', () => {
    const c = normalizeChannel({ id: '1', logo_url: 'http://x/l.png', group_title: 'News' });
    expect(c.logo).toBe('http://x/l.png');
    expect(c.group).toBe('News');
  });
});
