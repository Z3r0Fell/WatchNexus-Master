import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Key, Shield, Zap, Crown, Check, X, AlertTriangle,
  Lock, Unlock, ChevronRight, Loader2, Copy, CheckCircle2
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { BACKEND_URL } from '../../lib/config';

const API = BACKEND_URL;

const TIER_CONFIG = {
  standard: {
    name: 'Standard',
    icon: Shield,
    color: '#6B7280',
    gradient: 'from-gray-600 to-gray-700',
    border: 'border-gray-500/30',
    bg: 'bg-gray-500/10',
    badge: 'bg-gray-600 text-gray-100',
    description: 'Core media server with essential features',
  },
  pro: {
    name: 'Pro',
    icon: Zap,
    color: '#3B82F6',
    gradient: 'from-blue-600 to-cyan-600',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    badge: 'bg-blue-600 text-blue-100',
    description: 'Advanced automation, analytics, and network tools',
  },
  ultra: {
    name: 'Ultra',
    icon: Crown,
    color: '#8B5CF6',
    gradient: 'from-violet-600 to-purple-600',
    border: 'border-violet-500/30',
    bg: 'bg-violet-500/10',
    badge: 'bg-violet-600 text-violet-100',
    description: 'Full suite with security, processing, and all gadgets',
  },
};

export const ActivationSettings = () => {
  const [status, setStatus] = useState(null);
  const [tiers, setTiers] = useState(null);
  const [serial, setSerial] = useState('');
  const [activating, setActivating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    fetchTiers();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API}/api/cellar/status`);
      setStatus(res.data);
    } catch {
      setStatus({ tier: 'standard', tier_name: 'Standard', activated: false });
    } finally {
      setLoading(false);
    }
  };

  const fetchTiers = async () => {
    try {
      const res = await axios.get(`${API}/api/cellar/tiers`);
      setTiers(res.data?.tiers);
    } catch { console.error('[ActivationSettings] Failed to fetch tiers'); toast.error('[ActivationSettings] Failed to fetch tiers');; }
  };

  const handleActivate = async () => {
    if (!serial.trim()) { toast.error('Please enter a serial number'); return; }
    setActivating(true);
    try {
      const res = await axios.post(`${API}/api/cellar/activate`, { serial: serial.trim() });
      if (res.data.success) {
        toast.success(res.data.message);
        await fetchStatus();
        setSerial('');
        window.dispatchEvent(new Event('watchnexus_license_changed'));
      } else {
        toast.error(res.data.message || 'Activation failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid serial number');
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure? This will revert to Standard tier.')) return;
    try {
      const res = await axios.post(`${API}/api/cellar/deactivate`);
      if (res.data.success) {
        toast.success(res.data.message);
        await fetchStatus();
        window.dispatchEvent(new Event('watchnexus_license_changed'));
      }
    } catch {
      toast.error('Failed to deactivate');
    }
  };

  const formatSerial = (value) => {
    const clean = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const parts = [];
    for (let i = 0; i < clean.length && parts.length < 5; i += (parts.length < 2 ? 3 : 4)) {
      if (parts.length === 0) parts.push(clean.slice(0, 3));
      else if (parts.length === 1) parts.push(clean.slice(3, 6));
      else parts.push(clean.slice(6 + (parts.length - 2) * 4, 6 + (parts.length - 1) * 4));
    }
    return parts.filter(Boolean).join('-');
  };

  const handleSerialChange = (e) => {
    const raw = e.target.value;
    if (raw.includes('-') && raw.length > serial.length) {
      setSerial(raw.toUpperCase().slice(0, 23));
    } else {
      setSerial(formatSerial(raw));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const currentTier = status?.tier || 'standard';
  const tierCfg = TIER_CONFIG[currentTier];
  const TierIcon = tierCfg.icon;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="activation-settings">
      {/* Current License Banner */}
      <div className={`rounded-2xl border ${tierCfg.border} overflow-hidden`}>
        <div className={`bg-gradient-to-r ${tierCfg.gradient} p-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                <TierIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white">WatchNexus {tierCfg.name}</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${tierCfg.badge}`}>
                    {status?.activated ? 'ACTIVATED' : 'FREE'}
                  </span>
                </div>
                <p className="text-white/70 text-sm mt-1">{tierCfg.description}</p>
              </div>
            </div>
            <div className="text-right hidden md:block">
              <p className="text-white/60 text-xs">Modules Unlocked</p>
              <p className="text-3xl font-bold text-white">{status?.total_modules || 0}</p>
            </div>
          </div>
        </div>

        {/* Serial Info (if activated) */}
        {status?.activated && status?.serial && (
          <div className="px-6 py-3 bg-black/30 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Key className="w-4 h-4" />
              <span className="font-mono">{status.serial}</span>
              {status.activated_at && (
                <span className="text-gray-500 ml-4">
                  Activated {new Date(status.activated_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeactivate}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              data-testid="deactivate-license-btn"
            >
              <X className="w-4 h-4 mr-1" /> Deactivate
            </Button>
          </div>
        )}
      </div>

      {/* Activation Form */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Key className="w-5 h-5" style={{ color: 'var(--primary, #8B5CF6)' }} />
          {status?.activated ? 'Change License' : 'Activate License'}
        </h3>
        <p className="text-sm text-gray-400 mb-5">
          Enter your serial number to unlock Pro or Ultra features.
        </p>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={serial}
              onChange={handleSerialChange}
              placeholder="WNX-PRO-XXXX-XXXX-XXXX"
              maxLength={23}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-lg tracking-wider placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50"
              data-testid="serial-number-input"
              onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
            />
            {serial && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {serial.startsWith('WNX-PRO') && serial.length >= 19 ? (
                  <span className="text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-1 rounded">PRO</span>
                ) : serial.startsWith('WNX-ULT') && serial.length >= 19 ? (
                  <span className="text-xs font-bold text-violet-400 bg-violet-500/20 px-2 py-1 rounded">ULTRA</span>
                ) : null}
              </div>
            )}
          </div>
          <Button
            onClick={handleActivate}
            disabled={activating || serial.length < 19}
            className="px-6 shrink-0"
            style={{ backgroundColor: 'var(--primary, #8B5CF6)' }}
            data-testid="activate-license-btn"
          >
            {activating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activating...</>
            ) : (
              <><Unlock className="w-4 h-4 mr-2" /> Activate</>
            )}
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Serial format: <span className="font-mono text-gray-400">WNX-PRO-XXXX-XXXX-XXXX</span> or <span className="font-mono text-gray-400">WNX-ULT-XXXX-XXXX-XXXX</span>
        </p>
      </div>

      {/* Tier Comparison */}
      <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold">Feature Tiers</h3>
          <p className="text-sm text-gray-400">Compare what's included in each tier</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {Object.entries(TIER_CONFIG).map(([tierKey, cfg]) => {
            const Icon = cfg.icon;
            const isActive = currentTier === tierKey ||
              (currentTier === 'pro' && tierKey === 'standard') ||
              (currentTier === 'ultra');
            const modules = tiers?.[tierKey]?.modules || [];

            return (
              <div key={tierKey} className={`p-5 ${isActive ? 'bg-white/[0.02]' : ''}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white">{cfg.name}</h4>
                      {isActive && (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{modules.length} modules</p>
                  </div>
                </div>

                <p className="text-xs text-gray-400 mb-3">{cfg.description}</p>

                {tierKey !== 'standard' && (
                  <p className="text-xs text-gray-500 mb-2 italic">
                    + Everything in {tierKey === 'ultra' ? 'Pro' : 'Standard'}
                  </p>
                )}

                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {modules.map((mod) => (
                    <div key={mod} className="flex items-center gap-2 text-xs">
                      {isActive ? (
                        <Check className="w-3 h-3 text-green-400 shrink-0" />
                      ) : (
                        <Lock className="w-3 h-3 text-gray-600 shrink-0" />
                      )}
                      <span className={isActive ? 'text-gray-300' : 'text-gray-600'}>{mod}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          Need a License?
        </h3>
        <p className="text-sm text-gray-400 mb-2">
          Serial numbers can be purchased from the WatchNexus website or authorized resellers.
        </p>
        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
          <li><strong className="text-blue-400">Pro</strong> keys start with <span className="font-mono bg-blue-500/10 px-1.5 py-0.5 rounded text-blue-300">WNX-PRO-</span></li>
          <li><strong className="text-violet-400">Ultra</strong> keys start with <span className="font-mono bg-violet-500/10 px-1.5 py-0.5 rounded text-violet-300">WNX-ULT-</span></li>
          <li>Each key activates one installation. Contact support for transfers.</li>
        </ul>
      </div>
    </motion.div>
  );
};

export default ActivationSettings;
