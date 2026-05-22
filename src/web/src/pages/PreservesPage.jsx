import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, Plus, Trash2, Loader2, Cloud, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Layout } from '../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

const API = BACKEND_URL;
const STATUS_BADGE = { in_progress: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'In Progress' }, completed: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'Completed' }, failed: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Failed' } };

const PreservesPage = () => {
  const [config, setConfig] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [cfgForm, setCfgForm] = useState({ provider: 's3', bucket: '', region: 'us-east-1', endpoint: '', access_key: '', secret_key: '' });

  const fetch_ = useCallback(async () => { try { const [c, b] = await Promise.all([axios.get(`${API}/api/preserves/config`), axios.get(`${API}/api/preserves/backups`)]); setConfig(c.data); setBackups(b.data.backups || []); if (!c.data.configured) setShowConfig(true); } catch {} finally { setLoading(false); } }, []);
  useEffect(() => { fetch_(); }, [fetch_]);

  const handleSaveConfig = async () => { try { const res = await axios.post(`${API}/api/preserves/config`, cfgForm); if (res.data.success) { toast.success(res.data.message); fetch_(); setShowConfig(false); } } catch {} };
  const handleCreateBackup = async () => { try { const res = await axios.post(`${API}/api/preserves/backups`, { type: 'full' }); if (res.data.success) { toast.success(res.data.message); fetch_(); } } catch {} };
  const handleDelete = async (id) => { if (!window.confirm('Delete backup?')) return; try { await axios.delete(`${API}/api/preserves/backups/${id}`); toast.success('Deleted'); fetch_(); } catch {} };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" data-testid="preserves-page">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold text-white flex items-center gap-3"><Cloud className="w-8 h-8 text-orange-400" /> Cloud Backup</h1><p className="text-gray-400 text-sm mt-1">{config?.configured ? `Connected to ${config.provider} (${config.bucket})` : 'Configure S3/object storage for backups'}</p></div>
          <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => setShowConfig(!showConfig)}>Configure</Button>{config?.configured && <Button size="sm" onClick={handleCreateBackup} className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-1" /> New Backup</Button>}</div>
        </div>

        <AnimatePresence>{showConfig && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-surface border border-white/10 rounded-2xl p-6 space-y-3">
            <h3 className="font-semibold text-white">Storage Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="text-xs text-gray-400 mb-1 block">Provider</label><select value={cfgForm.provider} onChange={(e) => setCfgForm(p => ({ ...p, provider: e.target.value }))} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm"><option value="s3">Amazon S3</option><option value="b2">Backblaze B2</option><option value="minio">MinIO</option><option value="wasabi">Wasabi</option><option value="r2">Cloudflare R2</option></select></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Bucket</label><input type="text" value={cfgForm.bucket} onChange={(e) => setCfgForm(p => ({ ...p, bucket: e.target.value }))} placeholder="my-backups" className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Region</label><input type="text" value={cfgForm.region} onChange={(e) => setCfgForm(p => ({ ...p, region: e.target.value }))} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Endpoint (optional)</label><input type="text" value={cfgForm.endpoint} onChange={(e) => setCfgForm(p => ({ ...p, endpoint: e.target.value }))} placeholder="https://..." className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Access Key</label><input type="password" value={cfgForm.access_key} onChange={(e) => setCfgForm(p => ({ ...p, access_key: e.target.value }))} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Secret Key</label><input type="password" value={cfgForm.secret_key} onChange={(e) => setCfgForm(p => ({ ...p, secret_key: e.target.value }))} className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600" /></div>
            </div>
            <div className="flex gap-2"><Button onClick={handleSaveConfig} className="bg-orange-600">Save & Test</Button><Button variant="ghost" onClick={() => setShowConfig(false)}>Cancel</Button></div>
          </motion.div>
        )}</AnimatePresence>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-400" /></div> : backups.length === 0 && config?.configured ? (
          <div className="text-center py-20 text-gray-500"><HardDrive className="w-16 h-16 mx-auto mb-4 opacity-20" /><p>No backups yet</p></div>
        ) : !config?.configured ? null : (
          <div className="space-y-2">{backups.map(b => { const sc = STATUS_BADGE[b.status] || STATUS_BADGE.in_progress; return (
            <div key={b.id} className="bg-surface border border-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0"><HardDrive className="w-5 h-5 text-orange-400" /></div>
              <div className="flex-1 min-w-0"><p className="text-white font-medium truncate">{b.name}</p><div className="flex items-center gap-2 mt-1"><span className={`text-[11px] px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span><span className="text-[11px] text-gray-500">{b.type}</span>{b.size > 0 && <span className="text-[11px] text-gray-500">{(b.size / 1048576).toFixed(1)} MB</span>}<span className="text-[11px] text-gray-500">{new Date(b.created_at).toLocaleString()}</span></div></div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(b.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
            </div>
          ); })}</div>
        )}
      </div>
    </Layout>
  );
};

export default PreservesPage;
