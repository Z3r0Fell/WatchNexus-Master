import { parseZestLogs } from '../../components/settings/ZestSettings';

describe('F8 audit: ZestSettings log parsing', () => {
  test('parses the bare array returned by /api/zest/logs', () => {
    const rows = parseZestLogs([
      { line: '2026-11-02T10:00:00.000Z [ERROR] WatchNexus.Core: boom', timestamp: 'x' },
      { line: '  at Foo.Bar()', timestamp: 'x' },
      { line: 'plain boot line', timestamp: 'x' },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ level: 'ERROR', logger: 'WatchNexus.Core', message: 'boom', timestamp: '2026-11-02T10:00:00.000Z' });
    expect(rows[1].level).toBe('ERROR');
    expect(rows[2]).toMatchObject({ level: 'INFO', message: 'plain boot line' });
  });

  test('tolerates legacy { logs: [] } and junk payloads', () => {
    expect(parseZestLogs({ logs: [] })).toEqual([]);
    expect(parseZestLogs(null)).toEqual([]);
    expect(parseZestLogs('nope')).toEqual([]);
  });

  test('maps FATAL to CRITICAL for the level filter', () => {
    expect(parseZestLogs([{ line: 't [FATAL] x: y' }])[0].level).toBe('CRITICAL');
  });
});
