import React, { useState, useEffect } from 'react';
import { FolderCog, Layers, Plus, Trash2, Check, CheckCircle, RefreshCw } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const Toggle = ({ checked, onChange }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
    <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
  </label>
);

export const MediaManagementSubTab = () => {
  const [renameEpisodes, setRenameEpisodes] = useState(true);
  const [useHardlinks, setUseHardlinks] = useState(true);
  const [importExtraFiles, setImportExtraFiles] = useState(true);
  const [standardFormat, setStandardFormat] = useState('{Series Title} - S{season:00}E{episode:00}');
  const [seriesFolder, setSeriesFolder] = useState('{Series Title} ({Series Year})');
  const [seasonFolder, setSeasonFolder] = useState('Season {season:00}');
  const [minFreeSpace, setMinFreeSpace] = useState(100);
  const [recyclingBin, setRecyclingBin] = useState('');

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FolderCog className="w-5 h-5 text-violet-400" />
          Episode Naming
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Rename Episodes</p>
              <p className="text-sm text-gray-400">Rename episode files when importing</p>
            </div>
            <Toggle checked={renameEpisodes} onChange={(e) => setRenameEpisodes(e.target.checked)} />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Standard Episode Format</label>
            <Input value={standardFormat} onChange={(e) => setStandardFormat(e.target.value)} className="bg-white/5 border-white/10 font-mono text-sm" />
            <p className="text-xs text-gray-500 mt-1">Preview: Breaking Bad - S05E16</p>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Series Folder Format</label>
            <Input value={seriesFolder} onChange={(e) => setSeriesFolder(e.target.value)} className="bg-white/5 border-white/10 font-mono text-sm" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Season Folder Format</label>
            <Input value={seasonFolder} onChange={(e) => setSeasonFolder(e.target.value)} className="bg-white/5 border-white/10 font-mono text-sm" />
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Importing</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Use Hardlinks</p>
              <p className="text-sm text-gray-400">Create hardlinks instead of copying</p>
            </div>
            <Toggle checked={useHardlinks} onChange={(e) => setUseHardlinks(e.target.checked)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Import Extra Files</p>
              <p className="text-sm text-gray-400">Import subtitles, nfo files</p>
            </div>
            <Toggle checked={importExtraFiles} onChange={(e) => setImportExtraFiles(e.target.checked)} />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Minimum Free Space (MB)</label>
            <Input type="number" value={minFreeSpace} onChange={(e) => setMinFreeSpace(parseInt(e.target.value))} className="bg-white/5 border-white/10 w-32" />
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">File Management</h2>
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Recycling Bin Path (Optional)</label>
          <Input value={recyclingBin} onChange={(e) => setRecyclingBin(e.target.value)} placeholder="/path/to/recycle/bin" className="bg-white/5 border-white/10" />
          <p className="text-xs text-gray-500 mt-1">Leave empty to permanently delete files</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="bg-violet-600 hover:bg-violet-700">Save Settings</Button>
      </div>
    </div>
  );
};

const ProfileCard = ({ profile, onEdit, onDelete, onSetDefault }) => {
  // Extract enabled qualities
  const enabledQualities = (profile.qualities || [])
    .filter(q => q.enabled)
    .map(q => q.name)
    .slice(0, 5);
  
  return (
    <div className="p-4 rounded-xl bg-surface border border-white/10 hover:border-violet-500/30" data-testid={`quality-profile-${profile.id}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{profile.name}</p>
              {profile.is_default === 1 && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">Default</span>
              )}
            </div>
            <p className="text-xs text-gray-400">Cutoff: {profile.cutoff} • {profile.upgrade_allowed ? 'Upgrades enabled' : 'No upgrades'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile.is_default !== 1 && (
            <Button size="sm" variant="ghost" className="text-gray-400 hover:text-green-400" onClick={onSetDefault} title="Set as default">
              <CheckCircle className="w-4 h-4" />
            </Button>
          )}
          <Button size="sm" variant="outline" className="border-white/20" onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="ghost" className="hover:bg-red-500/20 text-red-400" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {enabledQualities.map((quality, idx) => (
          <span key={idx} className="px-2 py-1 rounded text-xs font-medium bg-white/5 text-gray-300">{quality}</span>
        ))}
        {enabledQualities.length === 0 && (
          <span className="text-xs text-gray-500">No qualities selected</span>
        )}
      </div>
    </div>
  );
};

// Quality Profile Editor Modal
const ProfileEditorModal = ({ profile, definitions, onSave, onClose }) => {
  const [name, setName] = useState(profile?.name || '');
  const [cutoff, setCutoff] = useState(profile?.cutoff || 'Bluray-1080p');
  const [upgradeAllowed, setUpgradeAllowed] = useState(profile?.upgrade_allowed !== 0);
  const [qualities, setQualities] = useState(() => {
    if (profile?.qualities && profile.qualities.length > 0) {
      return profile.qualities;
    }
    // Default: enable HD qualities
    return definitions.map(d => ({
      ...d,
      enabled: d.resolution === '1080p' || d.resolution === '720p'
    }));
  });
  const [saving, setSaving] = useState(false);

  const toggleQuality = (qualityName) => {
    setQualities(prev => prev.map(q => 
      q.name === qualityName ? { ...q, enabled: !q.enabled } : q
    ));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        cutoff,
        upgrade_allowed: upgradeAllowed,
        qualities: qualities
      });
    } finally {
      setSaving(false);
    }
  };

  const enabledQualityNames = qualities.filter(q => q.enabled).map(q => q.name);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold">{profile ? 'Edit Quality Profile' : 'New Quality Profile'}</h2>
          <p className="text-sm text-gray-400 mt-1">Configure which qualities are acceptable for downloads</p>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Name */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Profile Name *</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., HD Only, Any Quality, Ultra HD"
              className="bg-white/5 border-white/10"
              data-testid="profile-name-input"
            />
          </div>

          {/* Cutoff */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Upgrade Cutoff</label>
            <p className="text-xs text-gray-500 mb-2">Stop upgrading once this quality is reached</p>
            <select
              value={cutoff}
              onChange={e => setCutoff(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-black/50 border border-white/10 text-white [&>option]:bg-[#1a1a1a] [&>option]:text-white"
              data-testid="profile-cutoff-select"
            >
              {enabledQualityNames.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          {/* Upgrade Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
            <div>
              <p className="font-medium">Allow Upgrades</p>
              <p className="text-xs text-gray-400">Automatically upgrade to better quality when available</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={upgradeAllowed} 
                onChange={e => setUpgradeAllowed(e.target.checked)} 
                className="sr-only peer"
                data-testid="upgrade-toggle"
              />
              <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
            </label>
          </div>

          {/* Quality Selection */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Acceptable Qualities</label>
            <p className="text-xs text-gray-500 mb-3">Select which qualities can be downloaded (higher rank = better quality)</p>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {qualities.sort((a, b) => (b.rank || 0) - (a.rank || 0)).map(q => (
                <div 
                  key={q.name}
                  onClick={() => toggleQuality(q.name)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    q.enabled ? 'bg-violet-500/20 border border-violet-500/30' : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
                  data-testid={`quality-option-${q.name.replace(/\s+/g, '-')}`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                    q.enabled ? 'bg-violet-600 border-violet-500' : 'border-white/20'
                  }`}>
                    {q.enabled && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="flex-1 font-medium">{q.name}</span>
                  <span className="text-xs text-gray-400">{q.resolution}</span>
                  <span className="text-xs text-gray-500 w-16 text-right">Rank: {q.rank}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="border-white/20">Cancel</Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || saving}
            className="bg-violet-600 hover:bg-violet-700"
            data-testid="save-profile-btn"
          >
            {saving ? 'Saving...' : (profile ? 'Save Changes' : 'Create Profile')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const QualityProfilesSubTab = () => {
  const [profiles, setProfiles] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);

  const fetchProfiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/quality-profiles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setProfiles(data.profiles || []);
      setDefinitions(data.quality_definitions || []);
    } catch (error) {
      console.error('Failed to fetch quality profiles:', error);
      toast.error('Failed to load quality profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleCreate = () => {
    setEditingProfile(null);
    setShowEditor(true);
  };

  const handleEdit = (profile) => {
    setEditingProfile(profile);
    setShowEditor(true);
  };

  const handleSave = async (data) => {
    const token = localStorage.getItem('token');
    try {
      if (editingProfile) {
        // Update existing
        await fetch(`${API_URL}/api/quality-profiles/${editingProfile.id}`, {
          method: 'PUT',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        toast.success('Profile updated');
      } else {
        // Create new
        const params = new URLSearchParams({
          name: data.name,
          cutoff: data.cutoff,
          qualities: JSON.stringify(data.qualities),
          upgrade_allowed: data.upgrade_allowed.toString()
        });
        await fetch(`${API_URL}/api/quality-profiles?${params}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        toast.success('Profile created');
      }
      setShowEditor(false);
      fetchProfiles();
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast.error('Failed to save profile');
    }
  };

  const handleDelete = async (profileId) => {
    if (!window.confirm('Are you sure you want to delete this profile?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/quality-profiles/${profileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Profile deleted');
      fetchProfiles();
    } catch (error) {
      console.error('Failed to delete profile:', error);
      toast.error('Failed to delete profile');
    }
  };

  const handleSetDefault = async (profileId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/quality-profiles/${profileId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_default: true })
      });
      toast.success('Default profile updated');
      fetchProfiles();
    } catch (error) {
      console.error('Failed to set default profile:', error);
      toast.error('Failed to set default profile');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="quality-profiles-tab">
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-400" />
              Quality Profiles
            </h2>
            <p className="text-sm text-gray-400 mt-1">Define acceptable qualities for downloads (like Sonarr/Radarr)</p>
          </div>
          <Button 
            className="bg-violet-600 hover:bg-violet-700"
            onClick={handleCreate}
            data-testid="add-profile-btn"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Profile
          </Button>
        </div>
        
        {profiles.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">No quality profiles configured</p>
            <p className="text-sm text-gray-500">Create your first profile to control download quality</p>
          </div>
        ) : (
          <div className="space-y-4">
            {profiles.map(profile => (
              <ProfileCard 
                key={profile.id} 
                profile={profile} 
                onEdit={() => handleEdit(profile)} 
                onDelete={() => handleDelete(profile.id)}
                onSetDefault={() => handleSetDefault(profile.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="font-bold mb-3">How Quality Profiles Work</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>• <strong>Acceptable Qualities:</strong> Downloads will only be grabbed if they match one of the enabled qualities</li>
          <li>• <strong>Cutoff:</strong> Once a release matching the cutoff quality is downloaded, no more upgrades will be attempted</li>
          <li>• <strong>Upgrades:</strong> If enabled, lower quality downloads will be replaced when higher quality becomes available</li>
          <li>• <strong>Default Profile:</strong> Will be used for new additions unless overridden</li>
        </ul>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <ProfileEditorModal 
          profile={editingProfile}
          definitions={definitions}
          onSave={handleSave}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
};

const SeriesRow = ({ series, isSelected, onSelect }) => (
  <div onClick={onSelect} className={`p-3 border-b border-white/5 flex items-center gap-4 cursor-pointer hover:bg-white/5 ${isSelected ? 'bg-violet-500/10' : ''}`}>
    <span className="flex-1 font-medium">{series.title}</span>
    <span className={`w-24 text-sm ${series.status === 'continuing' ? 'text-green-400' : 'text-gray-400'}`}>
      {series.status === 'continuing' ? 'Continuing' : 'Ended'}
    </span>
    <span className="w-20 text-center">
      <span className={`inline-block w-3 h-3 rounded-full ${series.monitored ? 'bg-green-500' : 'bg-gray-600'}`} />
    </span>
  </div>
);

export const MassEditorSubTab = () => {
  const [selectedItems, setSelectedItems] = useState([]);
  const series1 = { id: 1, title: 'Breaking Bad', status: 'ended', monitored: true };
  const series2 = { id: 2, title: 'Game of Thrones', status: 'ended', monitored: true };
  const series3 = { id: 3, title: 'The Mandalorian', status: 'continuing', monitored: true };
  const series4 = { id: 4, title: 'Stranger Things', status: 'continuing', monitored: false };

  const toggleSelect = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Mass Editor</h2>
        <p className="text-sm text-gray-400 mb-4">Edit multiple series at once</p>
        {selectedItems.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-between">
            <span className="text-sm text-violet-300">{selectedItems.length} selected</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-white/20">Set Monitored</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700">Delete</Button>
            </div>
          </div>
        )}
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <div className="bg-white/5 p-3 border-b border-white/10 flex items-center gap-4">
            <span className="flex-1 font-medium text-sm">Title</span>
            <span className="w-24 font-medium text-sm">Status</span>
            <span className="w-20 font-medium text-sm text-center">Monitored</span>
          </div>
          <SeriesRow series={series1} isSelected={selectedItems.includes(1)} onSelect={() => toggleSelect(1)} />
          <SeriesRow series={series2} isSelected={selectedItems.includes(2)} onSelect={() => toggleSelect(2)} />
          <SeriesRow series={series3} isSelected={selectedItems.includes(3)} onSelect={() => toggleSelect(3)} />
          <SeriesRow series={series4} isSelected={selectedItems.includes(4)} onSelect={() => toggleSelect(4)} />
        </div>
      </div>
    </div>
  );
};
