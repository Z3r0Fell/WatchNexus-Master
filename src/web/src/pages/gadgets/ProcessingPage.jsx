import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import axios from 'axios';
import { BACKEND_URL } from '../../lib/config';
import { toast } from 'sonner';
import { Cog, Play, Pause, Trash2, Plus, HardDrive, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const API = BACKEND_URL;

// CrucibleController.SubmitJob reads { source_path, profile } (profile ids
// from GET /api/crucible/profiles); input_path/output_format/preset were ignored.
const PROFILES = [
  { id: 'h265-default', label: 'H.265 Default' },
  { id: 'h265-quality', label: 'H.265 High Quality' },
  { id: 'h265-compact', label: 'H.265 Compact' },
  { id: 'h264-compat', label: 'H.264 Compatible' },
  { id: 'extract-subs', label: 'Extract Subtitles' },
  { id: 'burn-subs', label: 'Burn Subtitles' },
  { id: 'audio-normalize', label: 'Normalize Audio' },
];
const EMPTY_JOB = { source_path: '', profile: 'h265-default' };

const STATUS_STYLES = {
  completed: { color: 'text-green-400', bg: 'bg-green-400/10', icon: CheckCircle },
  running: { color: 'text-blue-400', bg: 'bg-blue-400/10', icon: Play },
  processing: { color: 'text-blue-400', bg: 'bg-blue-400/10', icon: Play },
  cancelled: { color: 'text-gray-400', bg: 'bg-gray-400/10', icon: Pause },
  queued: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: Clock },
  failed: { color: 'text-red-400', bg: 'bg-red-400/10', icon: AlertCircle },
  paused: { color: 'text-gray-400', bg: 'bg-gray-400/10', icon: Pause },
};

export const ProcessingPage = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newJob, setNewJob] = useState(EMPTY_JOB);
  const headers = { 'Content-Type': 'application/json' };

  const fetchJobs = async () => {
    try {
      const res = await axios.get(`${API}/api/crucible/jobs`, { headers });
      setJobs(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Failed to fetch jobs:', e);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchJobs(); const interval = setInterval(fetchJobs, 10000); return () => clearInterval(interval); }, []);

  const submitJob = async () => {
    if (!newJob.source_path.trim()) { toast.error('Input path is required'); return; }
    try {
      await axios.post(`${API}/api/crucible/jobs`, newJob, { headers });
      toast.success('Transcode job submitted');
      setShowAdd(false);
      setNewJob(EMPTY_JOB);
      fetchJobs();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to submit job');
    }
  };

  const cancelJob = async (id) => {
    try {
      await axios.delete(`${API}/api/crucible/jobs/${id}`, { headers });
      toast.success('Job cancelled');
      fetchJobs();
    } catch (e) {
      toast.error('Failed to cancel job');
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6" data-testid="processing-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Cog className="w-7 h-7 text-violet-400" /> Media Processing
            </h1>
            <p className="text-gray-400 text-sm mt-1">Transcode and process your media files</p>
          </div>
          <Button onClick={() => setShowAdd(!showAdd)} data-testid="new-job-btn">
            <Plus className="w-4 h-4 mr-2" /> New Job
          </Button>
        </div>

        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="text-white font-semibold">Submit Transcode Job</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Input file path"
                value={newJob.source_path}
                onChange={e => setNewJob({ ...newJob, source_path: e.target.value })}
                data-testid="job-input-path"
              />
              <select
                value={newJob.profile}
                onChange={e => setNewJob({ ...newJob, profile: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white md:col-span-2"
                data-testid="job-profile-select"
              >
                {PROFILES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={submitJob} data-testid="submit-job-btn">Submit</Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
            <p className="text-gray-500 text-xs">Note: FFmpeg must be installed on the server for transcoding to work.</p>
          </motion.div>
        )}

        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="glass-card rounded-xl p-4 h-20 animate-pulse" />)}</div>
        ) : jobs.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center text-gray-500">
            <Cog className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No processing jobs. Submit a transcode job to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job, i) => {
              const style = STATUS_STYLES[job.status] || STATUS_STYLES.queued;
              const StatusIcon = style.icon;
              return (
                <motion.div
                  key={job.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card rounded-xl p-4"
                  data-testid={`job-${job.id || i}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center`}>
                        <StatusIcon className={`w-4 h-4 ${style.color}`} />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm truncate max-w-md">{job.sourcePath || job.source_path || job.input_path || job.title}</p>
                        <p className="text-gray-500 text-xs">{job.profile}{job.error ? ` - ${job.error}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${style.color} ${style.bg}`}>{job.status}</span>
                      {(job.status === 'queued' || job.status === 'running' || job.status === 'processing') && (
                        <Button variant="outline" size="sm" onClick={() => cancelJob(job.id)} data-testid={`cancel-job-${job.id || i}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {job.progress != null && job.progress > 0 && (
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all" style={{ width: `${job.progress}%` }} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProcessingPage;
