import { BACKEND_URL } from '../../lib/config';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Tv, Plus, Trash2, ExternalLink, Eye, EyeOff, ChevronDown, Play, Link, Settings } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';

const STREAMING_SERVICES = [
  { id: 'netflix', name: 'Netflix', color: '#E50914' },
  { id: 'disney', name: 'Disney+', color: '#113CCF' },
  { id: 'prime', name: 'Prime Video', color: '#00A8E1' },
  { id: 'hbo', name: 'HBO Max', color: '#B535F6' },
  { id: 'hulu', name: 'Hulu', color: '#1CE783' },
  { id: 'apple', name: 'Apple TV+', color: '#555555' },
  { id: 'peacock', name: 'Peacock', color: '#000000' },
  { id: 'paramount', name: 'Paramount+', color: '#0064FF' },
  { id: 'crunchyroll', name: 'Crunchyroll', color: '#F47521' },
  { id: 'funimation', name: 'Funimation', color: '#5B0BB5' },
  { id: 'mubi', name: 'MUBI', color: '#00B4E4' },
  { id: 'criterion', name: 'Criterion Channel', color: '#333333' },
];

// Tabs for Streaming Settings
const STREAMING_TABS = [
  { id: 'logins', label: 'Service Logins', icon: Tv },
  { id: 'linking', label: 'Deep Links', icon: Link },
  { id: 'tracking', label: 'Watch Tracking', icon: Settings },
];

export const StreamingSettings = () => {
  const [activeTab, setActiveTab] = useState('logins');
  const [configuredServices, setConfiguredServices] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [serviceCredentials, setServiceCredentials] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState({});

  const fetchStreamingLogins = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/streaming-logins`);
      const transformed = (res.data || []).map(login => ({
        id: login.service_id, name: login.service_name, color: login.color,
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
      const res = await axios.post(`${BACKEND_URL}/api/streaming-logins`, null, {
        params: { service_id: selectedService, email: serviceCredentials.email, password: serviceCredentials.password }
      });
      toast.success(`${res.data.login.service_name} added successfully`);
      setSelectedService(''); setServiceCredentials({ email: '', password: '' });
      fetchStreamingLogins();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to add service'); }
  };

  const handleDeleteStreamingService = async (serviceId) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/streaming-logins/${serviceId}`);
      toast.success('Streaming service removed'); fetchStreamingLogins();
    } catch { toast.error('Failed to remove service'); }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'logins':
        return (
          <LoginsTab
            configuredServices={configuredServices}
            availableServices={availableServices}
            selectedService={selectedService}
            setSelectedService={setSelectedService}
            serviceCredentials={serviceCredentials}
            setServiceCredentials={setServiceCredentials}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            handleAddStreamingService={handleAddStreamingService}
            handleDeleteStreamingService={handleDeleteStreamingService}
          />
        );
      case 'linking':
        return <DeepLinksTab configuredServices={configuredServices} />;
      case 'tracking':
        return <TrackingTab />;
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="streaming-settings">
      <SettingsTabHeader
        title="Streaming Services"
        subtitle="Manage streaming service credentials and integrations"
        icon={Tv}
        tabs={STREAMING_TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        iconBgColor="from-blue-600 to-indigo-500"
        version="Cream"
        help={{ title: "Streaming Services", description: "Store login credentials for your streaming service subscriptions (Netflix, Disney+, etc.). These are used for tracking availability and can be shared with household members through WatchNexus.", examples: ["Add your Netflix, Hulu, or Disney+ credentials", "Credentials are stored encrypted on your server", "Share access with other WatchNexus users in your household"] }}
      />

      <SettingsTabContent activeTab={activeTab}>
        {renderTabContent()}
      </SettingsTabContent>
    </motion.div>
  );
};

// Logins Tab
const LoginsTab = ({ 
  configuredServices, availableServices, selectedService, setSelectedService,
  serviceCredentials, setServiceCredentials, showPassword, setShowPassword,
  handleAddStreamingService, handleDeleteStreamingService
}) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Plus className="w-5 h-5 text-green-400" />
        Add Streaming Service
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-black/50 border border-white/10 text-white appearance-none h-10 [&>option]:bg-[#1a1a1a] [&>option]:text-white">
            <option value="">Select Service...</option>
            {availableServices.map((service) => (
              <option key={service.id} value={service.id}>{service.name}</option>
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

    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4">Configured Services ({configuredServices.length})</h3>
      {configuredServices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {configuredServices.map((service, index) => (
            <div key={`${service.id}-${index}`} className="p-4 rounded-xl border border-white/5 flex items-center justify-between"
              style={{ backgroundColor: `${service.color}15` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${service.color}30` }}>
                  <Play className="w-5 h-5 fill-current" style={{ color: service.color }} />
                </div>
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
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No streaming services configured</p>
          <p className="text-sm">Add your subscriptions above for easy access</p>
        </div>
      )}
    </div>

    <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
      <p className="text-sm text-yellow-400">
        <strong>Note:</strong> Credentials are stored locally for your convenience. WatchNexus does not share or sync this data.
      </p>
    </div>
  </div>
);

// Deep Links Tab
const DeepLinksTab = ({ configuredServices }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Link className="w-5 h-5 text-cyan-400" />
        Deep Link Integration
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        WatchNexus can deep-link to streaming apps on your devices for one-click playback.
      </p>
      
      {configuredServices.length > 0 ? (
        <div className="space-y-3">
          {configuredServices.map((service) => (
            <div key={service.id} className="p-4 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: service.color }}>
                  <Play className="w-4 h-4 text-white fill-white" />
                </div>
                <span className="font-medium">{service.name}</span>
              </div>
              <code className="text-xs text-gray-400 font-mono">
                {service.id}://
              </code>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-black/30 border border-dashed border-white/10 text-center">
          <Link className="w-10 h-10 mx-auto mb-2 text-gray-500" />
          <p className="text-gray-400">Add streaming services to see deep links</p>
        </div>
      )}
    </div>
  </div>
);

// Tracking Tab
const TrackingTab = () => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-amber-400" />
        Watch History Tracking
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        Track what you watch across streaming services to keep your WatchNexus library in sync.
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Auto-sync with Trakt</p>
            <p className="text-xs text-gray-500">Automatically sync watch history with Trakt.tv</p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">Coming Soon</span>
        </div>
        
        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
          <div>
            <p className="font-medium">Mark as Watched Across Services</p>
            <p className="text-xs text-gray-500">When you finish on Netflix, mark it in WatchNexus</p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">Coming Soon</span>
        </div>
      </div>
    </div>
  </div>
);

export default StreamingSettings;
