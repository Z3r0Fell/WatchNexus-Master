import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import { Bell, Plus, Trash2, Settings, Send, CheckCircle, AlertTriangle, Mail, MessageSquare, Webhook } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const API = process.env.REACT_APP_BACKEND_URL || '';

const CHANNEL_ICONS = {
  email: Mail,
  discord: MessageSquare,
  webhook: Webhook,
  pushover: Bell,
};

export const NotificationsPage = () => {
  const [channels, setChannels] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: '', type: 'webhook', config: '{}' });
  const headers = { 'Content-Type': 'application/json' };

  const fetchData = async () => {
    try {
      const [channelsRes, historyRes] = await Promise.all([
        axios.get(`${API}/api/pepper/channels`, { headers }),
        axios.get(`${API}/api/pepper/history?limit=20`, { headers }),
      ]);
      setChannels(channelsRes.data);
      setHistory(historyRes.data);
    } catch (e) {
      console.error('Notifications fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const addChannel = async () => {
    try {
      await axios.post(`${API}/api/pepper/channels`, newChannel, { headers });
      toast.success('Channel added');
      setShowAdd(false);
      setNewChannel({ name: '', type: 'webhook', config: '{}' });
      fetchData();
    } catch (e) {
      toast.error('Failed to add channel');
    }
  };

  const deleteChannel = async (id) => {
    try {
      await axios.delete(`${API}/api/pepper/channels/${id}`, { headers });
      toast.success('Channel removed');
      fetchData();
    } catch (e) {
      toast.error('Failed to remove channel');
    }
  };

  const testChannel = async (id) => {
    try {
      await axios.post(`${API}/api/pepper/test/${id}`, {}, { headers });
      toast.success('Test notification sent');
    } catch (e) {
      toast.error('Test failed');
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6" data-testid="notifications-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Notification Hub</h1>
            <p className="text-gray-400 text-sm mt-1">Manage notification channels and view history</p>
          </div>
          <Button onClick={() => setShowAdd(!showAdd)} data-testid="add-channel-btn">
            <Plus className="w-4 h-4 mr-2" /> Add Channel
          </Button>
        </div>

        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="text-white font-semibold">New Notification Channel</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Channel name"
                value={newChannel.name}
                onChange={e => setNewChannel({ ...newChannel, name: e.target.value })}
                data-testid="channel-name-input"
              />
              <select
                value={newChannel.type}
                onChange={e => setNewChannel({ ...newChannel, type: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                data-testid="channel-type-select"
              >
                <option value="webhook">Webhook</option>
                <option value="email">Email</option>
                <option value="discord">Discord</option>
                <option value="pushover">Pushover</option>
              </select>
              <Input
                placeholder='Config JSON (e.g., {"url":"..."})'
                value={newChannel.config}
                onChange={e => setNewChannel({ ...newChannel, config: e.target.value })}
                data-testid="channel-config-input"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={addChannel} data-testid="save-channel-btn">Save</Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </motion.div>
        )}

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Channels</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="glass-card rounded-xl p-4 h-16 animate-pulse" />)}
            </div>
          ) : channels.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No notification channels configured</p>
            </div>
          ) : (
            channels.map((ch, i) => {
              const Icon = CHANNEL_ICONS[ch.type] || Bell;
              return (
                <motion.div
                  key={ch.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card rounded-xl p-4 flex items-center justify-between"
                  data-testid={`channel-${ch.id || i}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{ch.name}</p>
                      <p className="text-gray-500 text-xs capitalize">{ch.type} {ch.enabled === false ? '(disabled)' : ''}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => testChannel(ch.id)} data-testid={`test-channel-${ch.id || i}`}>
                      <Send className="w-3 h-3 mr-1" /> Test
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteChannel(ch.id)} className="text-red-400 hover:text-red-300" data-testid={`delete-channel-${ch.id || i}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Recent Notifications</h2>
          {history.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No notifications sent yet</p>
          ) : (
            <div className="space-y-2">
              {history.map((item, i) => (
                <div key={i} className="glass-card rounded-lg p-3 flex items-center gap-3">
                  {item.status === 'sent' ? (
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{item.title || item.event_type}</p>
                    <p className="text-gray-500 text-xs">{new Date(item.sent_at || item.timestamp).toLocaleString()}</p>
                  </div>
                  <span className="text-xs text-gray-400">{item.channel_type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default NotificationsPage;
