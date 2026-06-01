import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import { MessageSquare, Plus, Clock, CheckCircle, XCircle, Film, Tv, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const API = process.env.REACT_APP_BACKEND_URL || '';

const STATUS_COLORS = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  approved: 'text-blue-400 bg-blue-400/10',
  rejected: 'text-red-400 bg-red-400/10',
  fulfilled: 'text-green-400 bg-green-400/10',
};

const STATUS_ICONS = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  fulfilled: CheckCircle,
};

export const RequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newReq, setNewReq] = useState({ title: '', media_type: 'movie', description: '' });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API}/api/meringue/requests`, { headers });
      setRequests(res.data);
    } catch (e) {
      console.error('Failed to fetch requests:', e);
        toast.error('Failed to fetch requests:');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const submitRequest = async () => {
    if (!newReq.title.trim()) { toast.error('Title is required'); return; }
    try {
      await axios.post(`${API}/api/meringue/request`, newReq, { headers });
      toast.success('Request submitted');
      setShowAdd(false);
      setNewReq({ title: '', media_type: 'movie', description: '' });
      fetchRequests();
    } catch (e) {
      toast.error('Failed to submit request');
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6" data-testid="requests-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Media Requests</h1>
            <p className="text-gray-400 text-sm mt-1">Request new media for your library</p>
          </div>
          <Button onClick={() => setShowAdd(!showAdd)} data-testid="new-request-btn">
            <Plus className="w-4 h-4 mr-2" /> New Request
          </Button>
        </div>

        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="text-white font-semibold">Submit a Request</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Movie or show title"
                value={newReq.title}
                onChange={e => setNewReq({ ...newReq, title: e.target.value })}
                data-testid="request-title-input"
              />
              <select
                value={newReq.media_type}
                onChange={e => setNewReq({ ...newReq, media_type: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                data-testid="request-type-select"
              >
                <option value="movie">Movie</option>
                <option value="tv">TV Show</option>
                <option value="anime">Anime</option>
                <option value="music">Music</option>
              </select>
              <Input
                placeholder="Additional notes (optional)"
                value={newReq.description}
                onChange={e => setNewReq({ ...newReq, description: e.target.value })}
                data-testid="request-desc-input"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={submitRequest} data-testid="submit-request-btn">Submit</Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="glass-card rounded-xl p-4 h-20 animate-pulse" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No requests yet. Be the first to request something!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req, i) => {
              const StatusIcon = STATUS_ICONS[req.status] || Clock;
              return (
                <motion.div
                  key={req.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card rounded-xl p-4 flex items-center gap-4"
                  data-testid={`request-${req.id || i}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                    {req.media_type === 'tv' ? <Tv className="w-5 h-5 text-violet-400" /> : <Film className="w-5 h-5 text-violet-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{req.title}</p>
                    <p className="text-gray-500 text-xs capitalize">{req.media_type} {req.description ? `- ${req.description}` : ''}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[req.status] || STATUS_COLORS.pending}`}>
                    <StatusIcon className="w-3 h-3 inline mr-1" />
                    {req.status}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default RequestsPage;
