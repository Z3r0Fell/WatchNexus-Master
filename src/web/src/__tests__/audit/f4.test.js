import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import axios from 'axios';
import SecurityPage from '../../pages/SecurityPage';
import StrudelPage from '../../pages/StrudelPage';
import RoadmapDefault, { RoadmapPage } from '../../pages/RoadmapPage';
import { securityApi } from '../../services/nexusApi';

jest.mock('axios');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('../../components/layout/Layout', () => ({ Layout: ({ children }) => <div>{children}</div> }));
jest.mock('../../services/nexusApi', () => ({
  securityApi: {
    getStats: jest.fn(), getAuditLogs: jest.fn(), getIpRules: jest.fn(), addIpRule: jest.fn(),
    deleteIpRule: jest.fn(), getApiKeys: jest.fn(), createApiKey: jest.fn(), revokeApiKey: jest.fn(),
    getSessions: jest.fn(), revokeSession: jest.fn(),
  },
}));

describe('F4 audit regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    securityApi.getStats.mockResolvedValue({ data: { total_audit_logs: 1, blocked_ips: 0, active_api_keys: 1 } });
  });

  test('RoadmapPage has a default export (React.lazy needs it)', () => {
    expect(RoadmapDefault).toBe(RoadmapPage);
  });

  test('SecurityPage renders backend audit shape { logs } with ip', async () => {
    securityApi.getAuditLogs.mockResolvedValue({ data: { logs: [
      { id: 'a1', action: 'api_key_created', ip: '10.1.2.3', details: 'ci', timestamp: new Date().toISOString() },
    ], total: 1 } });
    render(<SecurityPage />);
    await waitFor(() => expect(screen.getByText('api_key_created')).toBeInTheDocument());
    expect(screen.getByText('10.1.2.3')).toBeInTheDocument();
  });

  test('SecurityPage sends IpRuleRequest shape and renders entity fields', async () => {
    securityApi.getAuditLogs.mockResolvedValue({ data: { logs: [], total: 0 } });
    securityApi.getIpRules.mockResolvedValue({ data: [{ id: 'r1', ip: '10.0.0.9', ruleType: 'allow', reason: 'home' }] });
    securityApi.addIpRule.mockResolvedValue({ data: {} });
    render(<SecurityPage />);
    await act(async () => { fireEvent.click(await screen.findByTestId('tab-ip-rules')); });
    await waitFor(() => expect(screen.getByText('10.0.0.9')).toBeInTheDocument());
    expect(screen.getByText('Allowed')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('add-ip-rule-btn'));
    fireEvent.change(screen.getByTestId('ip-address-input'), { target: { value: '1.2.3.4' } });
    await act(async () => { fireEvent.click(screen.getByTestId('save-ip-rule-btn')); });
    expect(securityApi.addIpRule).toHaveBeenCalledWith({ ip: '1.2.3.4', ruleType: 'block', reason: '' });
  });

  test('SecurityPage API keys use isActive / key_preview', async () => {
    securityApi.getAuditLogs.mockResolvedValue({ data: { logs: [], total: 0 } });
    securityApi.getApiKeys.mockResolvedValue({ data: [{ id: 'k1', name: 'CI', key_preview: 'wnx_abcd...wxyz', isActive: true }] });
    render(<SecurityPage />);
    await act(async () => { fireEvent.click(await screen.findByTestId('tab-api-keys')); });
    await waitFor(() => expect(screen.getByText('CI')).toBeInTheDocument());
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByTestId('revoke-key-k1')).toBeInTheDocument();
  });

  test('StrudelPage reads camelCase drives from backend', async () => {
    axios.get.mockImplementation((url) => {
      if (url.endsWith('/drives')) return Promise.resolve({ data: { drives: [{ index: 0, device: '/dev/sr0', name: 'BD-RE', hasDisc: true }] } });
      if (url.endsWith('/profiles')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    render(<StrudelPage />);
    await waitFor(() => expect(screen.getByText('BD-RE')).toBeInTheDocument());
    expect(screen.getByTestId('scan-drive-0')).toBeInTheDocument();
  });
});
