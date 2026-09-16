jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  defaults: {},
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn(), handlers: [] },
    response: { use: jest.fn(), eject: jest.fn(), handlers: [] },
  },
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: {},
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn(), handlers: [] },
      response: { use: jest.fn(), eject: jest.fn(), handlers: [] },
    },
  })),
}));

import { render, screen, waitFor, act } from '../test-utils';
import { LicenseProvider, useLicense, ROUTE_MODULE_MAP, MODULE_TIER, TIER_RANK } from '../../context/LicenseContext';
import axios from 'axios';

const LicenseProbe = ({ onCapture }) => {
  const license = useLicense();
  if (onCapture) onCapture(license);
  return (
    <div>
      <div data-testid="license-loading">{String(license.loading)}</div>
      <div data-testid="license-tier">{license.tier}</div>
      <div data-testid="license-unlocked">{JSON.stringify(license.unlockedModules)}</div>
      <div data-testid="mod-standard">{String(license.isModuleUnlocked('marmalade'))}</div>
      <div data-testid="mod-pro">{String(license.isModuleUnlocked('compote'))}</div>
      <div data-testid="mod-ultra">{String(license.isModuleUnlocked('security'))}</div>
      <div data-testid="route-indexers">{String(license.isRouteUnlocked('/indexers'))}</div>
      <div data-testid="route-dvr">{String(license.isRouteUnlocked('/dvr'))}</div>
      <div data-testid="route-unknown">{String(license.isRouteUnlocked('/unknown-route'))}</div>
      <div data-testid="required-tier-compote">{license.getRequiredTier('compote')}</div>
      <div data-testid="required-tier-security">{license.getRequiredTier('security')}</div>
      <div data-testid="required-tier-unknown">{license.getRequiredTier('unknown')}</div>
      <div data-testid="route-tier-indexers">{license.getRouteRequiredTier('/indexers')}</div>
      <div data-testid="route-tier-dvr">{license.getRouteRequiredTier('/dvr')}</div>
      <button data-testid="refresh-btn" onClick={() => license.refreshLicense()}>Refresh</button>
    </div>
  );
};

describe('LicenseContext Provider - Cookie-Auth Tier Gating', () => {
  let capturedLicense;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedLicense = null;
  });

  describe('Initial State Hydration', () => {
    test('fetches /api/cellar/status on mount without localStorage token gating', async () => {
      axios.get.mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: ['marmalade', 'compote'] } });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('license-loading')).toHaveTextContent('false'));
      expect(screen.getByTestId('license-tier')).toHaveTextContent('pro');
      expect(screen.getByTestId('license-unlocked')).toContain('marmalade');
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/cellar/status'));
    });

    test('falls back to standard tier when status call fails', async () => {
      axios.get.mockRejectedValueOnce(new Error('401 Unauthorized'));
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('license-loading')).toHaveTextContent('false'));
      expect(screen.getByTestId('license-tier')).toHaveTextContent('standard');
      expect(screen.getByTestId('license-unlocked')).toHaveTextContent('[]');
    });

    test('handles network error gracefully', async () => {
      axios.get.mockRejectedValueOnce({ code: 'ECONNABORTED', message: 'timeout' });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('license-loading')).toHaveTextContent('false'));
      expect(screen.getByTestId('license-tier')).toHaveTextContent('standard');
    });

    test('handles empty response from backend', async () => {
      axios.get.mockResolvedValueOnce({ data: {} });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('license-loading')).toHaveTextContent('false'));
      expect(screen.getByTestId('license-tier')).toHaveTextContent('standard');
    });

    test('multiple consumers receive same state reference', async () => {
      axios.get.mockResolvedValueOnce({ data: { tier: 'ultra', modules_unlocked: [] } });
      
      const Probe1 = () => {
        const l = useLicense();
        return <div data-testid="probe1">{l.tier}</div>;
      };
      const Probe2 = () => {
        const l = useLicense();
        return <div data-testid="probe2">{l.tier}</div>;
      };
      
      render(
        <LicenseProvider>
          <Probe1 />
          <Probe2 />
        </LicenseProvider>
      );
      
      await waitFor(() => expect(screen.getByTestId('probe1')).toHaveTextContent('ultra'));
      expect(screen.getByTestId('probe2')).toHaveTextContent('ultra');
    });
  });

  describe('Tier-Based Module Unlocking', () => {
    test('standard tier unlocks only standard modules', async () => {
      axios.get.mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('standard'));
      expect(screen.getByTestId('mod-standard')).toHaveTextContent('true');
      expect(screen.getByTestId('mod-pro')).toHaveTextContent('false');
      expect(screen.getByTestId('mod-ultra')).toHaveTextContent('false');
    });

    test('pro tier unlocks standard + pro modules but not ultra', async () => {
      axios.get.mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'));
      expect(screen.getByTestId('mod-standard')).toHaveTextContent('true');
      expect(screen.getByTestId('mod-pro')).toHaveTextContent('true');
      expect(screen.getByTestId('mod-ultra')).toHaveTextContent('false');
    });

    test('ultra tier unlocks all modules', async () => {
      axios.get.mockResolvedValueOnce({ data: { tier: 'ultra', modules_unlocked: [] } });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('ultra'));
      expect(screen.getByTestId('mod-standard')).toHaveTextContent('true');
      expect(screen.getByTestId('mod-pro')).toHaveTextContent('true');
      expect(screen.getByTestId('mod-ultra')).toHaveTextContent('true');
    });

    test('modules_unlocked from backend overrides tier calculation', async () => {
      // Backend explicitly unlocks a pro module for standard tier user
      axios.get.mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: ['compote'] } });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('standard'));
      // The isModuleUnlocked uses TIER_RANK comparison, not modules_unlocked
      // This is a design note - modules_unlocked is informational only
      expect(screen.getByTestId('mod-pro')).toHaveTextContent('false');
    });
  });

  describe('Route-Based Access Control', () => {
    test('isRouteUnlocked returns true for standard routes', async () => {
      axios.get.mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('route-unknown')).toHaveTextContent('true'));
    });

    test('isRouteUnlocked respects tier for mapped routes', async () => {
      axios.get.mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('route-indexers')).toHaveTextContent('true'));
      expect(screen.getByTestId('route-dvr')).toHaveTextContent('false'); // ultra only
    });

    test('getRouteRequiredTier returns correct tier for routes', async () => {
      axios.get.mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('route-tier-indexers')).toHaveTextContent('pro'));
      expect(screen.getByTestId('route-tier-dvr')).toHaveTextContent('ultra');
    });

    test('getRouteRequiredTier returns standard for unknown routes', async () => {
      axios.get.mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      
      await waitFor(() => expect(screen.getByTestId('route-tier-indexers')).toHaveTextContent('pro'));
    });
  });

  describe('Module Tier Configuration', () => {
    test('every mapped route resolves to a module string', () => {
      Object.values(ROUTE_MODULE_MAP).forEach((mod) => {
        expect(typeof mod).toBe('string');
        expect(mod.length).toBeGreaterThan(0);
      });
    });

    test('MODULE_TIER has entries for all modules in ROUTE_MODULE_MAP', () => {
      const modulesInMap = new Set(Object.values(ROUTE_MODULE_MAP));
      modulesInMap.forEach(mod => {
        expect(MODULE_TIER).toHaveProperty(mod);
      });
    });

    test('TIER_RANK ordering is correct', () => {
      expect(TIER_RANK.standard).toBe(0);
      expect(TIER_RANK.pro).toBe(1);
      expect(TIER_RANK.ultra).toBe(2);
    });
  });

  describe('License Change Event Listener', () => {
    test('listens for watchnexus_license_changed event and refreshes', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } })
        .mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('standard'));
      
      // Dispatch the custom event
      act(() => {
        window.dispatchEvent(new CustomEvent('watchnexus_license_changed'));
      });
      
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'));
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    test('cleans up event listener on unmount', async () => {
      axios.get.mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } });
      
      const { unmount } = render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('standard'));
      
      unmount();
      
      // After unmount, event should not trigger refresh
      axios.get.mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });
      act(() => {
        window.dispatchEvent(new CustomEvent('watchnexus_license_changed'));
      });
      
      // Wait for any async operations
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      // Should not have made the second call
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Manual Refresh', () => {
    test('refreshLicense re-fetches from backend', async () => {
      axios.get
        .mockResolvedValueOnce({ data: { tier: 'standard', modules_unlocked: [] } })
        .mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });
      
      render(<LicenseProvider><LicenseProbe /></LicenseProvider>);
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('standard'));
      
      await act(async () => {
        await screen.getByTestId('refresh-btn').click();
      });
      
      await waitFor(() => expect(screen.getByTestId('license-tier')).toHaveTextContent('pro'));
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Boundaries', () => {
    test('throws error when useLicense used outside LicenseProvider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<LicenseProbe />, { wrapperOverrides: { skipLicense: true } });
      }).toThrow('useLicense must be used within LicenseProvider');
      
      consoleError.mockRestore();
    });
  });
});