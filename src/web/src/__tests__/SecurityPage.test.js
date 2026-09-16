import { render, screen, waitFor, act, userEvent } from './test-utils';
import { SecurityPage } from '../pages/SecurityPage';
import { securityApi } from '../services/nexusApi';
import { useConfirm } from '../hooks/use-confirm';

jest.mock('../services/nexusApi', () => ({
  securityApi: {
    getStats: jest.fn(),
    getAuditLogs: jest.fn(),
    getIpRules: jest.fn(),
    addIpRule: jest.fn(),
    deleteIpRule: jest.fn(),
    getApiKeys: jest.fn(),
    createApiKey: jest.fn(),
    revokeApiKey: jest.fn(),
    getSessions: jest.fn(),
    revokeSession: jest.fn(),
  },
}));

jest.mock('../hooks/use-confirm', () => ({
  useConfirm: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    ConfirmDialog: () => null,
  }),
}));

describe('SecurityPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    securityApi.getStats.mockResolvedValue({ data: {
      failed_logins_24h: 5,
      successful_logins_24h: 10,
      blocked_ips: 3,
      active_api_keys: 2,
      active_sessions: 1,
      total_audit_entries: 100,
    }});
  });

  test('renders security page with header', async () => {
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('security-dashboard')).toBeInTheDocument());
    expect(screen.getByText('Security — Bastion')).toBeInTheDocument());
    expect(screen.getByText('Audit logs, access control, API keys & session management')).toBeInTheDocument());
  });

  test('shows stats cards', async () => {
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByText('Failed Logins (24h)')).toBeInTheDocument());
    expect(screen.getByText('5')).toBeInTheDocument());
    expect(screen.getByText('Successful Logins (24h)')).toBeInTheDocument());
    expect(screen.getByText('10')).toBeInTheDocument());
    expect(screen.getByText('Blocked IPs')).toBeInTheDocument());
    expect(screen.getByText('3')).toBeInTheDocument());
    expect(screen.getByText('Active API Keys')).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument());
  });

  test('shows four tabs: Audit Log, IP Rules, API Keys, Sessions', async () => {
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('tab-audit-log')).toBeInTheDocument());
    expect(screen.getByTestId('tab-ip-rules')).toBeInTheDocument();
    expect(screen.getByTestId('tab-api-keys')).toBeInTheDocument();
    expect(screen.getByTestId('tab-sessions')).toBeInTheDocument();
  });

  test('shows Audit Log panel by default', async () => {
    securityApi.getAuditLogs.mockResolvedValue({ data: { items: [
      { id: '1', action: 'login', ip_address: '192.168.1.1', details: 'User login', success: true, timestamp: new Date().toISOString() },
    ], total: 1 }});
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('audit-panel')).toBeInTheDocument());
    expect(screen.getByText('login')).toBeInTheDocument());
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument());
  });

  test('filters audit logs', async () => {
    securityApi.getAuditLogs.mockResolvedValue({ data: { items: [], total: 0 }});
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('audit-panel')).toBeInTheDocument());
    await act(async () => {
      await userEvent.type(screen.getByTestId('audit-filter'), 'login');
    });
    expect(securityApi.getAuditLogs).toHaveBeenCalledWith(1, 25, 'login');
  });

  test('paginates audit logs', async () => {
    securityApi.getAuditLogs.mockResolvedValue({ data: { items: Array(25).fill({ id: '1', action: 'login', ip_address: '1.1.1.1', details: '', success: true, timestamp: new Date().toISOString() }), total: 50 }});
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('audit-panel')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByText('Next'));
    });
    expect(securityApi.getAuditLogs).toHaveBeenCalledWith(2, 25, undefined);
  });

  test('switches to IP Rules tab', async () => {
    securityApi.getIpRules.mockResolvedValue({ data: [
      { id: '1', ip_address: '10.0.0.1', is_allowed: true, description: 'Home network' },
    ]});
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('security-dashboard')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-ip-rules'));
    });
    await waitFor(() => expect(screen.getByTestId('ip-rules-panel')).toBeInTheDocument());
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument());
    expect(screen.getByText('Allowed')).toBeInTheDocument());
  });

  test('adds IP rule', async () => {
    securityApi.getIpRules.mockResolvedValue({ data: [] });
    securityApi.addIpRule.mockResolvedValue({ data: {} });
    securityApi.getIpRules.mockResolvedValueOnce({ data: [{ id: '2', ip_address: '192.168.1.100', is_allowed: false, description: 'Blocked' }] });
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('security-dashboard')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-ip-rules'));
      await userEvent.click(screen.getByTestId('add-ip-rule-btn'));
      await userEvent.type(screen.getByTestId('ip-address-input'), '192.168.1.100');
      await userEvent.click(screen.getByText('Block'));
      await userEvent.click(screen.getByTestId('save-ip-rule-btn'));
    });
    expect(securityApi.addIpRule).toHaveBeenCalledWith({ ip_address: '192.168.1.100', is_allowed: false, description: '' });
  });

  test('deletes IP rule', async () => {
    securityApi.getIpRules.mockResolvedValue({ data: [{ id: '1', ip_address: '10.0.0.1', is_allowed: true }] });
    securityApi.deleteIpRule.mockResolvedValue({ data: {} });
    securityApi.getIpRules.mockResolvedValueOnce({ data: [] });
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('security-dashboard')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-ip-rules'));
      await userEvent.click(screen.getByTestId('delete-rule-1'));
    });
    expect(securityApi.deleteIpRule).toHaveBeenCalledWith('1');
  });

  test('switches to API Keys tab', async () => {
    securityApi.getApiKeys.mockResolvedValue({ data: [
      { id: '1', name: 'CI Pipeline', prefix: 'abc123', is_active: true, usage_count: 5, last_used: new Date().toISOString() },
    ]});
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('security-dashboard')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-api-keys'));
    });
    await waitFor(() => expect(screen.getByTestId('api-keys-panel')).toBeInTheDocument());
    expect(screen.getByText('CI Pipeline')).toBeInTheDocument());
    expect(screen.getByText('wn_abc123...')).toBeInTheDocument();
  });

  test('creates API key and shows it', async () => {
    securityApi.getApiKeys.mockResolvedValue({ data: [] });
    securityApi.createApiKey.mockResolvedValue({ data: { key: 'wn_abc123def456ghijklmnopqrstuvwxyz' } });
    securityApi.getApiKeys.mockResolvedValueOnce({ data: [{ id: '1', name: 'New Key', prefix: 'abc123', is_active: true }] });
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('security-dashboard')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-api-keys'));
      await userEvent.click(screen.getByTestId('create-api-key-btn'));
      await userEvent.type(screen.getByTestId('api-key-name-input'), 'New Key');
      await userEvent.click(screen.getByTestId('save-api-key-btn'));
    });
    expect(securityApi.createApiKey).toHaveBeenCalledWith({ name: 'New Key' });
    expect(screen.getByText('New API Key Created — Save it now!')).toBeInTheDocument());
    expect(screen.getByText('wn_abc123def456ghijklmnopqrstuvwxyz')).toBeInTheDocument();
  });

  test('masks API key by default', async () => {
    securityApi.getApiKeys.mockResolvedValue({ data: [
      { id: '1', name: 'Test Key', prefix: 'abc123', is_active: true, usage_count: 0 },
    ]});
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('security-dashboard')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-api-keys'));
    });
    await waitFor(() => expect(screen.getByTestId('api-keys-panel')).toBeInTheDocument());
    // Key should be masked
    expect(screen.getByText('wn_abc123••••••••••••••••••••••••stuvwxyz')).toBeInTheDocument();
  });

  test('reveals API key on eye click', async () => {
    securityApi.getApiKeys.mockResolvedValue({ data: [
      { id: '1', name: 'Test Key', prefix: 'abc123', is_active: true, usage_count: 0 },
    ]});
    securityApi.createApiKey.mockResolvedValue({ data: { key: 'wn_abc123def456ghijklmnopqrstuvwxyz' } });
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('security-dashboard')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-api-keys'));
      await userEvent.click(screen.getByTestId('create-api-key-btn'));
      await userEvent.type(screen.getByTestId('api-key-name-input'), 'Test Key');
      await userEvent.click(screen.getByTestId('save-api-key-btn'));
    });
    await waitFor(() => expect(screen.getByText('wn_abc123••••••••••••••••••••••••stuvwxyz')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /show/i }));
    });
    expect(screen.getByText('wn_abc123def456ghijklmnopqrstuvwxyz')).toBeInTheDocument();
  });

  test('revokes API key', async () => {
    securityApi.getApiKeys.mockResolvedValue({ data: [{ id: '1', name: 'Test Key', prefix: 'abc123', is_active: true }] });
    securityApi.revokeApiKey.mockResolvedValue({ data: {} });
    securityApi.getApiKeys.mockResolvedValueOnce({ data: [{ id: '1', name: 'Test Key', prefix: 'abc123', is_active: false }] });
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('security-dashboard')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-api-keys'));
      await userEvent.click(screen.getByTestId('revoke-key-1'));
    });
    expect(securityApi.revokeApiKey).toHaveBeenCalledWith('1');
  });

  test('switches to Sessions tab', async () => {
    securityApi.getSessions.mockResolvedValue({ data: [
      { id: '1', ip_address: '192.168.1.50', user_agent: 'Mozilla/5.0', last_activity: new Date().toISOString() },
    ]});
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('security-dashboard')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-sessions'));
    });
    await waitFor(() => expect(screen.getByTestId('sessions-panel')).toBeInTheDocument());
    expect(screen.getByText('192.168.1.50')).toBeInTheDocument());
    expect(screen.getByText('Mozilla/5.0')).toBeInTheDocument();
  });

  test('revokes session', async () => {
    securityApi.getSessions.mockResolvedValue({ data: [{ id: '1', ip_address: '192.168.1.50', user_agent: 'Mozilla/5.0', last_activity: new Date().toISOString() }] });
    securityApi.revokeSession.mockResolvedValue({ data: {} });
    securityApi.getSessions.mockResolvedValueOnce({ data: [] });
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('security-dashboard')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-sessions'));
      await userEvent.click(screen.getByTitle('Revoke session'));
    });
    expect(securityApi.revokeSession).toHaveBeenCalledWith('1');
  });

  test('refreshes audit logs', async () => {
    securityApi.getAuditLogs.mockResolvedValue({ data: { items: [], total: 0 }});
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('audit-panel')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('audit-refresh'));
    });
    expect(securityApi.getAuditLogs).toHaveBeenCalledTimes(2);
  });

  test('shows empty states when no data', async () => {
    securityApi.getIpRules.mockResolvedValue({ data: [] });
    securityApi.getApiKeys.mockResolvedValue({ data: [] });
    securityApi.getSessions.mockResolvedValue({ data: [] });
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByTestId('security-dashboard')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-ip-rules'));
    });
    expect(screen.getByText('No IP rules configured')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-api-keys'));
    });
    expect(screen.getByText('No API keys created')).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByTestId('tab-sessions'));
    });
    expect(screen.getByText('No active sessions')).toBeInTheDocument());
  });
});