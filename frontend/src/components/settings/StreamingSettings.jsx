import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Tv, Plus, Trash2, ExternalLink, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const STREAMING_SERVICES = [
  { id: 'netflix', name: 'Netflix', icon: 'N', color: '#E50914' },
  { id: 'disney', name: 'Disney+', icon: 'D+', color: '#113CCF' },
  { id: 'prime', name: 'Prime Video', icon: 'P', color: '#00A8E1' },
  { id: 'hbo', name: 'HBO Max', icon: 'H', color: '#B535F6' },
  { id: 'hulu', name: 'Hulu', icon: 'h', color: '#1CE783' },
  { id: 'apple', name: 'Apple TV+', icon: '', color: '#000000' },
  { id: 'peacock', name: 'Peacock', icon: 'P', color: '#FDB927' },
  { id: 'paramount', name: 'Paramount+', icon: 'P+', color: '#0064FF' },
  { id: 'crunchyroll', name: 'Crunchyroll', icon: 'CR', color: '#F47521' },
  { id: 'funimation', name: 'Funimation', icon: 'F', color: '#5B0BB5' },
  { id: 'mubi', name: 'MUBI', icon: 'M', color: '#00B4E4' },
  { id: 'criterion', name: 'Criterion Channel', icon: 'C', color: '#000000' },
];

export const StreamingSettings = () => {
  const [configuredServices, setConfiguredServices] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [serviceCredentials, setServiceCredentials] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState({});

  const fetchStreamingLogins = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/streaming-logins`);
      const transformed = (res.data || []).map(login => ({
        id: login.service_id, name: login.service_name, icon: login.icon, color: login.color,
        email: login.email, deep_link: login.deep_link, login_url: login.login_url,
      }));
      setConfiguredServices(transformed);
    } catch {
      const saved = localStorage.getItem('watchnexus_streaming_services');
      if (saved) setConfiguredServices(JSON.parse(saved));
    }
  }, []);

  useEffect(() => { fetchStreamingLogins(); }, [fetchStreamingLogins]);

  const availableServices = STREAMING_SERVICES.filter(s => !configuredServices.some(cs => cs.id === s.id));

  const handleAddStreamingService = async () => {
    if (!selectedService || !serviceCredentials.email || !serviceCredentials.password) {
      toast.error('Please select a service and enter credentials'); return;
    }
    try {
      const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/streaming-logins`, null, {
        params: { service_id: selectedService, email: serviceCredentials.email, password: serviceCredentials.password }
      });
      toast.success(`${res.data.login.service_name} added successfully`);
      setSelectedService(''); setServiceCredentials({ email: '', password: '' });
      fetchStreamingLogins();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to add service'); }
  };

  const handleDeleteStreamingService = async (serviceId) => {
    try {
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/api/streaming-logins/${serviceId}`);
      toast.success('Streaming service removed'); fetchStreamingLogins();
    } catch { toast.error('Failed to remove service'); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6" data-testid="streaming-settings">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Tv className="w-5 h-5 text-violet-400" /> Streaming Service Logins
      </h2>
      <p className="text-gray-400">Save your streaming service credentials for quick access tracking.</p>

      <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
        <h3 className="font-medium">Add Streaming Service</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white appearance-none">
              <option value="">Select Service...</option>
              {availableServices.map((service) => (
                <option key={service.id} value={service.id}>{service.icon} {service.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <Input value={serviceCredentials.email}
            onChange={(e) => setServiceCredentials(p => ({ ...p, email: e.target.value }))}
            placeholder="Email / Username" className="bg-white/5 border-white/10" />
          <div className="relative">
            <Input type={showPassword['new'] ? 'text' : 'password'} value={serviceCredentials.password}
              onChange={(e) => setServiceCredentials(p => ({ ...p, password: e.target.value }))}
              placeholder="Password" className="bg-white/5 border-white/10 pr-10" />
            <button type="button" onClick={() => setShowPassword(p => ({ ...p, new: !p.new }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
              {showPassword['new'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <Button onClick={handleAddStreamingService} disabled={!selectedService} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4 mr-2" /> Add Service
        </Button>
      </div>

      {configuredServices.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">Configured Services ({configuredServices.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {configuredServices.map((service, index) => (
              <div key={`${service.id}-${index}`} className="p-4 rounded-xl border border-white/5 flex items-center justify-between"
                style={{ backgroundColor: `${service.color}15` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                    style={{ backgroundColor: `${service.color}30` }}>{service.icon}</div>
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-xs text-gray-400">{service.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`https://${service.id === 'prime' ? 'primevideo.com' : service.id === 'disney' ? 'disneyplus.com' : service.id + '.com'}`}
                    target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </a>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteStreamingService(service.id)}
                    className="text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {configuredServices.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No streaming services configured</p><p className="text-sm">Add your subscriptions above for easy access</p>
        </div>
      )}

      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-sm text-yellow-400">
          <strong>Note:</strong> Credentials are stored locally for your convenience. WatchNexus does not share or sync this data.
        </p>
      </div>
    </motion.div>
  );
};
