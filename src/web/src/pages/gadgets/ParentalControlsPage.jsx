import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import { Shield, Plus, Trash2, Save, Lock, UserCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const API = process.env.REACT_APP_BACKEND_URL || '';

const RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];

export const ParentalControlsPage = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [maxRating, setMaxRating] = useState('PG-13');
  const [blockedGenres, setBlockedGenres] = useState('');
  const headers = { 'Content-Type': 'application/json' };

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API}/api/rind/profile`, { headers });
      setProfile(res.data);
      if (res.data.max_rating) setMaxRating(res.data.max_rating);
      if (res.data.pin) setPin(res.data.pin);
      if (res.data.blocked_genres) setBlockedGenres(Array.isArray(res.data.blocked_genres) ? res.data.blocked_genres.join(', ') : res.data.blocked_genres);
    } catch (e) {
      console.error('Failed to fetch parental profile:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const saveProfile = async () => {
    try {
      await axios.put(`${API}/api/rind/profile`, {
        pin,
        max_rating: maxRating,
        blocked_genres: blockedGenres.split(',').map(g => g.trim()).filter(Boolean),
        enabled: true,
      }, { headers });
      toast.success('Parental controls saved');
      fetchProfile();
    } catch (e) {
      toast.error('Failed to save');
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6" data-testid="parental-controls-page">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-violet-400" /> Parental Controls
          </h1>
          <p className="text-gray-400 text-sm mt-1">Manage content restrictions and access controls</p>
        </div>

        {loading ? (
          <div className="glass-card rounded-xl p-6 h-48 animate-pulse" />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">PIN Code</label>
                <Input
                  type="password"
                  placeholder="Enter 4-digit PIN"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  className="max-w-xs"
                  data-testid="parental-pin-input"
                />
                <p className="text-gray-500 text-xs mt-1">Required to access restricted content</p>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Maximum Rating</label>
                <select
                  value={maxRating}
                  onChange={e => setMaxRating(e.target.value)}
                  className="w-full max-w-xs px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                  data-testid="max-rating-select"
                >
                  {RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <p className="text-gray-500 text-xs mt-1">Content above this rating will be hidden</p>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Blocked Genres</label>
                <Input
                  placeholder="Horror, Gore, Violence (comma separated)"
                  value={blockedGenres}
                  onChange={e => setBlockedGenres(e.target.value)}
                  data-testid="blocked-genres-input"
                />
                <p className="text-gray-500 text-xs mt-1">Content in these genres will be hidden</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-white/10">
              <Button onClick={saveProfile} data-testid="save-parental-btn">
                <Save className="w-4 h-4 mr-2" /> Save Settings
              </Button>
              <p className="text-gray-500 text-xs">
                {profile?.enabled ? 'Controls are active' : 'Controls are inactive'}
              </p>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-yellow-400" /> Access Log
          </h2>
          <p className="text-gray-500 text-sm">No restricted content access attempts recorded.</p>
        </motion.div>
      </div>
    </Layout>
  );
};

export default ParentalControlsPage;
