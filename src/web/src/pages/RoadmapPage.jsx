import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Clock, Search } from 'lucide-react';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

export const RoadmapPage = () => {
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/system/roadmap`).then(r => { setEndpoints(r.data.endpoints || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = endpoints.filter(ep => ep.endpoint.toLowerCase().includes(search.toLowerCase()) || ep.message.toLowerCase().includes(search.toLowerCase()));

  return (
    <Layout title="Roadmap">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Clock className="w-8 h-8" /> Coming Soon</h1>
            <p className="text-muted-foreground mt-1">Endpoints planned for future releases. Currently returns 501 Not Implemented.</p>
          </div>
          <Badge variant="secondary" className="text-sm">{endpoints.length} planned</Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search endpoints..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {loading ? <div className="text-center py-12 text-muted-foreground">Loading roadmap...</div> : (
          <div className="space-y-3">
            {filtered.map((ep, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{ep.endpoint}</code>
                    <p className="text-sm text-muted-foreground mt-2">{ep.message}</p>
                  </div>
                  <Badge variant={ep.tier === 'ultra' ? 'default' : 'secondary'} className="shrink-0">{ep.tier}</Badge>
                </div>
              </motion.div>
            ))}
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No endpoints match your search.</p>}
          </div>
        )}
      </div>
    </Layout>
  );
};
