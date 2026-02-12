import { useState } from 'react';
import {
  ArrowRight, Upload, X, RefreshCw, Zap, Globe, Tv, Play,
  Shield, CheckCircle, AlertTriangle, FileArchive
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthHeader = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const PluginConverter = () => {
  const [convertFile, setConvertFile] = useState(null);
  const [convertEcosystem, setConvertEcosystem] = useState('');
  const [converting, setConverting] = useState(false);
  const [convertResult, setConvertResult] = useState(null);
  const [convertError, setConvertError] = useState(null);

  const handleConvertPlugin = async () => {
    if (!convertFile) { toast.error('Please select a ZIP file'); return; }
    setConverting(true); setConvertResult(null); setConvertError(null);
    try {
      const formData = new FormData();
      formData.append('file', convertFile);
      if (convertEcosystem) formData.append('ecosystem', convertEcosystem);
      const res = await axios.post(`${API_URL}/api/adapter/convert`, formData, {
        headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
      });
      setConvertResult(res.data); toast.success(`Plugin converted from ${res.data.ecosystem}`);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Conversion failed';
      setConvertError(detail); toast.error(detail);
    } finally { setConverting(false); }
  };

  const ecosystems = [
    { id: '', label: 'Auto-detect', icon: Zap },
    { id: 'kodi', label: 'Kodi', icon: Globe },
    { id: 'jellyfin', label: 'Jellyfin/Emby', icon: Tv },
    { id: 'plex', label: 'Plex', icon: Play },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="convert-plugin-tab">
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <ArrowRight className="w-5 h-5 text-violet-400" /> Plugin Converter
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          Convert plugins from Kodi, Jellyfin/Emby, or Plex to the WatchNexus format. Upload a plugin ZIP file and the converter will auto-detect the source ecosystem.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">Source Ecosystem (optional)</label>
          <div className="flex gap-3 flex-wrap">
            {ecosystems.map((eco) => {
              const Icon = eco.icon;
              return (
                <button key={eco.id} data-testid={`ecosystem-${eco.id || 'auto'}`} onClick={() => setConvertEcosystem(eco.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${convertEcosystem === eco.id ? 'border-violet-500 bg-violet-500/20 text-violet-300' : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'}`}>
                  <Icon className="w-4 h-4" />{eco.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Plugin ZIP File</label>
          <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${convertFile ? 'border-violet-500/50 bg-violet-500/5' : 'border-white/10 hover:border-white/20'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.zip')) setConvertFile(f); else toast.error('Only ZIP files are supported'); }}>
            {convertFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileArchive className="w-8 h-8 text-violet-400" />
                <div className="text-left">
                  <p className="font-medium text-white">{convertFile.name}</p>
                  <p className="text-sm text-gray-400">{(convertFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => { setConvertFile(null); setConvertResult(null); setConvertError(null); }} className="ml-4 p-1 rounded-full hover:bg-white/10">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400 mb-2">Drag & drop a plugin ZIP file here</p>
                <label className="inline-block cursor-pointer">
                  <span className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">Browse Files</span>
                  <input data-testid="convert-file-input" type="file" accept=".zip" className="hidden"
                    onChange={(e) => { const f = e.target.files[0]; if (f) setConvertFile(f); }} />
                </label>
              </>
            )}
          </div>
        </div>

        <Button data-testid="convert-plugin-btn" onClick={handleConvertPlugin} disabled={!convertFile || converting} className="w-full bg-violet-600 hover:bg-violet-700 h-12 text-base">
          {converting ? <><RefreshCw className="w-5 h-5 mr-2 animate-spin" />Converting...</> : <><ArrowRight className="w-5 h-5 mr-2" />Convert to WatchNexus Format</>}
        </Button>
      </div>

      {convertError && (
        <div className="glass-card rounded-xl p-4 border border-red-500/30 bg-red-500/5" data-testid="convert-error">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div><p className="font-medium text-red-400">Conversion Failed</p><p className="text-sm text-gray-400 mt-1">{convertError}</p></div>
          </div>
        </div>
      )}

      {convertResult && (
        <div className="glass-card rounded-xl p-6 border border-green-500/30 bg-green-500/5" data-testid="convert-result">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-bold text-green-400">Conversion Successful</h3>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-violet-500/20 text-violet-300">{convertResult.ecosystem}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Plugin Name', value: convertResult.manifest?.name },
              { label: 'Version', value: convertResult.manifest?.version },
              { label: 'Type', value: convertResult.manifest?.plugin_type },
              { label: 'Author', value: convertResult.manifest?.author || 'Unknown' },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-gray-500">{label}</p><p className="font-medium">{value}</p>
              </div>
            ))}
            <div className="p-3 rounded-lg bg-white/5 col-span-2">
              <p className="text-xs text-gray-500">WatchNexus ID</p>
              <p className="font-medium font-mono text-sm">{convertResult.manifest?.id}</p>
            </div>
          </div>
          {convertResult.manifest?.description && <p className="text-sm text-gray-400 mb-4">{convertResult.manifest.description}</p>}
          {convertResult.manifest?.adaptation_notes?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Adaptation Notes</p>
              <div className="space-y-1">
                {convertResult.manifest.adaptation_notes.map((note, i) => (
                  <p key={i} className="text-sm text-yellow-400/80 flex items-center gap-2"><AlertTriangle className="w-3 h-3 flex-shrink-0" /> {note}</p>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-4">Converted plugin saved at: {convertResult.output_path}</p>
        </div>
      )}

      <div className="glass-card rounded-xl p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-violet-400" /> Supported Plugin Ecosystems</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Kodi', icon: Globe, desc: 'Add-ons with addon.xml manifest. Supports video, audio, subtitle, metadata, and service plugins.', color: 'text-blue-400' },
            { name: 'Jellyfin/Emby', icon: Tv, desc: 'Plugins with meta.json. Both C# and JavaScript plugins supported with conversion notes.', color: 'text-purple-400' },
            { name: 'Plex', icon: Play, desc: 'Channel bundles with Info.plist. Python-based plugins with Framework API conversion.', color: 'text-orange-400' },
          ].map((eco) => {
            const Icon = eco.icon;
            return (
              <div key={eco.name} className="p-4 rounded-lg bg-white/5 border border-white/5">
                <Icon className={`w-8 h-8 ${eco.color} mb-3`} />
                <h4 className="font-bold text-white mb-1">{eco.name}</h4>
                <p className="text-xs text-gray-400">{eco.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
