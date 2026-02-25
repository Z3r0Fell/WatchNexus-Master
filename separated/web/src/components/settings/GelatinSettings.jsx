import { BACKEND_URL } from '../../lib/config';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Globe, Server, Wifi, WifiOff, Plus, X, Shield, RefreshCw, Users, Key } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';

// Tabs for Gelatin (External Access) Settings
const GELATIN_TABS = [
  { id: 'status', label: 'Server Status', icon: Server },
  { id: 'tunnels', label: 'Network Tunnels', icon: Wifi },
  { id: 'tokens', label: 'Access Tokens', icon: Key },
];

export const GelatinSettings = () => {
  const [activeTab, setActiveTab] = useState('status');
  const [gelatinStatus, setGelatinStatus] = useState(null);
  const [activeTunnels, setActiveTunnels] = useState([]);
  const [creatingTunnel, setCreatingTunnel] = useState(false);
  const [accessToken, setAccessToken] = useState(null);

  const fetchGelatinStatus = useCallback(async () => {
    try { const res = await axios.get(`${BACKEND_URL}/api/gelatin/status`); setGelatinStatus(res.data); } catch {}
  }, []);

  const fetchActiveTunnels = useCallback(async () => {
    try { const res = await axios.get(`${BACKEND_URL}/api/gelatin/tunnels`); setActiveTunnels(res.data || []); } catch {}
  }, []);

  useEffect(() => { fetchGelatinStatus(); fetchActiveTunnels(); }, [fetchGelatinStatus, fetchActiveTunnels]);

  const handleCreateTunnel = async () => {
    setCreatingTunnel(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/gelatin/tunnel/create`);
      toast.success('Tunnel created successfully');
      setActiveTunnels(prev => [...prev, res.data]); fetchGelatinStatus();
    } catch { toast.error('Failed to create tunnel'); }
    finally { setCreatingTunnel(false); }
  };

  const handleCloseTunnel = async (tunnelId) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/gelatin/tunnel/${tunnelId}`);
      toast.success('Tunnel closed');
      setActiveTunnels(prev => prev.filter(t => t.tunnel_id !== tunnelId)); fetchGelatinStatus();
    } catch { toast.error('Failed to close tunnel'); }
  };

  const handleGenerateAccessToken = async () => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/gelatin/access-token`);
      setAccessToken(res.data); toast.success('Access token generated');
    } catch { toast.error('Failed to generate token'); }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'status':
        return <StatusTab gelatinStatus={gelatinStatus} />;
      case 'tunnels':
        return (
          <TunnelsTab 
            activeTunnels={activeTunnels}
            creatingTunnel={creatingTunnel}
            handleCreateTunnel={handleCreateTunnel}
            handleCloseTunnel={handleCloseTunnel}
          />
        );
      case 'tokens':
        return (
          <TokensTab 
            accessToken={accessToken}
            handleGenerateAccessToken={handleGenerateAccessToken}
          />
        );
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="gelatin-settings">
      <SettingsTabHeader
        title="Gelatin - External Access"
        subtitle="Make WatchNexus accessible from outside your network"
        icon={Globe}
        tabs={GELATIN_TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        iconBgColor="from-cyan-600 to-teal-500"
      />

      <SettingsTabContent activeTab={activeTab}>
        {renderTabContent()}
      </SettingsTabContent>
    </motion.div>
  );
};

// Status Tab
const StatusTab = ({ gelatinStatus }) => (
  <div className="space-y-6">
    {gelatinStatus ? (
      <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Server className="w-5 h-5 text-green-400" />
          Server Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-black/30 border border-white/10">
            <p className="text-xs text-gray-500 mb-1">Server ID</p>
            <p className="font-mono text-sm">{gelatinStatus.server_id}</p>
          </div>
          <div className="p-4 rounded-lg bg-black/30 border border-white/10">
            <p className="text-xs text-gray-500 mb-1">Local IP</p>
            <p className="font-mono text-sm">{gelatinStatus.local_ip}</p>
          </div>
          <div className="p-4 rounded-lg bg-black/30 border border-white/10 md:col-span-2">
            <p className="text-xs text-gray-500 mb-1">LAN URL</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm text-violet-400">{gelatinStatus.lan_url}</p>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(gelatinStatus.lan_url); toast.success('Copied'); }}>Copy</Button>
            </div>
          </div>
          {gelatinStatus.external_url && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 md:col-span-2">
              <p className="text-xs text-green-400 mb-1">External URL (Active)</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm text-green-400">{gelatinStatus.external_url}</p>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(gelatinStatus.external_url); toast.success('Copied'); }}>Copy</Button>
              </div>
            </div>
          )}
        </div>
        
        {gelatinStatus.features?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {gelatinStatus.features.map((feature) => (
              <span key={feature} className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs">{feature}</span>
            ))}
          </div>
        )}
      </div>
    ) : (
      <div className="bg-surface border border-white/10 rounded-2xl p-8 text-center">
        <Server className="w-12 h-12 mx-auto mb-3 text-gray-500" />
        <p className="text-gray-400">Unable to fetch server status</p>
      </div>
    )}
  </div>
);

// Tunnels Tab
const TunnelsTab = ({ activeTunnels, creatingTunnel, handleCreateTunnel, handleCloseTunnel }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Wifi className="w-5 h-5 text-cyan-400" />
          Network Tunnels
        </h3>
        <Button onClick={handleCreateTunnel} disabled={creatingTunnel} className="bg-violet-600 hover:bg-violet-700">
          {creatingTunnel ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : <><Plus className="w-4 h-4 mr-2" /> Create Tunnel</>}
        </Button>
      </div>
      
      {activeTunnels.length > 0 ? (
        <div className="space-y-3">
          {activeTunnels.map((tunnel) => (
            <div key={tunnel.tunnel_id} className="p-4 rounded-lg bg-black/30 border border-white/10 flex items-center justify-between">
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
        <div className="text-center py-8 text-gray-500">
          <WifiOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No active tunnels</p>
          <p className="text-sm">Create a tunnel to enable external access</p>
        </div>
      )}
    </div>

    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
      <p className="text-sm text-blue-400">
        <strong>Tip:</strong> Use tunnels for temporary external access. They expire after 24 hours for security.
      </p>
    </div>
  </div>
);

// Tokens Tab
const TokensTab = ({ accessToken, handleGenerateAccessToken }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            Access Tokens
          </h3>
          <p className="text-sm text-gray-500">Generate tokens for secure guest access</p>
        </div>
        <Button onClick={handleGenerateAccessToken} variant="outline" className="border-white/10 hover:bg-white/5">
          <Plus className="w-4 h-4 mr-2" /> Generate Token
        </Button>
      </div>
      
      {accessToken ? (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-xs text-green-400 mb-2">New Access Token (copy now, won't be shown again)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 rounded bg-black/20 text-sm font-mono break-all">{accessToken.token}</code>
            <Button size="sm" onClick={() => { navigator.clipboard.writeText(accessToken.token); toast.success('Token copied'); }}>Copy</Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Permissions: {accessToken.permissions?.join(', ')} - Expires in {accessToken.expires_hours}h</p>
        </div>
      ) : (
        <div className="p-8 rounded-lg bg-black/30 border border-dashed border-white/10 text-center">
          <Key className="w-12 h-12 mx-auto mb-3 text-gray-500" />
          <p className="text-gray-400">No tokens generated yet</p>
          <p className="text-sm text-gray-500">Generate a token for guests to access your server</p>
        </div>
      )}
    </div>

    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-violet-400" />
        Guest Access Settings
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Allow Guest Streaming</p>
            <p className="text-xs text-gray-500">Guests can stream media with valid token</p>
          </div>
          <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-white/10" />
        </div>
        
        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Allow Guest Downloads</p>
            <p className="text-xs text-gray-500">Guests can download media files</p>
          </div>
          <input type="checkbox" className="w-4 h-4 rounded bg-white/10" />
        </div>
      </div>
    </div>
  </div>
);

export default GelatinSettings;
