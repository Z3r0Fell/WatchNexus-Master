import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Download, Server, Plus, Trash2, RefreshCw, CheckCircle,
  AlertCircle, Settings, Wifi, WifiOff, ArrowDown, HardDrive, Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL || '';

const clientTypeIcons = {
  torrent: Download,
  usenet: HardDrive,
};

const clientTypeColors = {
  torrent: 'bg-blue-500/20 text-blue-400',
  usenet: 'bg-purple-500/20 text-purple-400',
};

export const ChurroPage = () => {
  const [clients, setClients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingClient, setTestingClient] = useState(null);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [clientsRes, catsRes] = await Promise.all([
        axios.get(`${API}/api/churro/clients`, { headers }),
        axios.get(`${API}/api/churro/categories`, { headers }),
      ]);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      setCategories(Array.isArray(catsRes.data) ? catsRes.data : []);
    } catch (e) {
      console.error('Churro fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const testClient = async (clientId) => {
    setTestingClient(clientId);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/api/churro/clients/${clientId}/test`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Connection successful (${res.data?.response_time_ms || 0}ms)`);
    } catch (e) {
      toast.error('Connection test failed');
    } finally {
      setTestingClient(null);
    }
  };

  const removeClient = async (clientId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/api/churro/clients/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(prev => prev.filter(c => c.id !== clientId));
      toast.success('Client removed');
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  if (loading) return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto p-6 space-y-6"
        data-testid="churro-page"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Download Clients</h1>
            <p className="text-sm text-gray-400 mt-1">Manage torrent and usenet download clients</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchData} variant="outline" className="border-white/10" data-testid="churro-refresh-btn">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" data-testid="churro-add-btn">
              <Plus className="w-4 h-4 mr-2" /> Add Client
            </Button>
          </div>
        </div>

        {/* Clients list */}
        <div className="space-y-4">
          {clients.length === 0 ? (
            <div className="p-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
              <Server className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-lg text-gray-400">No download clients configured</p>
              <p className="text-sm text-gray-600 mt-1">Add a torrent or usenet client to get started</p>
            </div>
          ) : (
            clients.map((client, i) => {
              const Icon = clientTypeIcons[client.type] || Download;
              const colorClass = clientTypeColors[client.type] || 'bg-gray-500/20 text-gray-400';
              const isTesting = testingClient === client.id;
              return (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-all"
                  data-testid={`churro-client-${client.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", colorClass)}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-white">{client.name}</h3>
                        <span className="px-2 py-0.5 rounded-md text-xs bg-white/5 text-gray-400">{client.client}</span>
                        {client.enabled ? (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <Wifi className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <WifiOff className="w-3 h-3" /> Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {client.host}:{client.port} | Priority: {client.priority}
                      </p>
                      {client.categories && (
                        <div className="flex gap-1.5 mt-2">
                          {client.categories.map(cat => (
                            <span key={cat} className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-400">{cat}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => testClient(client.id)}
                        disabled={isTesting}
                        className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                        data-testid={`test-client-${client.id}`}
                      >
                        {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        <span className="ml-1.5">{isTesting ? 'Testing' : 'Test'}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeClient(client.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <h3 className="text-lg font-semibold text-white mb-4">Download Categories</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {categories.map((cat, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                  <p className="text-sm font-medium text-white capitalize">{cat.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{cat.path}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
};

export default ChurroPage;
