import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { securityApi } from '../services/nexusApi';
import { toast } from 'sonner';
import {
  Shield, ShieldAlert, Key, Globe, Activity, Users, Clock,
  Trash2, Plus, RefreshCw, Eye, EyeOff, Copy, Ban,
  CheckCircle, XCircle, ChevronDown, Search, Filter
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-all"
  >
    <div className="flex items-start justify-between mb-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-2xl font-bold tracking-tight">{value}</span>
    </div>
    <p className="text-sm text-gray-400">{label}</p>
    {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
  </motion.div>
);

const TabButton = ({ active, onClick, icon: Icon, label, count }) => (
  <button
    onClick={onClick}
    data-testid={`tab-${label.toLowerCase().replace(/\s/g, '-')}`}
    className={cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
      active
        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
        : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
    )}
  >
    <Icon className="w-4 h-4" />
    {label}
    {count !== undefined && (
      <span className={cn(
        "px-1.5 py-0.5 rounded-md text-xs",
        active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-gray-500"
      )}>{count}</span>
    )}
  </button>
);

// Audit Logs Panel
const AuditPanel = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await securityApi.getAuditLogs(page, 25, filter || null);
      setLogs(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Failed to load audit logs'); }
    finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div data-testid="audit-panel">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Filter by action..."
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1); }}
            data-testid="audit-filter"
            className="pl-9 bg-white/5 border-white/10 h-9 text-sm"
          />
        </div>
        <Button size="sm" variant="ghost" onClick={load} data-testid="audit-refresh">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
        <span className="text-xs text-gray-500">{total} entries</span>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">IP Address</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <motion.tr
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="border-b border-white/[0.03] hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-md bg-white/5 text-xs font-mono">{log.action}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{log.ip_address || '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs max-w-[300px] truncate">{log.details}</td>
                <td className="px-4 py-3">
                  {log.success
                    ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                    : <XCircle className="w-4 h-4 text-red-500" />
                  }
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
              </motion.tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No audit logs found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 25 && (
        <div className="flex items-center justify-between mt-4">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-xs text-gray-500">Page {page} of {Math.ceil(total / 25)}</span>
          <Button size="sm" variant="ghost" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
};

// IP Rules Panel
const IpRulesPanel = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({ ip_address: '', is_allowed: false, description: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await securityApi.getIpRules();
      setRules(res.data || []);
    } catch { toast.error('Failed to load IP rules'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newRule.ip_address) return toast.error('IP address required');
    try {
      await securityApi.addIpRule(newRule);
      toast.success('IP rule added');
      setShowAdd(false);
      setNewRule({ ip_address: '', is_allowed: false, description: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to add rule'); }
  };

  const handleDelete = async (id) => {
    try {
      await securityApi.deleteIpRule(id);
      toast.success('Rule deleted');
      load();
    } catch { toast.error('Failed to delete rule'); }
  };

  return (
    <div data-testid="ip-rules-panel">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{rules.length} rules configured</p>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} data-testid="add-ip-rule-btn"
          className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Add Rule
        </Button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Input placeholder="IP Address (e.g. 10.0.0.1)" value={newRule.ip_address}
                onChange={e => setNewRule(p => ({ ...p, ip_address: e.target.value }))}
                data-testid="ip-address-input" className="bg-white/5 border-white/10 h-9 text-sm" />
              <Input placeholder="Description" value={newRule.description}
                onChange={e => setNewRule(p => ({ ...p, description: e.target.value }))}
                className="bg-white/5 border-white/10 h-9 text-sm" />
              <div className="flex gap-2">
                <button onClick={() => setNewRule(p => ({ ...p, is_allowed: true }))}
                  className={cn("flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    newRule.is_allowed ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-gray-400"
                  )}>Allow</button>
                <button onClick={() => setNewRule(p => ({ ...p, is_allowed: false }))}
                  className={cn("flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    !newRule.is_allowed ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/5 text-gray-400"
                  )}>Block</button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} data-testid="save-ip-rule-btn"
                className="bg-emerald-600 hover:bg-emerald-700 text-white">Save Rule</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {rules.map((rule, i) => (
          <motion.div key={rule.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-all">
            <div className="flex items-center gap-3">
              {rule.is_allowed
                ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                : <Ban className="w-4 h-4 text-red-500" />
              }
              <span className="font-mono text-sm">{rule.ip_address}</span>
              <span className={cn("px-2 py-0.5 rounded text-xs",
                rule.is_allowed ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              )}>{rule.is_allowed ? 'Allowed' : 'Blocked'}</span>
              {rule.description && <span className="text-xs text-gray-500">{rule.description}</span>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => handleDelete(rule.id)} data-testid={`delete-rule-${rule.id}`}>
              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
          </motion.div>
        ))}
        {rules.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">No IP rules configured</div>
        )}
      </div>
    </div>
  );
};

// API Keys Panel
const ApiKeysPanel = () => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState({ name: '' });
  const [revealedKey, setRevealedKey] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await securityApi.getApiKeys();
      setKeys(res.data || []);
    } catch { toast.error('Failed to load API keys'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newKey.name) return toast.error('Key name required');
    try {
      const res = await securityApi.createApiKey(newKey);
      setRevealedKey(res.data.key);
      toast.success('API key created — copy it now!');
      setShowAdd(false);
      setNewKey({ name: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to create key'); }
  };

  const handleRevoke = async (id) => {
    try {
      await securityApi.revokeApiKey(id);
      toast.success('API key revoked');
      load();
    } catch { toast.error('Failed to revoke key'); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div data-testid="api-keys-panel">
      {revealedKey && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-400 font-medium mb-2">New API Key Created — Save it now!</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-black/30 text-xs font-mono text-amber-300 break-all">{revealedKey}</code>
            <Button size="sm" variant="ghost" onClick={() => copyToClipboard(revealedKey)}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setRevealedKey(null)}>Dismiss</Button>
        </motion.div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{keys.length} keys</p>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} data-testid="create-api-key-btn"
          className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Key className="w-4 h-4 mr-1" /> Generate Key
        </Button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
            <Input placeholder="Key name (e.g. CI Pipeline)" value={newKey.name}
              onChange={e => setNewKey(p => ({ ...p, name: e.target.value }))}
              data-testid="api-key-name-input" className="bg-white/5 border-white/10 h-9 text-sm" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} data-testid="save-api-key-btn"
                className="bg-emerald-600 hover:bg-emerald-700 text-white">Generate</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {keys.map((k, i) => (
          <motion.div key={k.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition-all">
            <div className="flex items-center gap-3">
              <Key className={cn("w-4 h-4", k.is_active ? "text-emerald-500" : "text-gray-600")} />
              <div>
                <p className="text-sm font-medium">{k.name}</p>
                <p className="text-xs text-gray-500">
                  wn_{k.prefix}... | Used {k.usage_count}x
                  {k.last_used && ` | Last: ${new Date(k.last_used).toLocaleDateString()}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("px-2 py-0.5 rounded text-xs",
                k.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              )}>{k.is_active ? 'Active' : 'Revoked'}</span>
              {k.is_active && (
                <Button size="sm" variant="ghost" onClick={() => handleRevoke(k.id)} data-testid={`revoke-key-${k.id}`}>
                  <XCircle className="w-4 h-4 text-red-400" />
                </Button>
              )}
            </div>
          </motion.div>
        ))}
        {keys.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">No API keys created</div>
        )}
      </div>
    </div>
  );
};

// Sessions Panel
const SessionsPanel = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await securityApi.getSessions();
      setSessions(res.data || []);
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRevoke = async (id) => {
    try {
      await securityApi.revokeSession(id);
      toast.success('Session revoked');
      load();
    } catch { toast.error('Failed to revoke session'); }
  };

  return (
    <div data-testid="sessions-panel">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{sessions.length} active sessions</p>
        <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>
      <div className="space-y-2">
        {sessions.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Globe className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm">{s.ip_address || 'Unknown IP'}</p>
                <p className="text-xs text-gray-500 truncate max-w-[300px]">{s.user_agent || 'Unknown device'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{new Date(s.last_activity).toLocaleString()}</span>
              <Button size="sm" variant="ghost" onClick={() => handleRevoke(s.id)}>
                <XCircle className="w-4 h-4 text-red-400" />
              </Button>
            </div>
          </motion.div>
        ))}
        {sessions.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">No active sessions</div>
        )}
      </div>
    </div>
  );
};

export default function SecurityPage() {
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('audit');

  useEffect(() => {
    securityApi.getStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const tabs = [
    { id: 'audit', label: 'Audit Log', icon: Activity, count: stats?.total_audit_entries },
    { id: 'ip-rules', label: 'IP Rules', icon: Globe, count: stats?.blocked_ips },
    { id: 'api-keys', label: 'API Keys', icon: Key, count: stats?.active_api_keys },
    { id: 'sessions', label: 'Sessions', icon: Users, count: stats?.active_sessions },
  ];

  return (
    <Layout>
      <div data-testid="security-dashboard" className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Security — Bastion</h1>
              <p className="text-sm text-gray-500">Audit logs, access control, API keys & session management</p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={ShieldAlert} label="Failed Logins (24h)" value={stats.failed_logins_24h}
              color="bg-red-500/15 text-red-400" />
            <StatCard icon={CheckCircle} label="Successful Logins (24h)" value={stats.successful_logins_24h}
              color="bg-emerald-500/15 text-emerald-400" />
            <StatCard icon={Ban} label="Blocked IPs" value={stats.blocked_ips}
              color="bg-amber-500/15 text-amber-400" />
            <StatCard icon={Key} label="Active API Keys" value={stats.active_api_keys}
              color="bg-blue-500/15 text-blue-400" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <TabButton key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)}
              icon={t.icon} label={t.label} count={t.count} />
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {activeTab === 'audit' && <AuditPanel />}
            {activeTab === 'ip-rules' && <IpRulesPanel />}
            {activeTab === 'api-keys' && <ApiKeysPanel />}
            {activeTab === 'sessions' && <SessionsPanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </Layout>
  );
}
