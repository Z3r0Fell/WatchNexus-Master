import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { vpnApi } from '../services/nexusApi';
import { toast } from 'sonner';
import {
  Shield, Wifi, WifiOff, Server, Plus, Trash2, Copy, Download,
  ToggleLeft, ToggleRight, RefreshCw, Activity, ArrowUpDown,
  Globe, Clock, Users, Power, PowerOff, ChevronDown, Settings,
  QrCode, Terminal, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-all">
    <div className="flex items-start justify-between mb-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-2xl font-bold tracking-tight">{value}</span>
    </div>
    <p className="text-sm text-gray-400">{label}</p>
    {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
  </motion.div>
);

// Server Config Section
const ServerConfig = ({ config, onRefresh }) => {
  const [showSetup, setShowSetup] = useState(false);
  const [setupForm, setSetupForm] = useState({
    external_endpoint: '', listen_port: 51820, subnet: '10.66.66.0/24',
    dns_servers: '1.1.1.1, 8.8.8.8', max_peers: 50
  });
  const [toggling, setToggling] = useState(false);
  const [wgStatus, setWgStatus] = useState(null);
  const [showWgTerminal, setShowWgTerminal] = useState(false);
  const [wgOutput, setWgOutput] = useState('');

  const handleSetup = async () => {
    try {
      await vpnApi.setupServer(setupForm);
      toast.success('VPN server configured');
      setShowSetup(false);
      onRefresh();
    } catch (e) { toast.error(e.response?.data?.message || 'Setup failed'); }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      if (config?.is_active) {
        await vpnApi.deactivateServer();
        toast.success('VPN server deactivated');
      } else {
        await vpnApi.activateServer();
        toast.success('VPN server activated');
      }
      onRefresh();
    } catch (e) { toast.error('Toggle failed'); }
    finally { setToggling(false); }
  };

  const handleWgUp = async () => {
    try {
      const res = await vpnApi.wgUp();
      setWgOutput(res.data.output || res.data.message);
      setShowWgTerminal(true);
      toast.success('WireGuard interface up');
      onRefresh();
    } catch (e) {
      setWgOutput(e.response?.data?.message || 'Command failed');
      setShowWgTerminal(true);
      toast.error('WireGuard up failed');
    }
  };

  const handleWgDown = async () => {
    try {
      const res = await vpnApi.wgDown();
      setWgOutput(res.data.output || res.data.message);
      setShowWgTerminal(true);
      toast.success('WireGuard interface down');
      onRefresh();
    } catch (e) {
      setWgOutput(e.response?.data?.message || 'Command failed');
      setShowWgTerminal(true);
    }
  };

  const handleWgStatus = async () => {
    try {
      const res = await vpnApi.wgStatus();
      setWgOutput(res.data.output || 'No WireGuard interfaces found');
      setShowWgTerminal(true);
    } catch (e) {
      setWgOutput(e.response?.data?.message || 'Status check failed');
      setShowWgTerminal(true);
    }
  };

  if (!config?.configured) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] border-dashed">
        {!showSetup ? (
          <div className="text-center py-8">
            <Server className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">VPN Server Not Configured</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Set up a WireGuard VPN server to enable secure remote access to your WatchNexus instance.
            </p>
            <Button onClick={() => setShowSetup(true)} data-testid="setup-vpn-btn"
              className="bg-cyan-600 hover:bg-cyan-700 text-white">
              <Server className="w-4 h-4 mr-2" /> Configure VPN Server
            </Button>
          </div>
        ) : (
          <div className="space-y-4" data-testid="vpn-setup-form">
            <h3 className="text-lg font-semibold">WireGuard Server Setup</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">External Endpoint</label>
                <Input placeholder="my.server.com" value={setupForm.external_endpoint}
                  onChange={e => setSetupForm(p => ({ ...p, external_endpoint: e.target.value }))}
                  data-testid="vpn-endpoint-input" className="bg-white/5 border-white/10 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Listen Port</label>
                <Input type="number" value={setupForm.listen_port}
                  onChange={e => setSetupForm(p => ({ ...p, listen_port: parseInt(e.target.value) || 51820 }))}
                  className="bg-white/5 border-white/10 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Subnet</label>
                <Input value={setupForm.subnet}
                  onChange={e => setSetupForm(p => ({ ...p, subnet: e.target.value }))}
                  className="bg-white/5 border-white/10 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">DNS Servers</label>
                <Input value={setupForm.dns_servers}
                  onChange={e => setSetupForm(p => ({ ...p, dns_servers: e.target.value }))}
                  className="bg-white/5 border-white/10 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Max Peers</label>
                <Input type="number" value={setupForm.max_peers}
                  onChange={e => setSetupForm(p => ({ ...p, max_peers: parseInt(e.target.value) || 50 }))}
                  className="bg-white/5 border-white/10 h-9 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowSetup(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSetup} data-testid="confirm-vpn-setup-btn"
                className="bg-cyan-600 hover:bg-cyan-700 text-white">Initialize Server</Button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center",
            config.is_active ? "bg-cyan-500/15" : "bg-gray-500/15")}>
            <Server className={cn("w-5 h-5", config.is_active ? "text-cyan-400" : "text-gray-500")} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">WireGuard Server</h3>
            <p className="text-xs text-gray-500">
              Port {config.listen_port} | Subnet {config.subnet}
              {config.external_endpoint && ` | ${config.external_endpoint}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("px-2.5 py-1 rounded-lg text-xs font-medium",
            config.is_active ? "bg-cyan-500/15 text-cyan-400" : "bg-gray-500/15 text-gray-500"
          )}>{config.is_active ? 'Active' : 'Inactive'}</span>
          <Button size="sm" variant="ghost" onClick={handleToggle} disabled={toggling}
            data-testid="toggle-vpn-server-btn">
            {config.is_active
              ? <PowerOff className="w-4 h-4 text-red-400" />
              : <Power className="w-4 h-4 text-cyan-400" />
            }
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-center">
          <p className="text-xs text-gray-500">Public Key</p>
          <p className="text-xs font-mono truncate mt-0.5">{config.public_key?.slice(0, 16)}...</p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-center">
          <p className="text-xs text-gray-500">DNS</p>
          <p className="text-xs mt-0.5">{config.dns_servers}</p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-center">
          <p className="text-xs text-gray-500">Max Peers</p>
          <p className="text-xs mt-0.5">{config.max_peers}</p>
        </div>
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] text-center">
          <p className="text-xs text-gray-500">Internet Access</p>
          <p className="text-xs mt-0.5">{config.allow_internet ? 'Yes' : 'No'}</p>
        </div>
      </div>

      {/* WireGuard Controls */}
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={handleWgUp} data-testid="wg-up-btn"
          className="bg-cyan-600/80 hover:bg-cyan-700 text-white text-xs">
          <Power className="w-3.5 h-3.5 mr-1" /> wg-quick up
        </Button>
        <Button size="sm" onClick={handleWgDown} data-testid="wg-down-btn"
          className="bg-red-600/80 hover:bg-red-700 text-white text-xs">
          <PowerOff className="w-3.5 h-3.5 mr-1" /> wg-quick down
        </Button>
        <Button size="sm" variant="ghost" onClick={handleWgStatus} data-testid="wg-status-btn"
          className="text-xs">
          <Terminal className="w-3.5 h-3.5 mr-1" /> wg show
        </Button>
      </div>

      <AnimatePresence>
        {showWgTerminal && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="mt-3">
            <div className="relative">
              <button onClick={() => setShowWgTerminal(false)}
                className="absolute top-2 right-2 p-1 rounded hover:bg-white/10">
                <X className="w-3 h-3 text-gray-400" />
              </button>
              <pre className="px-4 py-3 rounded-lg bg-black/60 border border-white/[0.05] text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                {wgOutput || 'No output'}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Peer Card
const PeerCard = ({ peer, onToggle, onDelete }) => {
  const [qrData, setQrData] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);

  const handleShowQr = async () => {
    if (qrData) { setQrData(null); return; }
    setLoadingQr(true);
    try {
      const res = await vpnApi.getPeerQr(peer.id);
      setQrData(res.data);
    } catch { toast.error('Failed to generate QR code'); }
    finally { setLoadingQr(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center",
            peer.is_enabled ? "bg-cyan-500/15" : "bg-gray-500/15")}>
            {peer.is_enabled ? <Wifi className="w-4 h-4 text-cyan-400" /> : <WifiOff className="w-4 h-4 text-gray-500" />}
          </div>
          <div>
            <p className="text-sm font-medium">{peer.name}</p>
            <p className="text-xs text-gray-500 font-mono">{peer.assigned_ip}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleShowQr}
            data-testid={`qr-peer-${peer.id}`}
            className={cn("p-1.5 rounded-lg hover:bg-white/5 transition-colors", loadingQr && "animate-pulse")}>
            <QrCode className={cn("w-4 h-4", qrData ? "text-cyan-400" : "text-gray-400")} />
          </button>
          <button onClick={() => onToggle(peer.id)}
            data-testid={`toggle-peer-${peer.id}`}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            {peer.is_enabled
              ? <ToggleRight className="w-5 h-5 text-cyan-400" />
              : <ToggleLeft className="w-5 h-5 text-gray-500" />
            }
          </button>
          <button onClick={() => onDelete(peer.id)}
            data-testid={`delete-peer-${peer.id}`}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* QR Code Display */}
      <AnimatePresence>
        {qrData && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="mb-3">
            <div className="p-3 rounded-lg bg-white/[0.03] border border-cyan-500/20 text-center">
              <p className="text-xs text-cyan-400 font-medium mb-2">Scan with WireGuard App</p>
              <img src={qrData.qr_image} alt="WireGuard QR Code" className="mx-auto rounded-lg" style={{ maxWidth: '200px' }} />
              <p className="text-xs text-gray-500 mt-2">Replace YOUR_PRIVATE_KEY with the key from initial setup</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="px-2 py-1.5 rounded-lg bg-white/[0.03]">
          <span className="text-gray-500">Rx:</span>{' '}
          <span>{formatBytes(peer.bytes_received)}</span>
        </div>
        <div className="px-2 py-1.5 rounded-lg bg-white/[0.03]">
          <span className="text-gray-500">Tx:</span>{' '}
          <span>{formatBytes(peer.bytes_sent)}</span>
        </div>
        <div className="px-2 py-1.5 rounded-lg bg-white/[0.03]">
          <span className="text-gray-500">Keep-alive:</span>{' '}
          <span>{peer.keep_alive}s</span>
        </div>
      </div>
      {peer.last_handshake && (
        <p className="text-xs text-gray-600 mt-2">
          Last handshake: {new Date(peer.last_handshake).toLocaleString()}
        </p>
      )}
    </motion.div>
  );
};

// Connection Logs Panel
const ConnectionLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vpnApi.getConnectionLogs().then(r => setLogs(r.data.items || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid="vpn-logs">
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Endpoint</th>
              <th className="px-4 py-3">Rx / Tx</th>
              <th className="px-4 py-3">Connected</th>
              <th className="px-4 py-3">Duration</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-mono text-xs">{log.endpoint || '—'}</td>
                <td className="px-4 py-3 text-xs">
                  {formatBytes(log.bytes_received)} / {formatBytes(log.bytes_sent)}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{new Date(log.connected_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs">{log.duration_seconds}s</td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No connection logs yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function VpnPage() {
  const [serverConfig, setServerConfig] = useState(null);
  const [peers, setPeers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddPeer, setShowAddPeer] = useState(false);
  const [newPeerName, setNewPeerName] = useState('');
  const [newPeerConfig, setNewPeerConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('peers');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, peersRes, statsRes] = await Promise.all([
        vpnApi.getServerConfig(),
        vpnApi.getPeers().catch(() => ({ data: [] })),
        vpnApi.getStats().catch(() => ({ data: null })),
      ]);
      setServerConfig(configRes.data);
      setPeers(peersRes.data || []);
      setStats(statsRes.data);
    } catch { toast.error('Failed to load VPN data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleCreatePeer = async () => {
    if (!newPeerName.trim()) return toast.error('Peer name required');
    try {
      const res = await vpnApi.createPeer({ name: newPeerName });
      setNewPeerConfig(res.data);
      toast.success('Peer created — download the config!');
      setShowAddPeer(false);
      setNewPeerName('');
      loadAll();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to create peer'); }
  };

  const handleTogglePeer = async (id) => {
    try {
      await vpnApi.togglePeer(id);
      loadAll();
    } catch { toast.error('Failed to toggle peer'); }
  };

  const handleDeletePeer = async (id) => {
    try {
      await vpnApi.deletePeer(id);
      toast.success('Peer deleted');
      loadAll();
    } catch { toast.error('Failed to delete peer'); }
  };

  const downloadConfig = (config, name) => {
    const blob = new Blob([config], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.conf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div data-testid="vpn-portal" className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">VPN Portal — Tunnel</h1>
              <p className="text-sm text-gray-500">WireGuard VPN management for secure remote access</p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Server} label="Server Status"
              value={stats.server_active ? 'Active' : 'Off'}
              color={stats.server_active ? "bg-cyan-500/15 text-cyan-400" : "bg-gray-500/15 text-gray-500"} />
            <StatCard icon={Users} label="Connected Peers"
              value={`${stats.active_peers}/${stats.total_peers}`}
              color="bg-blue-500/15 text-blue-400"
              sub={`Max: ${stats.max_peers}`} />
            <StatCard icon={ArrowUpDown} label="Traffic (24h)"
              value={formatBytes(stats.total_bytes_received_24h + stats.total_bytes_sent_24h)}
              color="bg-violet-500/15 text-violet-400" />
            <StatCard icon={Activity} label="Connections (24h)"
              value={stats.connections_24h}
              color="bg-amber-500/15 text-amber-400" />
          </div>
        )}

        {/* Server Config */}
        <div className="mb-6">
          <ServerConfig config={serverConfig} onRefresh={loadAll} />
        </div>

        {/* New peer config display */}
        <AnimatePresence>
          {newPeerConfig && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-cyan-400">New Peer: {newPeerConfig.name}</h3>
                  <p className="text-xs text-gray-400">IP: {newPeerConfig.assigned_ip}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => {
                    navigator.clipboard.writeText(newPeerConfig.client_config);
                    toast.success('Config copied');
                  }}>
                    <Copy className="w-4 h-4 mr-1" /> Copy
                  </Button>
                  <Button size="sm" onClick={() => downloadConfig(newPeerConfig.client_config, newPeerConfig.name)}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white">
                    <Download className="w-4 h-4 mr-1" /> Download .conf
                  </Button>
                </div>
              </div>
              <pre className="px-4 py-3 rounded-lg bg-black/40 text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre">
                {newPeerConfig.client_config}
              </pre>
              <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setNewPeerConfig(null)}>Dismiss</Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab('peers')}
              className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeTab === 'peers'
                  ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              )}>
              <Users className="w-4 h-4" /> Peers
              <span className={cn("px-1.5 py-0.5 rounded-md text-xs",
                activeTab === 'peers' ? "bg-cyan-500/20 text-cyan-300" : "bg-white/5 text-gray-500"
              )}>{peers.length}</span>
            </button>
            <button onClick={() => setActiveTab('logs')}
              className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeTab === 'logs'
                  ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              )}>
              <Activity className="w-4 h-4" /> Logs
            </button>
          </div>
          {activeTab === 'peers' && serverConfig?.configured && (
            <Button size="sm" onClick={() => setShowAddPeer(!showAddPeer)} data-testid="add-peer-btn"
              className="bg-cyan-600 hover:bg-cyan-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> Add Peer
            </Button>
          )}
        </div>

        {/* Add Peer Form */}
        <AnimatePresence>
          {showAddPeer && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
              <h3 className="text-sm font-medium">Add New Peer</h3>
              <div className="flex gap-3">
                <Input placeholder="Device name (e.g. My Laptop, Phone)" value={newPeerName}
                  onChange={e => setNewPeerName(e.target.value)}
                  data-testid="peer-name-input" className="bg-white/5 border-white/10 h-9 text-sm flex-1" />
                <Button size="sm" onClick={handleCreatePeer} data-testid="confirm-add-peer-btn"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white">Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddPeer(false)}>Cancel</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'peers' ? (
            <motion.div key="peers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {peers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {peers.map(peer => (
                    <PeerCard key={peer.id} peer={peer} onToggle={handleTogglePeer} onDelete={handleDeletePeer} />
                  ))}
                </div>
              ) : !loading && serverConfig?.configured ? (
                <div className="text-center py-12">
                  <Wifi className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Peers Yet</h3>
                  <p className="text-sm text-gray-500 mb-4">Create your first VPN peer to get started</p>
                  <Button onClick={() => setShowAddPeer(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Add First Peer
                  </Button>
                </div>
              ) : null}
            </motion.div>
          ) : (
            <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ConnectionLogs />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
