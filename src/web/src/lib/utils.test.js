import { formatFileSize, formatDuration, formatTime, getMediaType, getTitle, getReleaseYear } from './utils';

describe('formatFileSize', () => {
  it('returns 0 B for zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats KB', () => {
    expect(formatFileSize(2048)).toBe('2 KB');
  });

  it('formats MB', () => {
    expect(formatFileSize(1048576)).toBe('1 MB');
  });

  it('formats GB', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });

  it('formats TB', () => {
    expect(formatFileSize(1099511627776)).toBe('1 TB');
  });
});

describe('formatDuration', () => {
  it('formats minutes only', () => {
    expect(formatDuration(45)).toBe('45m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(125)).toBe('2h 5m');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0m');
  });
});

describe('formatTime', () => {
  it('formats seconds only', () => {
    expect(formatTime(45)).toBe('0:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(185)).toBe('3:05');
  });

  it('formats hours, minutes, seconds', () => {
    expect(formatTime(3723)).toBe('1:02:03');
  });

  it('handles zero', () => {
    expect(formatTime(0)).toBe('0:00');
  });
});

describe('getMediaType', () => {
  it('returns media_type if present', () => {
    expect(getMediaType({ media_type: 'tv' })).toBe('tv');
  });

  it('returns movie when title is present', () => {
    expect(getMediaType({ title: 'Test' })).toBe('movie');
  });

  it('returns tv by default', () => {
    expect(getMediaType({})).toBe('tv');
  });
});

describe('getTitle', () => {
  it('returns title if present', () => {
    expect(getTitle({ title: 'Movie' })).toBe('Movie');
  });

  it('returns name if title absent', () => {
    expect(getTitle({ name: 'Show' })).toBe('Show');
  });

  it('returns undefined for empty object', () => {
    expect(getTitle({})).toBeUndefined();
  });
});

describe('getReleaseYear', () => {
  it('returns year from release_date', () => {
    expect(getReleaseYear({ release_date: '2023-06-15' })).toBe(2023);
  });

  it('returns year from first_air_date', () => {
    expect(getReleaseYear({ first_air_date: '2020-06-15' })).toBe(2020);
  });

  it('returns null without dates', () => {
    expect(getReleaseYear({})).toBeNull();
  });
});
