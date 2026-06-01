import { BACKEND_URL } from '../../lib/config';
import { useState, useEffect, useCallback } from 'react';
import { motion, Reorder } from 'framer-motion';
import { 
  Gauge, Plus, Trash2, Star, Check, GripVertical, 
  Film, Tv, Save, RefreshCw, Settings, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import { HelpTooltip } from '../ui/HelpTooltip';

// Quality definitions (like Sonarr/Radarr)
const QUALITY_DEFINITIONS = [
  { id: 'remux_2160p', name: '4K Remux', resolution: 2160, size_min: 30000, size_max: 100000, group: 'UHD' },
  { id: 'bluray_2160p', name: '4K Bluray', resolution: 2160, size_min: 15000, size_max: 80000, group: 'UHD' },
  { id: 'webdl_2160p', name: '4K WEBDL', resolution: 2160, size_min: 8000, size_max: 40000, group: 'UHD' },
  { id: 'webrip_2160p', name: '4K WEBRip', resolution: 2160, size_min: 5000, size_max: 25000, group: 'UHD' },
  { id: 'remux_1080p', name: '1080p Remux', resolution: 1080, size_min: 15000, size_max: 50000, group: 'HD' },
  { id: 'bluray_1080p', name: '1080p Bluray', resolution: 1080, size_min: 8000, size_max: 30000, group: 'HD' },
  { id: 'webdl_1080p', name: '1080p WEBDL', resolution: 1080, size_min: 3000, size_max: 15000, group: 'HD' },
  { id: 'webrip_1080p', name: '1080p WEBRip', resolution: 1080, size_min: 1500, size_max: 10000, group: 'HD' },
  { id: 'hdtv_1080p', name: '1080p HDTV', resolution: 1080, size_min: 1000, size_max: 5000, group: 'HD' },
  { id: 'bluray_720p', name: '720p Bluray', resolution: 720, size_min: 3000, size_max: 10000, group: 'HD' },
  { id: 'webdl_720p', name: '720p WEBDL', resolution: 720, size_min: 1000, size_max: 5000, group: 'HD' },
  { id: 'webrip_720p', name: '720p WEBRip', resolution: 720, size_min: 500, size_max: 3000, group: 'HD' },
  { id: 'hdtv_720p', name: '720p HDTV', resolution: 720, size_min: 500, size_max: 2500, group: 'HD' },
  { id: 'dvd', name: 'DVD', resolution: 480, size_min: 500, size_max: 2000, group: 'SD' },
  { id: 'sdtv', name: 'SDTV', resolution: 480, size_min: 200, size_max: 1000, group: 'SD' },
];

const QUALITY_GROUPS = ['UHD', 'HD', 'SD'];

const DEFAULT_PROFILES = [
  {
    name: 'Ultra-HD',
    cutoff: 'remux_2160p',
    qualities: ['remux_2160p', 'bluray_2160p', 'webdl_2160p', 'webrip_2160p', 'remux_1080p'],
    upgrade_allowed: true,
  },
  {
    name: 'HD-1080p',
    cutoff: 'bluray_1080p',
    qualities: ['remux_1080p', 'bluray_1080p', 'webdl_1080p', 'webrip_1080p', 'hdtv_1080p'],
    upgrade_allowed: true,
  },
  {
    name: 'HD-720p',
    cutoff: 'webdl_720p',
    qualities: ['bluray_720p', 'webdl_720p', 'webrip_720p', 'hdtv_720p'],
    upgrade_allowed: true,
  },
  {
    name: 'Any',
    cutoff: 'sdtv',
    qualities: QUALITY_DEFINITIONS.map(q => q.id),
    upgrade_allowed: false,
  },
];

const QualityBadge = ({ quality }) => {
  // Handle both our new format and existing backend format
  const qualityName = typeof quality === 'string' ? quality : (quality?.name || quality?.id || 'Unknown');
  const def = QUALITY_DEFINITIONS.find(q => q.id === qualityName || q.name === qualityName);
  
  // Determine color based on resolution in name
  let group = 'SD';
  if (qualityName.includes('2160') || qualityName.includes('4K')) group = 'UHD';
  else if (qualityName.includes('1080') || qualityName.includes('720')) group = 'HD';
  
  const colors = {
    UHD: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    HD: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    SD: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${colors[def?.group || group]}`}>
      {def?.name || qualityName}
    </span>
  );
};

export const QualityProfilesSettings = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState(null);
  
  const [newProfile, setNewProfile] = useState({
    name: '',
    cutoff: 'webdl_1080p',
    qualities: ['webdl_1080p', 'webrip_1080p', 'hdtv_1080p'],
    upgrade_allowed: true,
    is_default: false,
  });

  const fetchProfiles = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${BACKEND_URL}/api/quality-profiles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Handle both array and object responses
      let data = res.data;
      if (!Array.isArray(data)) {
        data = data.profiles || [];
      }
      // Parse qualities and extract just the names/IDs
      const parsed = data.map(profile => {
        let qualities = profile.qualities;
        if (typeof qualities === 'string') {
          try {
            qualities = JSON.parse(qualities);
          } catch {
            qualities = [];
          }
        }
        // Convert object qualities to simple string array
        if (Array.isArray(qualities) && qualities.length > 0 && typeof qualities[0] === 'object') {
          qualities = qualities.filter(q => q.enabled !== false).map(q => q.name || q.id || String(q));
        }
        return {
          ...profile,
          qualities: qualities || []
        };
      });
      setProfiles(parsed);
    } catch (err) {
      console.error('Failed to fetch profiles:', err);
        toast.error('Failed to fetch profiles:');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleCreateProfile = async () => {
    if (!newProfile.name.trim()) {
      toast.error('Profile name is required');
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${BACKEND_URL}/api/quality-profiles`, newProfile, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Profile created');
      fetchProfiles();
      setShowCreateModal(false);
      setNewProfile({
        name: '',
        cutoff: 'webdl_1080p',
        qualities: ['webdl_1080p', 'webrip_1080p', 'hdtv_1080p'],
        upgrade_allowed: true,
        is_default: false,
      });
    } catch (err) {
      toast.error('Failed to create profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProfile = async (profile) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${BACKEND_URL}/api/quality-profiles/${profile.id}`, profile, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Profile updated');
      fetchProfiles();
      setEditingProfile(null);
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async (profileId) => {
    if (!confirm('Delete this quality profile?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${BACKEND_URL}/api/quality-profiles/${profileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Profile deleted');
      fetchProfiles();
    } catch (err) {
      toast.error('Failed to delete profile');
    }
  };

  const handleSetDefault = async (profileId) => {
    try {
      const token = localStorage.getItem('token');
      const profile = profiles.find(p => p.id === profileId);
      await axios.put(`${BACKEND_URL}/api/quality-profiles/${profileId}`, 
        { ...profile, is_default: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Default profile set');
      fetchProfiles();
    } catch (err) {
      toast.error('Failed to set default');
    }
  };

  const toggleQuality = (qualityId, profile, setProfile) => {
    const current = profile.qualities || [];
    const updated = current.includes(qualityId)
      ? current.filter(q => q !== qualityId)
      : [...current, qualityId];
    setProfile({ ...profile, qualities: updated });
  };

  const importDefaultProfiles = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      for (const profile of DEFAULT_PROFILES) {
        await axios.post(`${BACKEND_URL}/api/quality-profiles`, profile, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      toast.success('Default profiles imported');
      fetchProfiles();
    } catch (err) {
      toast.error('Failed to import profiles');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
      data-testid="quality-profiles-settings"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Gauge className="w-5 h-5 text-orange-400" />
            Quality Profiles
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">Preserve</span>
            <HelpTooltip title="Quality Profiles (Preserve)" description="Define which video/audio qualities are acceptable for downloads, similar to Sonarr and Radarr profiles. Set minimum and maximum quality thresholds and preferred formats. Higher priority qualities are downloaded first when available." examples={["HD Profile: Allows 720p-1080p, prefers Bluray sources", "4K Profile: Allows 2160p only, requires HDR", "Any Profile: Accepts all qualities, upgrades when better available", "Drag to reorder priority — top items are preferred"]} />
          </h2>
          <p className="text-gray-400 text-sm mt-1">Define quality preferences for downloads (like Sonarr/Radarr)</p>
        </div>
        <div className="flex items-center gap-2">
          {profiles.length === 0 && (
            <Button
              variant="outline"
              onClick={importDefaultProfiles}
              disabled={saving}
              className="border-white/10"
            >
              <Settings className="w-4 h-4 mr-2" />
              Import Defaults
            </Button>
          )}
          <Button onClick={() => setShowCreateModal(true)} className="bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4 mr-2" />
            New Profile
          </Button>
        </div>
      </div>

      {/* Profiles List */}
      {profiles.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-white/10 rounded-xl">
          <Gauge className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-gray-400">No quality profiles configured</p>
          <p className="text-sm text-gray-500 mt-1">Create a profile or import defaults to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(profile => (
            <div
              key={profile.id}
              className="glass-card rounded-xl border border-white/10 overflow-hidden"
            >
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
                onClick={() => setExpandedProfile(expandedProfile === profile.id ? null : profile.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Gauge className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{profile.name}</p>
                      {profile.is_default && (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <Star className="w-3 h-3 fill-current" /> Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {profile.qualities?.length || 0} qualities • 
                      Cutoff: {QUALITY_DEFINITIONS.find(q => q.id === profile.cutoff)?.name || profile.cutoff} • 
                      {profile.upgrade_allowed ? 'Upgrades allowed' : 'No upgrades'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 mr-4">
                    {profile.qualities?.slice(0, 3).map(q => (
                      <QualityBadge key={q} quality={q} />
                    ))}
                    {profile.qualities?.length > 3 && (
                      <span className="text-xs text-gray-500">+{profile.qualities.length - 3}</span>
                    )}
                  </div>
                  {!profile.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleSetDefault(profile.id); }}
                      className="text-gray-400 hover:text-green-400"
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleDeleteProfile(profile.id); }}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  {expandedProfile === profile.id ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Editor */}
              {expandedProfile === profile.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-white/10 p-4 space-y-4"
                >
                  {/* Profile Name */}
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Profile Name</label>
                    <Input
                      value={editingProfile?.id === profile.id ? editingProfile.name : profile.name}
                      onChange={(e) => setEditingProfile({ ...profile, name: e.target.value })}
                      onFocus={() => setEditingProfile(profile)}
                      className="bg-white/5 border-white/10 max-w-xs"
                    />
                  </div>

                  {/* Qualities */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Allowed Qualities</label>
                    {QUALITY_GROUPS.map(group => (
                      <div key={group} className="mb-3">
                        <p className="text-xs text-gray-500 mb-2">{group}</p>
                        <div className="flex flex-wrap gap-2">
                          {QUALITY_DEFINITIONS.filter(q => q.group === group).map(quality => {
                            const isSelected = (editingProfile?.id === profile.id ? editingProfile : profile).qualities?.includes(quality.id);
                            return (
                              <button
                                key={quality.id}
                                onClick={() => {
                                  const p = editingProfile?.id === profile.id ? editingProfile : profile;
                                  const updated = { ...p };
                                  if (isSelected) {
                                    updated.qualities = updated.qualities.filter(q => q !== quality.id);
                                  } else {
                                    updated.qualities = [...(updated.qualities || []), quality.id];
                                  }
                                  setEditingProfile(updated);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 border'
                                    : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/20'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3" />}
                                {quality.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cutoff & Options */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Cutoff Quality</label>
                      <select
                        value={(editingProfile?.id === profile.id ? editingProfile : profile).cutoff}
                        onChange={(e) => setEditingProfile({ ...(editingProfile || profile), cutoff: e.target.value })}
                        onFocus={() => !editingProfile && setEditingProfile(profile)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                      >
                        {QUALITY_DEFINITIONS.map(q => (
                          <option key={q.id} value={q.id}>{q.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={(editingProfile?.id === profile.id ? editingProfile : profile).upgrade_allowed}
                        onCheckedChange={(checked) => setEditingProfile({ ...(editingProfile || profile), upgrade_allowed: checked })}
                      />
                      <span className="text-sm">Allow Upgrades</span>
                    </div>
                  </div>

                  {/* Save Button */}
                  {editingProfile?.id === profile.id && (
                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={() => handleUpdateProfile(editingProfile)}
                        disabled={saving}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] rounded-2xl border border-white/10 w-full max-w-lg p-6 space-y-4"
          >
            <h3 className="text-lg font-bold">Create Quality Profile</h3>
            
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Profile Name</label>
              <Input
                value={newProfile.name}
                onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                placeholder="e.g., HD-1080p"
                className="bg-white/5 border-white/10"
                data-testid="new-profile-name"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">Qualities</label>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {QUALITY_DEFINITIONS.map(quality => {
                  const isSelected = newProfile.qualities.includes(quality.id);
                  return (
                    <button
                      key={quality.id}
                      onClick={() => toggleQuality(quality.id, newProfile, setNewProfile)}
                      className={`w-full px-3 py-2 rounded-lg text-sm text-left flex items-center justify-between ${
                        isSelected ? 'bg-orange-500/20 border-orange-500/50 border' : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      <span>{quality.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-orange-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={newProfile.upgrade_allowed}
                onCheckedChange={(checked) => setNewProfile({ ...newProfile, upgrade_allowed: checked })}
              />
              <span className="text-sm">Allow Upgrades</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="border-white/10">
                Cancel
              </Button>
              <Button onClick={handleCreateProfile} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
                {saving ? 'Creating...' : 'Create Profile'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Tips */}
      <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
        <p className="text-sm text-orange-400">
          <strong>Tip:</strong> Quality profiles determine which releases to download. 
          The "Cutoff" is the minimum quality - once reached, no more upgrades will be downloaded 
          (unless "Allow Upgrades" is enabled).
        </p>
      </div>
    </motion.div>
  );
};
