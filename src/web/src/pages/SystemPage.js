import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { systemApi } from '../services/nexusApi';
import { toast } from 'sonner';
import {
  Server, Cpu, HardDrive, Activity, CheckCircle, Clock,
  Shield, Wifi, Layers, Box, RefreshCw, Globe, Zap, Film,
  Download, Archive, Rss, Timer, Lock, Key, Database,
  Monitor, MemoryStick, Gauge
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn, formatDuration } from '../lib/utils';

const MODULE_ICONS = {
  Marmalade: Layers, Compote: Box, Fondue: Film, Garnish: Box,
  Gelatin: Globe, Zest: Activity, Relish: Box, Drizzle: Box,
  Cream: Box, Fprint: Box, Potluck: Box, Sieve: Box,
  Syrup: Box, Tiramisu: Box, Bastion: Shield, Tunnel: Wifi,
  Glaze: Activity, Roux: Layers, Sprout: Rss, Saffron: Timer,
  Sourdough: Archive, Churro: Download, Fondue: Film,
  Taffy: Box, Pantry: Database, Nutmeg: Zap,
  Ripen: Box, Crucible: Box, Truffle: Gauge, Pepper: Box,
  Meringue: Box, Rind: Lock, Brine: Box, Crumbs: Key,
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

  const formatBytes = (bytes) => {
    if (!bytes) return 'N/A';
    const gb = bytes / (1024 * 1024 * 1024);
    const mb = bytes / (1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <Layout>
      <div data-testid="system-page" className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                <Server className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">System — {info?.codename || 'WatchNexus'}</h1>
                <p className="text-sm text-gray-500">Version {info?.version || '...'} | {info?.framework || '.NET'}</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={load} data-testid="refresh-system">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </motion.div>

        {/* Health Cards */}
        {health && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-400">Status</span>
              </div>
              <p data-testid="system-status" className="text-xl font-bold text-emerald-400 capitalize">{health.status}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Runtime</span>
              </div>
              <p data-testid="system-runtime" className="text-sm font-medium">{health.runtime || info?.framework || 'N/A'}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="w-4 h-4 text-violet-400" />
                <span className="text-sm text-gray-400">OS</span>
              </div>
              <p data-testid="system-os" className="text-sm font-medium truncate" title={health.os}>{health.os || 'N/A'}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-gray-400">Server Time</span>
              </div>
              <p data-testid="system-time" className="text-sm font-medium">{new Date(health.timestamp).toLocaleString()}</p>
            </motion.div>
          </div>
        )}

        {/* Server Details */}
        {info && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-400" /> Server Details
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Hostname', value: info.hostname, icon: Server },
                { label: 'Architecture', value: info.architecture || health?.architecture, icon: Cpu },
                { label: '.NET Version', value: info.dotnet_version, icon: Zap },
                { label: 'CPU Cores', value: info.cpu_count, icon: Cpu },
                { label: 'Memory Used', value: formatBytes(info.memory_used), icon: MemoryStick },
                { label: 'Uptime', value: formatUptime(info.uptime), icon: Clock },
                { label: 'Platform', value: (info.platform || '').split(' ').slice(0, 2).join(' '), icon: Globe },
                { label: 'Modules', value: info.modules?.length || 0, icon: Layers },
              ].map((item, i) => (
                <div key={item.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <item.icon className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs text-gray-500">{item.label}</span>
                  </div>
                  <p data-testid={`server-${item.label.toLowerCase().replace(/[^a-z]/g, '-')}`} className="text-sm font-medium truncate" title={String(item.value)}>{item.value || 'N/A'}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Security Features */}
        {info?.security && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" /> Security Features
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(info.security).map(([key, enabled], i) => (
                <motion.div key={key} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + i * 0.03 }}
                  className={cn("p-3 rounded-xl border text-center",
                    enabled
                      ? "bg-emerald-500/5 border-emerald-500/15"
                      : "bg-white/[0.02] border-white/[0.05]"
                  )}>
                  <div className={cn("w-6 h-6 rounded-full mx-auto mb-2 flex items-center justify-center",
                    enabled ? "bg-emerald-500/20" : "bg-gray-500/20")}>
                    <CheckCircle className={cn("w-3.5 h-3.5", enabled ? "text-emerald-400" : "text-gray-600")} />
                  </div>
                  <p data-testid={`security-${key}`} className="text-xs font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Modules */}
        {info?.modules && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-400" /> Modules ({info.modules.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {info.modules.map((mod, i) => {
                const Icon = MODULE_ICONS[mod.name] || Box;
                return (
                  <motion.div key={mod.codename || mod.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.02 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-all"
                    data-testid={`module-${mod.codename || mod.name}`}>
                    <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{mod.name}</p>
                        {mod.codename && (
                          <span className="text-xs text-gray-600">({mod.codename})</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{mod.description || `v${mod.version}`}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={cn("px-2 py-0.5 rounded text-xs",
                        mod.status === 'active' ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-500/15 text-gray-500"
                      )}>{mod.status}</span>
                      {mod.version && (
                        <span className="text-xs text-gray-600">v{mod.version}</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
