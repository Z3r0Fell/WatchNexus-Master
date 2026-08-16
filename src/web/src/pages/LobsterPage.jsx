import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { lobsterApi } from '../services/nexusApi';
import { toast } from 'sonner';
import {
  Wifi, WifiOff, RefreshCw, Users, Copy, Check,
  Shield, Activity, Globe, Power, PowerOff, QrCode
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color || 'bg-violet-500/20 text-violet-400'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-2xl font-bold tracking-tight">{value}</span>
    </div>
    <p className="text-sm text-gray-400">{label}</p>
    {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
  </motion.div>
);

export default function LobsterPage() {
  const [status, setStatus] = useState(null);
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pairCode, setPairCode] = useState(null);
  const [pairing, setPairing] = useState(false);

  const fetchStatus = async () => {
    try {
      const [statusRes, peersRes] = await Promise.all([
        lobsterApi.getStatus(),
        lobsterApi.getPeers(),
      ]);
      setStatus(statusRes.data);
      setPeers(peersRes.data || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async () => {
    try {
      if (status?.online) {
        await lobsterApi.stop();
        toast.success('Mesh node stopped');
      } else {
        await lobsterApi.start();
        toast.success('Mesh node started');
      }
      setTimeout(fetchStatus, 1000);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    }
  };

  const handlePair = async () => {
    setPairing(true);
    try {
      const res = await lobsterApi.pair();
      setPairCode(res.data.pair_code);
      toast.success('Pair code generated');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Pairing failed');
    } finally {
      setPairing(false);
    }
  };

  const copyPairCode = () => {
    if (pairCode) {
      navigator.clipboard.writeText(pairCode);
      toast.success('Pair code copied');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Shield className="w-8 h-8 text-violet-400" />
              Lobster Mesh
            </h1>
            <p className="text-gray-400 mt-1">
              Tailscale-based P2P networking. Encrypted tunnels, NAT traversal, and relay fallback.
            </p>
          </div>
          <Button
            onClick={handleToggle}
            className={status?.online ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-700'}
          >
            {status?.online ? (
              <><PowerOff className="w-4 h-4 mr-2" /> Stop Node</>
            ) : (
              <><Power className="w-4 h-4 mr-2" /> Start Node</>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={status?.online ? Wifi : WifiOff}
            label="Node Status"
            value={status?.online ? 'Online' : 'Offline'}
            sub={status?.hostname || 'Not running'}
            color={status?.online ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}
          />
          <StatCard
            icon={Globe}
            label="Tailnet IP"
            value={status?.tailnet_ip || '—'}
            sub={status?.status || 'disconnected'}
            color="bg-blue-500/20 text-blue-400"
          />
          <StatCard
            icon={Users}
            label="Peers"
            value={peers.length}
            sub={`${peers.filter(p => p.online).length} online`}
            color="bg-amber-500/20 text-amber-400"
          />
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-violet-400" />
              Pairing
            </h2>
            <Button onClick={handlePair} disabled={pairing} variant="outline">
              {pairing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : 'Generate Pair Code'}
            </Button>
          </div>

          {pairCode && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-sm text-gray-400 mb-2">Share this code with the device you want to pair:</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 text-center text-2xl font-mono font-bold text-violet-300 tracking-widest bg-white/5 rounded-lg py-3">
                  {pairCode}
                </code>
                <Button size="icon" variant="ghost" onClick={copyPairCode}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-600 mt-2">Expires in 5 minutes</p>
            </motion.div>
          )}

          {!pairCode && (
            <p className="text-sm text-gray-500">
              Generate a pair code to connect another device to this mesh. The other device will need the WatchNexus app installed.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-violet-400" />
            Connected Peers
          </h2>
          {peers.length === 0 ? (
            <p className="text-sm text-gray-500">No peers connected yet. Start the node and pair a device to see it here.</p>
          ) : (
            <div className="space-y-2">
              {peers.map((peer, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${peer.online ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <div>
                      <p className="font-medium text-white text-sm">{peer.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{peer.tailnet_ip}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${peer.online ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                    {peer.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
