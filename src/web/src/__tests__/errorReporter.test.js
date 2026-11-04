import { apiClient } from '../services/api';
import {
  reportClientError,
  installGlobalErrorHandlers,
  __resetErrorReporterForTests,
} from '../services/errorReporter';

jest.mock('../services/api', () => ({ apiClient: { post: jest.fn() } }));

describe('errorReporter', () => {
  beforeEach(() => {
    __resetErrorReporterForTests();
    apiClient.post.mockReset();
    apiClient.post.mockResolvedValue({ data: {} });
  });

  test('POSTs the documented body to /logs/client', () => {
    const sent = reportClientError({
      level: 'error', message: 'boom', stack: 'Error: boom\n at x', componentStack: '\n in Foo',
      correlationId: 'FE-1', url: 'http://app/player', userAgent: 'jest',
    });
    expect(sent).toBe(true);
    expect(apiClient.post).toHaveBeenCalledWith('/logs/client', {
      level: 'error', message: 'boom', stack: 'Error: boom\n at x', componentStack: '\n in Foo',
      correlationId: 'FE-1', url: 'http://app/player', userAgent: 'jest',
    });
  });

  test('fills defaults for level, correlationId, url and userAgent', () => {
    reportClientError({ message: 'x' });
    const body = apiClient.post.mock.calls[0][1];
    expect(body.level).toBe('error');
    expect(body.correlationId).toMatch(/^FE-/);
    expect(body.url).toEqual(expect.any(String));
    expect(body.userAgent).toEqual(expect.any(String));
  });

  test('never throws, even if the client throws or rejects', async () => {
    apiClient.post.mockImplementationOnce(() => { throw new Error('sync'); });
    expect(() => reportClientError({ message: 'a' })).not.toThrow();
    apiClient.post.mockRejectedValueOnce(new Error('async'));
    expect(() => reportClientError({ message: 'b' })).not.toThrow();
    await Promise.resolve();
  });

  test('dedupes identical reports', () => {
    reportClientError({ message: 'same' });
    reportClientError({ message: 'same' });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  test('throttles to 10 reports per minute', () => {
    for (let i = 0; i < 15; i++) reportClientError({ message: `m${i}` });
    expect(apiClient.post).toHaveBeenCalledTimes(10);
  });

  test('global handlers report window errors and unhandled rejections (installed once)', () => {
    const target = new EventTarget();
    installGlobalErrorHandlers(target);
    installGlobalErrorHandlers(target);

    const errEvt = new Event('error');
    errEvt.error = new Error('uncaught thing');
    target.dispatchEvent(errEvt);

    const rej = new Event('unhandledrejection');
    rej.reason = new Error('promise thing');
    target.dispatchEvent(rej);

    expect(apiClient.post).toHaveBeenCalledTimes(2);
    expect(apiClient.post.mock.calls[0][1].message).toBe('uncaught thing');
    expect(apiClient.post.mock.calls[1][1].message).toContain('promise thing');
  });
});
