import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Globe, Server, Wifi, WifiOff, Plus, X, Shield, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';

export const GelatinSettings = () => {
  const [gelatinStatus, setGelatinStatus] = useState(null);
  const [activeTunnels, setActiveTunnels] = useState([]);
  const [creatingTunnel, setCreatingTunnel] = useState(false);
  const [accessToken, setAccessToken] = useState(null);

  const fetchGelatinStatus = useCallback(async () => {
    try { const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/gelatin/status`); setGelatinStatus(res.data); } catch {}
  }, []);

  const fetchActiveTunnels = useCallback(async () => {
    try { const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/gelatin/tunnels`); setActiveTunnels(res.data || []); } catch {}
  }, []);

  useEffect(() => { fetchGelatinStatus(); fetchActiveTunnels(); }, [fetchGelatinStatus, fetchActiveTunnels]);

  const handleCreateTunnel = async () => {
    setCreatingTunnel(true);
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/gelatin/tunnel/create`);
      toast.success('Tunnel created successfully');
      setActiveTunnels(prev => [...prev, res.data]); fetchGelatinStatus();
    } catch { toast.error('Failed to create tunnel'); }
    finally { setCreatingTunnel(false); }
  };

  const handleCloseTunnel = async (tunnelId) => {
    try {
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/api/gelatin/tunnel/${tunnelId}`);
      toast.success('Tunnel closed');
      setActiveTunnels(prev => prev.filter(t => t.tunnel_id !== tunnelId)); fetchGelatinStatus();
    } catch { toast.error('Failed to close tunnel'); }
  };

  const handleGenerateAccessToken = async () => {
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/gelatin/access-token`);
      setAccessToken(res.data); toast.success('Access token generated');
    } catch { toast.error('Failed to generate token'); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6" data-testid="gelatin-settings">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Globe className="w-5 h-5 text-violet-400" /> Gelatin - External Access
      </h2>
      <p className="text-gray-400">Make WatchNexus accessible from outside your local network for watch parties and remote streaming.</p>

      {gelatinStatus && (
        <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
          <h3 className="font-medium flex items-center gap-2"><Server className="w-4 h-4 text-gray-400" /> Server Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-xs text-gray-500 mb-1">Server ID</p>
              <p className="font-mono text-sm">{gelatinStatus.server_id}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-xs text-gray-500 mb-1">Local IP</p>
              <p className="font-mono text-sm">{gelatinStatus.local_ip}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 md:col-span-2">
              <p className="text-xs text-gray-500 mb-1">LAN URL</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm text-violet-400">{gelatinStatus.lan_url}</p>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(gelatinStatus.lan_url); toast.success('Copied'); }}>Copy</Button>
              </div>
            </div>
            {gelatinStatus.external_url && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 md:col-span-2">
                <p className="text-xs text-green-400 mb-1">External URL (Active)</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm text-green-400">{gelatinStatus.external_url}</p>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(gelatinStatus.external_url); toast.success('Copied'); }}>Copy</Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {gelatinStatus.features?.map((feature) => (
              <span key={feature} className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs">{feature}</span>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2"><Wifi className="w-4 h-4 text-gray-400" /> Network Tunnels</h3>
          <Button onClick={handleCreateTunnel} disabled={creatingTunnel} className="bg-violet-600 hover:bg-violet-700">
            {creatingTunnel ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : <><Plus className="w-4 h-4 mr-2" /> Create Tunnel</>}
          </Button>
        </div>
        {activeTunnels.length > 0 ? (
          <div className="space-y-2">
            {activeTunnels.map((tunnel) => (
              <div key={tunnel.tunnel_id} className="p-3 rounded-lg bg-white/5 flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-violet-400">{tunnel.public_url}</p>
                  <p className="text-xs text-gray-500">ID: {tunnel.tunnel_id} - Created: {new Date(tunnel.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(tunnel.public_url); toast.success('URL copied'); }}>Copy</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleCloseTunnel(tunnel.tunnel_id)} className="text-red-400 hover:bg-red-500/10"><X className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <WifiOff className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No active tunnels</p><p className="text-sm">Create a tunnel to enable external access</p>
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium flex items-center gap-2"><Shield className="w-4 h-4 text-gray-400" /> Access Tokens</h3>
            <p className="text-sm text-gray-500">Generate tokens for secure guest access</p>
          </div>
          <Button onClick={handleGenerateAccessToken} variant="outline" className="border-white/10 hover:bg-white/5">
            <Plus className="w-4 h-4 mr-2" /> Generate Token
          </Button>
        </div>
        {accessToken && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-xs text-green-400 mb-2">New Access Token (copy now, won't be shown again)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 rounded bg-black/20 text-sm font-mono break-all">{accessToken.token}</code>
              <Button size="sm" onClick={() => { navigator.clipboard.writeText(accessToken.token); toast.success('Token copied'); }}>Copy</Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Permissions: {accessToken.permissions?.join(', ')} - Expires in {accessToken.expires_hours}h</p>
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <p className="text-sm text-blue-400">
          <strong>Tip:</strong> Use external access for watch parties with friends who aren't on your local network.
        </p>
      </div>
    </motion.div>
  );
};
