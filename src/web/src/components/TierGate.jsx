import { useNavigate } from 'react-router-dom';
import { Lock, Zap, Crown, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Layout } from './layout/Layout';
import { useLicense, ROUTE_MODULE_MAP } from '../context/LicenseContext';

const TIER_DISPLAY = {
  pro: { name: 'Pro', icon: Zap, color: '#3B82F6', gradient: 'from-blue-600 to-cyan-600' },
  ultra: { name: 'Ultra', icon: Crown, color: '#8B5CF6', gradient: 'from-violet-600 to-purple-600' },
};

export const TierGate = ({ children, path }) => {
  const { isRouteUnlocked, getRouteRequiredTier } = useLicense();
  const navigate = useNavigate();

  if (isRouteUnlocked(path)) return children;

  const requiredTier = getRouteRequiredTier(path);
  const display = TIER_DISPLAY[requiredTier] || TIER_DISPLAY.pro;
  const Icon = display.icon;
  const moduleName = ROUTE_MODULE_MAP[path] || 'this feature';

  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center p-8" data-testid="tier-gate">
        <div className="max-w-md w-full text-center space-y-6">
          <div className={`w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br ${display.gradient} flex items-center justify-center shadow-2xl`}>
            <Lock className="w-9 h-9 text-white/90" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {display.name} Feature
            </h1>
            <p className="text-gray-400">
              <span className="font-mono text-sm px-2 py-0.5 rounded bg-white/5 border border-white/10">{moduleName}</span> requires a WatchNexus <span className="font-semibold" style={{ color: display.color }}>{display.name}</span> license.
            </p>
          </div>

          <div className="bg-surface border border-white/10 rounded-2xl p-5 text-left space-y-3">
            <div className="flex items-center gap-3">
              <Icon className="w-5 h-5" style={{ color: display.color }} />
              <span className="font-medium text-white">WatchNexus {display.name}</span>
            </div>
            <p className="text-sm text-gray-400">
              {requiredTier === 'ultra'
                ? 'Unlock the full suite: security, media processing, notifications, disc ripping, and all premium gadgets.'
                : 'Unlock automation, analytics, scheduled tasks, advanced search, and network tools.'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => navigate('/settings', { state: { section: 'activation' } })}
              className="w-full py-3"
              style={{ backgroundColor: display.color }}
              data-testid="tier-gate-activate-btn"
            >
              <ArrowRight className="w-4 h-4 mr-2" /> Enter Serial Number
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-white"
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};
