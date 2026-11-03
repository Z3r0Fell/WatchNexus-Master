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

describe('F8 audit: MaintenanceSettings response normalisers', () => {
  const { normalizeSystemStats, normalizeDbStats, normalizeBackups } = require('../../components/settings/MaintenanceSettings');
  test('maps /api/system/stats + /info', () => {
    const n = normalizeSystemStats({ memory_mb: 123.456, threads: 9, uptime_seconds: 3700 }, { version: '1.0.6', cpu_count: 4, dotnet_version: '10.0' });
    expect(n.resources).toMatchObject({ process_memory_mb: 123.5, threads: 9, cpu_count: 4 });
    expect(n.app).toMatchObject({ version: '1.0.6', uptime: '1h 1m' });
    expect(n.system.runtime).toBe('10.0');
    expect(normalizeSystemStats(null, null)).toBeNull();
  });
  test('maps /api/db/stats and bare-array /api/db/backups', () => {
    expect(normalizeDbStats({ size_bytes: 2097152, tables: 20 })).toMatchObject({ size_mb: 2, status: 'healthy' });
    expect(normalizeBackups([{ name: 'a.db', size: 1048576, created: '2026-01-01T00:00:00Z' }]))
      .toEqual([{ filename: 'a.db', size_mb: 1, created_at: '2026-01-01T00:00:00Z' }]);
    expect(normalizeBackups(null)).toEqual([]);
  });
});
