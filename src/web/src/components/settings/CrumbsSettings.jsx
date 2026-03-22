import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, CheckCircle, XCircle, RefreshCw, Eye, EyeOff, Trash2,
  Zap, Clock, ExternalLink, Shield, AlertTriangle, Activity
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { HelpTooltip } from '../ui/HelpTooltip';
import { BACKEND_URL } from '../../lib/config';
import axios from 'axios';

const API = `${BACKEND_URL}/api/crumbs`;

export const CrumbsSettings = () => {
  const [services, setServices] = useState([]);
  const [configured, setConfigured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [editEnabled, setEditEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});
  const [testResults, setTestResults] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [svcRes, cfgRes] = await Promise.all([
        axios.get(`${API}/services`),
        axios.get(`${API}/configured`),
      ]);
      setServices(svcRes.data || []);
      setConfigured(cfgRes.data || []);
    } catch {
      toast.error('Failed to load API management data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getConfigFor = (serviceId) =>
    configured.find(c => c.service_id === serviceId);

  const openEditor = async (service) => {
    setSelectedService(service);
    setShowSecrets({});
    try {
      const res = await axios.get(`${API}/${service.id}/fields`);
      setEditFields(res.data.fields || {});
      setEditEnabled(res.data.enabled !== false);
    } catch {
      setEditFields({});
      setEditEnabled(true);
    }
  };

  const handleSave = async () => {
    if (!selectedService) return;
    setSaving(true);
    try {
      await axios.put(`${API}/${selectedService.id}`, {
        enabled: editEnabled,
        fields: editFields,
      });
      toast.success(`${selectedService.name} configuration saved`);
      await fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (serviceId) => {
    setTesting(serviceId);
    setTestResults(prev => ({ ...prev, [serviceId]: null }));
    try {
      const res = await axios.post(`${API}/test/${serviceId}`);
      setTestResults(prev => ({ ...prev, [serviceId]: res.data }));
      if (res.data.success) toast.success(`${serviceId} connected!`);
      else toast.error(res.data.message || 'Test failed');
      await fetchData();
    } catch {
      setTestResults(prev => ({ ...prev, [serviceId]: { success: false, message: 'Request failed' } }));
      toast.error('Connection test failed');
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (serviceId) => {
    if (!window.confirm('Remove this service configuration?')) return;
    try {
      await axios.delete(`${API}/${serviceId}`);
      toast.success('Configuration removed');
      if (selectedService?.id === serviceId) setSelectedService(null);
      await fetchData();
    } catch {
      toast.error('Failed to remove');
    }
  };

  const categories = [
    { id: 'metadata', label: 'Metadata', color: 'blue' },
    { id: 'subtitles', label: 'Subtitles', color: 'amber' },
    { id: 'downloads', label: 'Downloads', color: 'emerald' },
    { id: 'gadgets', label: 'Gadgets', color: 'violet' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="crumbs-loading">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div data-testid="crumbs-settings" className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Key className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              API Management
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Crumbs</span>
              <HelpTooltip title="API Management (Crumbs)" description="Manage API keys and credentials for external services that WatchNexus integrates with. Each service requires its own API key to function. Keys are stored securely on your server." examples={["TMDB: Required for movie/TV metadata. Get a free key at themoviedb.org", "OpenSubtitles: Required for subtitle downloads. Register at opensubtitles.com", "Click a service to configure its API key"]} />
            </h2>
            <p className="text-sm text-gray-400">Manage credentials for all external services</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service List */}
        <div className="lg:col-span-2 space-y-4">
          {categories.map(cat => {
            const catServices = services.filter(s => s.category === cat.id);
            if (catServices.length === 0) return null;
            return (
              <div key={cat.id}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                  {cat.label}
                </h3>
                <div className="space-y-2">
                  {catServices.map(svc => {
                    const cfg = getConfigFor(svc.id);
                    const status = cfg?.test_status;
                    const isSelected = selectedService?.id === svc.id;

                    return (
                      <button
                        key={svc.id}
                        onClick={() => openEditor(svc)}
                        data-testid={`crumbs-service-${svc.id}`}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-amber-500/40 bg-amber-500/5'
                            : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              status === 'connected' ? 'bg-emerald-400' :
                              status === 'failed' ? 'bg-red-400' :
                              cfg ? 'bg-amber-400' : 'bg-gray-600'
                            }`} />
                            <div>
                              <span className="text-sm font-medium">{svc.name}</span>
                              <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {status === 'connected' && (
                              <span className="text-xs text-emerald-400 flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Verified
                              </span>
                            )}
                            {status === 'failed' && (
                              <span className="text-xs text-red-400 flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" /> Failed
                              </span>
                            )}
                            {!cfg && svc.fields?.length > 0 && (
                              <span className="text-xs text-gray-500">Not configured</span>
                            )}
                            {!cfg && (!svc.fields || svc.fields.length === 0) && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Shield className="w-3 h-3" /> No key needed
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Editor Panel */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {selectedService ? (
              <motion.div
                key={selectedService.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass-card rounded-xl p-5 sticky top-20 space-y-5"
                data-testid="crumbs-editor-panel"
              >
                {/* Service Title */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{selectedService.name}</h3>
                  {getConfigFor(selectedService.id) && (
                    <button
                      onClick={() => handleDelete(selectedService.id)}
                      data-testid={`crumbs-delete-${selectedService.id}`}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Enable Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-sm">Enabled</span>
                  <button
                    onClick={() => setEditEnabled(!editEnabled)}
                    data-testid="crumbs-enable-toggle"
                    className={`relative w-10 h-5 rounded-full transition-colors ${editEnabled ? 'bg-emerald-500' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${editEnabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

                {/* Fields */}
                {selectedService.fields?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedService.fields.map(field => (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
                          {field.label}
                          {field.required && <span className="text-red-400">*</span>}
                        </label>
                        <div className="relative">
                          <Input
                            type={
                              (field.type === 'password' && !showSecrets[field.key])
                                ? 'password' : 'text'
                            }
                            value={editFields[field.key] || ''}
                            onChange={e => setEditFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder={field.help || field.label}
                            data-testid={`crumbs-field-${field.key}`}
                            className="bg-white/5 border-white/10 text-sm pr-10"
                          />
                          {field.type === 'password' && (
                            <button
                              onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                            >
                              {showSecrets[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-400">
                    <Shield className="w-4 h-4" />
                    This service works without credentials
                  </div>
                )}

                {/* Test Result */}
                {testResults[selectedService.id] && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-testid={`crumbs-test-result-${selectedService.id}`}
                    className={`p-3 rounded-lg border text-xs ${
                      testResults[selectedService.id].success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {testResults[selectedService.id].success
                        ? <CheckCircle className="w-4 h-4" />
                        : <AlertTriangle className="w-4 h-4" />}
                      <span>{testResults[selectedService.id].message}</span>
                    </div>
                    {testResults[selectedService.id].latency_ms > 0 && (
                      <span className="block mt-1 text-gray-500">
                        Latency: {testResults[selectedService.id].latency_ms}ms
                      </span>
                    )}
                  </motion.div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleTest(selectedService.id)}
                    disabled={testing === selectedService.id}
                    variant="outline"
                    data-testid={`crumbs-test-${selectedService.id}`}
                    className="flex-1 border-white/10 text-xs h-9"
                  >
                    {testing === selectedService.id
                      ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      : <Zap className="w-3.5 h-3.5 mr-1.5" />}
                    Test
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    data-testid={`crumbs-save-${selectedService.id}`}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs h-9"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                    Save
                  </Button>
                </div>

                {/* Docs Link */}
                {selectedService.docs_url && (
                  <a
                    href={selectedService.docs_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`crumbs-docs-${selectedService.id}`}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-400 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View documentation
                  </a>
                )}

                {/* Usage Stats */}
                {getConfigFor(selectedService.id) && (
                  <UsageStats serviceId={selectedService.id} />
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card rounded-xl p-8 text-center text-gray-500"
              >
                <Key className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a service to configure</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const UsageStats = ({ serviceId }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get(`${API}/${serviceId}/usage`)
      .then(res => setStats(res.data))
      .catch(() => {});
  }, [serviceId]);

  if (!stats) return null;

  return (
    <div className="pt-3 border-t border-white/[0.06] space-y-2" data-testid={`crumbs-usage-${serviceId}`}>
      <h4 className="text-xs font-medium text-gray-500 flex items-center gap-1">
        <Activity className="w-3 h-3" /> Usage
      </h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-lg bg-white/[0.02]">
          <span className="text-gray-500">API Calls</span>
          <p className="font-medium">{stats.call_count || 0}</p>
        </div>
        <div className="p-2 rounded-lg bg-white/[0.02]">
          <span className="text-gray-500">Last Used</span>
          <p className="font-medium">
            {stats.last_used ? new Date(stats.last_used).toLocaleDateString() : 'Never'}
          </p>
        </div>
        {stats.test_latency_ms > 0 && (
          <div className="p-2 rounded-lg bg-white/[0.02]">
            <span className="text-gray-500">Latency</span>
            <p className="font-medium">{stats.test_latency_ms}ms</p>
          </div>
        )}
        {stats.created_at && (
          <div className="p-2 rounded-lg bg-white/[0.02]">
            <span className="text-gray-500">Added</span>
            <p className="font-medium">{new Date(stats.created_at).toLocaleDateString()}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CrumbsSettings;
