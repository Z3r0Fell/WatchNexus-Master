import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Key, Shield, Zap, Crown, ArrowRight, Loader2, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

const API = BACKEND_URL;

const TIERS = [
  { id: 'standard', name: 'Standard', icon: Shield, color: '#6B7280', gradient: 'from-gray-600 to-gray-700', desc: 'Core media server — library management, streaming, discovery, basic gadgets' },
  { id: 'pro', name: 'Pro', icon: Zap, color: '#3B82F6', gradient: 'from-blue-600 to-cyan-600', desc: 'Automation, analytics, scheduled tasks, network tools, advanced search' },
  { id: 'ultra', name: 'Ultra', icon: Crown, color: '#8B5CF6', gradient: 'from-violet-600 to-purple-600', desc: 'Full suite — security, media processing, disc ripping, all integrations' },
];

export const FirstLaunchGate = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [needsActivation, setNeedsActivation] = useState(false);
  const [serial, setSerial] = useState('');
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    checkFirstLaunch();
  }, []);

  const checkFirstLaunch = async () => {
    try {
      const res = await axios.get(`${API}/api/cellar/first-launch`);
      if (res.data.needs_activation && !res.data.setup_completed) {
        setNeedsActivation(true);
      }
    } catch {
      // If endpoint fails, skip gate
    } finally {
      setChecking(false);
    }
  };

  const handleActivate = async () => {
    if (!serial.trim()) { toast.error('Please enter a serial number'); return; }
    setActivating(true);
    try {
      const res = await axios.post(`${API}/api/cellar/activate-first-launch`, { serial: serial.trim() });
      if (res.data.success) {
        toast.success(res.data.message);
        setNeedsActivation(false);
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

  const handleSkip = async () => {
    try {
      await axios.post(`${API}/api/cellar/activate-first-launch`, { skip: true });
      setNeedsActivation(false);
    } catch {
      setNeedsActivation(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!needsActivation) return children;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6" data-testid="first-launch-gate">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full space-y-8"
      >
        {/* Logo & Welcome */}
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-2xl shadow-violet-500/30">
            <Key className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to WatchNexus</h1>
          <p className="text-gray-400 text-lg">Enter your serial number to unlock your edition</p>
        </div>

        {/* Serial Input */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={serial}
              onChange={(e) => setSerial(e.target.value.toUpperCase())}
              placeholder="Enter serial number..."
              className="flex-1 px-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-lg tracking-wider placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              data-testid="first-launch-serial-input"
              onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
            />
            <Button
              onClick={handleActivate}
              disabled={activating || !serial.trim()}
              className="px-6 shrink-0 bg-violet-600 hover:bg-violet-700"
              data-testid="first-launch-activate-btn"
            >
              {activating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            return (
              <div key={tier.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tier.gradient} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-white text-sm">{tier.name}</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{tier.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Skip */}
        <div className="text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            data-testid="first-launch-skip-btn"
          >
            Continue with Standard (free) <ChevronRight className="w-3 h-3 inline ml-0.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
