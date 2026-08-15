import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Clock, Play, Square, RefreshCw, CheckCircle, AlertCircle,
  Calendar, Trash2, Timer, Pause, Settings, History
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { BACKEND_URL } from '../lib/config';

const API = BACKEND_URL;
const headers = { 'Content-Type': 'application/json' };

const stateColors = {
  idle: 'text-gray-400',
  running: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
};

const stateIcons = {
  idle: Clock,
  running: RefreshCw,
  completed: CheckCircle,
  failed: AlertCircle,
};

const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    data-testid={`saffron-tab-${label.toLowerCase()}`}
    className={cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
      active
        ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20"
        : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
    )}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

export const SaffronPage = () => {
  const [tasks, setTasks] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tasks');
  const [runningTasks, setRunningTasks] = useState(new Set());

  const fetchData = async () => {
    try {
      const [tasksRes, historyRes] = await Promise.all([
        axios.get(`${API}/api/saffron/tasks`, { headers }),
        axios.get(`${API}/api/saffron/history?limit=20`, { headers }),
      ]);
      setTasks(tasksRes.data || []);
      setHistoryItems(historyRes.data || []);
    } catch (e) {
      console.error('Saffron fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const runTask = async (taskId) => {
    try {
      setRunningTasks(prev => new Set([...prev, taskId]));
      await axios.post(`${API}/api/saffron/tasks/${taskId}/run`, {}, {
        
      });
      toast.success(`Task "${taskId}" started`);
      setTimeout(() => {
        setRunningTasks(prev => { const n = new Set(prev); n.delete(taskId); return n; });
      }, 3000);
    } catch (e) {
      toast.error('Failed to start task');
      setRunningTasks(prev => { const n = new Set(prev); n.delete(taskId); return n; });
    }
  };

  if (loading) return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto p-6 space-y-6"
        data-testid="saffron-page"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Scheduled Tasks</h1>
            <p className="text-sm text-gray-400 mt-1">Library scans, metadata refresh, cleanup jobs</p>
          </div>
          <Button onClick={fetchData} variant="outline" className="border-white/10" data-testid="saffron-refresh-btn">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="flex gap-2">
          <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')} icon={Timer} label="Tasks" />
          <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={History} label="History" />
        </div>

        {tab === 'tasks' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {tasks.map((task, i) => {
              const isRunning = runningTasks.has(task.id);
              const StateIcon = isRunning ? RefreshCw : (stateIcons[task.state] || Clock);
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-all"
                  data-testid={`task-${task.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <StateIcon className={cn("w-5 h-5", isRunning ? "text-blue-400 animate-spin" : stateColors[task.state])} />
                        <h3 className="text-base font-semibold text-white">{task.name}</h3>
                        <span className="px-2 py-0.5 rounded-md text-xs bg-white/5 text-gray-400">{task.category}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1.5 ml-8">{task.description}</p>
                      <div className="flex items-center gap-4 mt-2 ml-8">
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {task.trigger_detail}
                        </span>
                        {task.last_execution && (
                          <span className="text-xs text-gray-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Last: {new Date(task.last_execution).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => runTask(task.id)}
                      disabled={isRunning}
                      size="sm"
                      className={cn(
                        "gap-1.5",
                        isRunning ? "bg-blue-600/20 text-blue-400" : "bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30"
                      )}
                      data-testid={`run-task-${task.id}`}
                    >
                      {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {isRunning ? 'Running' : 'Run'}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {tab === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              {historyItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No task history yet</p>
                  <p className="text-sm mt-1">Run a task to see its execution history</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-gray-300">{item.task_name || item.id}</span>
                      <span className="ml-auto text-xs text-gray-500">{item.completed_at || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
};

export default SaffronPage;
