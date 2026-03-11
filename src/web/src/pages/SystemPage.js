import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { systemApi } from '../services/nexusApi';
import { toast } from 'sonner';
import {
  Server, Cpu, HardDrive, Activity, CheckCircle, Clock,
  Shield, Wifi, Layers, Box, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

const MODULE_ICONS = {
  Marmalade: Layers, Compote: Box, Fondue: HardDrive, Garnish: Box,
  Gelatin: Activity, Zest: Box, Relish: Box, Drizzle: Box,
  Cream: Box, Fprint: Box, Potluck: Box, Sieve: Box,
  Syrup: Box, Bastion: Shield, Tunnel: Wifi,
};

export default function SystemPage() {
  const [health, setHealth] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [h, i] = await Promise.all([
        systemApi.getHealth(),
        systemApi.getInfo(),
      ]);
      setHealth(h.data);
      setInfo(i.data);
    } catch { toast.error('Failed to load system info'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <Layout>
      <div data-testid="system-page" className="p-8 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                <Server className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">System — {info?.codename || 'WatchNexus'}</h1>
                <p className="text-sm text-gray-500">Version {info?.version || '...'} | {info?.framework || '.NET 8'}</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={load} data-testid="refresh-system">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </motion.div>

        {/* Health */}
        {health && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-400">Status</span>
              </div>
              <p className="text-xl font-bold text-emerald-400 capitalize">{health.status}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Runtime</span>
              </div>
              <p className="text-sm font-medium">{health.runtime}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="w-4 h-4 text-violet-400" />
                <span className="text-sm text-gray-400">OS</span>
              </div>
              <p className="text-sm font-medium truncate">{health.os}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-gray-400">Server Time</span>
              </div>
              <p className="text-sm font-medium">{new Date(health.timestamp).toLocaleString()}</p>
            </motion.div>
          </div>
        )}

        {/* Security Features */}
        {info?.security && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" /> Security Features
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(info.security).map(([key, enabled], i) => (
                <motion.div key={key} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn("p-3 rounded-xl border text-center",
                    enabled
                      ? "bg-emerald-500/5 border-emerald-500/15"
                      : "bg-white/[0.02] border-white/[0.05]"
                  )}>
                  <div className={cn("w-6 h-6 rounded-full mx-auto mb-2 flex items-center justify-center",
                    enabled ? "bg-emerald-500/20" : "bg-gray-500/20")}>
                    <CheckCircle className={cn("w-3.5 h-3.5", enabled ? "text-emerald-400" : "text-gray-600")} />
                  </div>
                  <p className="text-xs font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Modules */}
        {info?.modules && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-400" /> Modules ({info.modules.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {info.modules.map((mod, i) => {
                const Icon = MODULE_ICONS[mod.name] || Box;
                return (
                  <motion.div key={mod.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-all">
                    <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{mod.name}</p>
                      <p className="text-xs text-gray-500 truncate">{mod.description}</p>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded text-xs",
                      mod.status === 'active' ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-500/15 text-gray-500"
                    )}>{mod.status}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
