import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Folder, Check, X, RefreshCw, FolderOpen, FolderSearch, ChevronRight, ChevronDown, Lock, Film,
  Cog, Users, BookOpen, Activity, Search, Download, Tv, Globe, Subtitles, Server, Palette, Package, Wrench } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  GeneralSettings, UsersSettings, LibrarySettings,
  MediaHealthSettings, IndexerSettings, DownloadSettings,
  IPTVSettings, StreamingSettings, SubtitleSettings,
  GelatinSettings, ThemeForgeSettings, PluginsSettings,
  MaintenanceSettings
} from '../components/settings';
import { Layout } from '../components/layout/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import { settingsApi } from '../services/api';
import { BACKEND_URL } from '../lib/config';

const API_URL = BACKEND_URL;

export const SettingsPage = () => {
  // Current active setting
  const [activeSection, setActiveSection] = useState('general');
  const [expandedGroups, setExpandedGroups] = useState(['core', 'acquisition', 'playback', 'advanced']);
  
  // Grouped settings navigation
  const groupedSections = useMemo(() => {
    const navItems = [
      { id: 'general', label: 'General', group: 'Core Settings', groupId: 'core' },
      { id: 'users', label: 'Users & Access', group: 'Core Settings', groupId: 'core' },
      { id: 'library', label: 'Media Libraries', group: 'Core Settings', groupId: 'core' },
      { id: 'media-health', label: 'Media Health', group: 'Core Settings', groupId: 'core' },
      { id: 'indexers', label: 'Indexers', group: 'Media Acquisition', groupId: 'acquisition' },
      { id: 'download', label: 'Download Client', group: 'Media Acquisition', groupId: 'acquisition' },
      { id: 'iptv', label: 'IPTV', group: 'Playback & Streaming', groupId: 'playback' },
      { id: 'streaming', label: 'Streaming Services', group: 'Playback & Streaming', groupId: 'playback' },
      { id: 'subtitles', label: 'Subtitles', group: 'Playback & Streaming', groupId: 'playback' },
      { id: 'gelatin', label: 'External Access', group: 'Advanced', groupId: 'advanced' },
      { id: 'theme-forge', label: 'Theme Forge', group: 'Advanced', groupId: 'advanced' },
      { id: 'plugins', label: 'Plugins', group: 'Advanced', groupId: 'advanced' },
      { id: 'maintenance', label: 'Maintenance', group: 'Advanced', groupId: 'advanced' },
    ];
    const groups = {};
    navItems.forEach(item => {
      if (!groups[item.groupId]) {
        groups[item.groupId] = { id: item.groupId, label: item.group, items: [] };
      }
      groups[item.groupId].items.push(item);
    });
    return Object.values(groups);
  }, []);
  
  // Get current section info
  const currentInfo = useMemo(() => {
    for (let i = 0; i < groupedSections.length; i++) {
      const section = groupedSections[i];
      const item = section.items.find(it => it.id === activeSection);
      if (item) return { group: section.label, item };
    }
    return null;
  }, [activeSection, groupedSections]);
  
  // General settings
  const [settings, setSettings] = useState({
    download_path: '/media/downloads',
    library_path: '/media/library',
    auto_subtitles: true,
    subtitle_languages: ['en'],
    quality_preference: '1080p',
  });
  const [saving, setSaving] = useState(false);

  // Library management
  const [libraries, setLibraries] = useState([]);
  const [loadingLibraries, setLoadingLibraries] = useState(false);
  const [scanningLibrary, setScanningLibrary] = useState(null);
  const [showAddLibrary, setShowAddLibrary] = useState(false);
  const [newLibrary, setNewLibrary] = useState({ name: '', path: '', media_type: 'movies' });
  const [librarySubTab, setLibrarySubTab] = useState('libraries');
  const [manualImportPath, setManualImportPath] = useState('');
  const [manualImportFiles, setManualImportFiles] = useState([]);

  // File browser
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [browserPath, setBrowserPath] = useState('/');
  const [browserItems, setBrowserItems] = useState([]);
  const [browserDrives, setBrowserDrives] = useState([]);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserMediaCount, setBrowserMediaCount] = useState(0);
  const [browserTargetField, setBrowserTargetField] = useState(null); // Track which field needs the path

  // Users management
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [savingUser, setSavingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '', email: '', password: '', role: 'user',
    permissions: { can_download: true, can_delete: false, can_manage_library: false, can_manage_users: false, can_access_settings: false, max_streams: 3, allowed_libraries: [] }
  });

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get(`${API_URL}/api/users`);
      setUsers(res.data || []);
    } catch {
      setUsers([{ id: '1', username: 'admin', email: 'admin@watchnexus.local', role: 'admin', avatar: null, created_at: new Date().toISOString(),
        permissions: { can_download: true, can_delete: true, can_manage_library: true, can_manage_users: true, can_access_settings: true, max_streams: 10 }
      }]);
    } finally { setLoadingUsers(false); }
  }, []);

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) { toast.error('Please fill in all required fields'); return; }
    setSavingUser(true);
    try {
      const res = await axios.post(`${API_URL}/api/users`, newUser);
      setUsers(prev => [...prev, res.data]);
      setShowAddUser(false);
      setNewUser({ username: '', email: '', password: '', role: 'user', permissions: { can_download: true, can_delete: false, can_manage_library: false, can_manage_users: false, can_access_settings: false, max_streams: 3, allowed_libraries: [] } });
      toast.success('User created successfully');
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to create user'); }
    finally { setSavingUser(false); }
  };

  const handleUpdateUser = async (userId, updates) => {
    setSavingUser(true);
    try {
      await axios.put(`${API_URL}/api/users/${userId}`, updates);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
      setEditingUser(null); toast.success('User updated successfully');
    } catch { toast.error('Failed to update user'); }
    finally { setSavingUser(false); }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try { await axios.delete(`${API_URL}/api/users/${userId}`); setUsers(prev => prev.filter(u => u.id !== userId)); toast.success('User deleted'); }
    catch { toast.error('Failed to delete user'); }
  };

  // Fetch libraries
  const fetchLibraries = useCallback(async () => {
    setLoadingLibraries(true);
    try { const res = await axios.get(`${API_URL}/api/marmalade/libraries`); setLibraries(res.data || []); }
    catch {} finally { setLoadingLibraries(false); }
  }, []);

  const handleAddLibrary = async () => {
    if (!newLibrary.name || !newLibrary.path) { toast.error('Name and path are required'); return; }
    try {
      await axios.post(`${API_URL}/api/marmalade/libraries`, null, { params: newLibrary });
      toast.success(`Library "${newLibrary.name}" added`);
      setNewLibrary({ name: '', path: '', media_type: 'movies' }); setShowAddLibrary(false); fetchLibraries();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to add library'); }
  };

  const handleDeleteLibrary = async (libraryId) => {
    try { await axios.delete(`${API_URL}/api/marmalade/libraries/${libraryId}`); toast.success('Library removed'); fetchLibraries(); }
    catch { toast.error('Failed to remove library'); }
  };

  const handleScanLibrary = async (libraryId) => {
    setScanningLibrary(libraryId);
    try {
      const res = await axios.post(`${API_URL}/api/marmalade/libraries/${libraryId}/scan`);
      toast.success(`Scan complete: ${res.data.new} new, ${res.data.updated} updated`); fetchLibraries();
    } catch { toast.error('Scan failed'); }
    finally { setScanningLibrary(null); }
  };

  // File browser
  const openFileBrowser = async (targetField = null, initialPath = '/') => {
    setBrowserTargetField(targetField);
    setShowFileBrowser(true); 
    await browsePath(initialPath);
  };

  const browsePath = async (path) => {
    setBrowserLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/filesystem/browse`, { params: { path } });
      setBrowserPath(res.data.current_path); setBrowserItems(res.data.items || []);
      setBrowserDrives(res.data.drives || []); setBrowserMediaCount(res.data.media_files_in_current || 0);
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to browse directory'); }
    finally { setBrowserLoading(false); }
  };

  const selectFolderFromBrowser = () => {
    // If we have a target field (for settings), update settings directly
    if (browserTargetField) {
      setSettings(prev => ({ ...prev, [browserTargetField]: browserPath }));
      setShowFileBrowser(false);
      setBrowserTargetField(null);
      return;
    }
    
    // Otherwise, it's for library creation
    setNewLibrary(prev => ({ ...prev, path: browserPath }));
    const folderName = browserPath.split('/').filter(Boolean).pop() || browserPath.split('\\').filter(Boolean).pop();
    if (folderName && !newLibrary.name) {
      setNewLibrary(prev => ({ ...prev, name: folderName.charAt(0).toUpperCase() + folderName.slice(1).replace(/[-_]/g, ' ') }));
    }
    const lowerName = folderName?.toLowerCase() || '';
    if (lowerName.includes('movie')) setNewLibrary(prev => ({ ...prev, media_type: 'movies' }));
    else if (lowerName.includes('tv') || lowerName.includes('series')) setNewLibrary(prev => ({ ...prev, media_type: 'tv' }));
    else if (lowerName.includes('anime')) setNewLibrary(prev => ({ ...prev, media_type: 'anime' }));
    else if (lowerName.includes('music')) setNewLibrary(prev => ({ ...prev, media_type: 'music' }));
    setShowFileBrowser(false); setShowAddLibrary(true);
  };

  // Media management handlers
  const handleManualImportScan = async () => {
    if (!manualImportPath) { toast.error('Please enter a path to scan'); return; }
    try {
      const res = await axios.post(`${API_URL}/api/media-management/scan-import`, { path: manualImportPath });
      setManualImportFiles(res.data.files || []); toast.success(`Found ${res.data.files?.length || 0} importable files`);
    } catch { toast.error('Failed to scan directory'); }
  };

  const handleImportFiles = async (files) => {
    try {
      await axios.post(`${API_URL}/api/media-management/import`, { files });
      toast.success('Files imported successfully'); setManualImportFiles([]); fetchLibraries();
    } catch { toast.error('Failed to import files'); }
  };

  // Settings handlers
  const fetchData = useCallback(async () => {
    try {
      const settingsRes = await settingsApi.get().catch(() => ({ data: settings }));
      setSettings(settingsRes.data || settings);
    } catch {}
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try { await settingsApi.update(settings); toast.success('Settings saved successfully'); }
    catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  useEffect(() => { fetchData(); fetchLibraries(); fetchUsers(); }, [fetchData, fetchLibraries, fetchUsers]);

  // Toggle section expand/collapse
  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Render the content for the active section
  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <GeneralSettings 
            settings={settings} 
            setSettings={setSettings} 
            onSave={handleSaveSettings} 
            saving={saving}
            onOpenFileBrowser={(field) => openFileBrowser(field, settings[field] || '/')}
          />
        );
      case 'users':
        return (
          <UsersSettings users={users} loadingUsers={loadingUsers} showAddUser={showAddUser} setShowAddUser={setShowAddUser}
            newUser={newUser} setNewUser={setNewUser} savingUser={savingUser} editingUser={editingUser}
            setEditingUser={setEditingUser} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} />
        );
      case 'library':
        return (
          <LibrarySettings libraries={libraries} loadingLibraries={loadingLibraries} scanningLibrary={scanningLibrary}
            showAddLibrary={showAddLibrary} setShowAddLibrary={setShowAddLibrary} newLibrary={newLibrary}
            setNewLibrary={setNewLibrary} onAddLibrary={handleAddLibrary} onDeleteLibrary={handleDeleteLibrary}
            onScanLibrary={handleScanLibrary} onOpenFileBrowser={openFileBrowser} librarySubTab={librarySubTab}
            setLibrarySubTab={setLibrarySubTab} manualImportPath={manualImportPath} setManualImportPath={setManualImportPath}
            manualImportFiles={manualImportFiles} onManualImportScan={handleManualImportScan} onImportFiles={handleImportFiles} />
        );
      case 'media-health': return <MediaHealthSettings />;
      case 'indexers': return <IndexerSettings />;
      case 'download': return <DownloadSettings />;
      case 'iptv': return <IPTVSettings />;
      case 'streaming': return <StreamingSettings />;
      case 'subtitles': return <SubtitleSettings />;
      case 'gelatin': return <GelatinSettings />;
      case 'theme-forge': return <ThemeForgeSettings />;
      case 'plugins': return <PluginsSettings />;
      case 'maintenance': return <MaintenanceSettings />;
      default: return null;
    }
  };

  // Get current section info
  const getCurrentSectionInfo = () => {
    const item = SETTINGS_NAV.find(i => i.id === activeSection);
    if (item) return { group: item.group, item };
    return null;
  };

  const currentInfo = getCurrentSectionInfo();
  const groupedSections = getGroupedSections();

  return (
    <Layout>
      <div data-testid="settings-page" className="min-h-screen flex">
        {/* Sidebar Navigation */}
        <aside className="w-72 shrink-0 border-r border-white/10 bg-black/20 sticky top-0 h-screen overflow-y-auto">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Settings</h1>
                <p className="text-xs text-gray-400">Configure WatchNexus</p>
              </div>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {groupedSections.map((section) => {
              const isExpanded = expandedGroups.includes(section.id);
              const hasActiveItem = section.items.some(item => item.id === activeSection);

              return (
                <div key={section.id} className="rounded-xl overflow-hidden">
                  {/* Section Header */}
                  <button
                    onClick={() => toggleGroup(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all rounded-xl ${
                      hasActiveItem ? 'bg-violet-500/10 text-violet-400' : 'hover:bg-white/5 text-gray-300'
                    }`}
                    data-testid={`settings-section-${section.id}`}
                  >
                    <Cog className="w-5 h-5" />
                    <span className="flex-1 font-medium text-sm">{section.label}</span>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </motion.div>
                  </button>

                  {/* Section Items */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="py-1 pl-4 space-y-0.5">
                          {section.items.map((item) => {
                            const isActive = activeSection === item.id;
                            
                            return (
                              <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all ${
                                  isActive 
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                                data-testid={`settings-nav-${item.id}`}
                              >
                                <span className="text-sm">{item.label}</span>
                                {isActive && (
                                  <ChevronRight className="w-4 h-4 ml-auto" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-h-screen">
          {/* Content Header */}
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-white/10 px-8 py-4">
            <div className="flex items-center gap-3">
              {currentInfo && (
                <>
                  <span className="text-gray-500">{currentInfo.group}</span>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                  <span className="font-medium">{currentInfo.item.label}</span>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* File Browser Modal */}
      <AnimatePresence>
        {showFileBrowser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowFileBrowser(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <FolderSearch className="w-5 h-5 text-violet-400" /> Browse for Folder
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowFileBrowser(false)} className="hover:bg-white/10">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">Current:</span>
                  <code className="flex-1 bg-black/30 px-3 py-1.5 rounded-lg text-violet-400 truncate">{browserPath}</code>
                </div>
                <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                  <span className="text-xs text-gray-500 shrink-0">Quick access:</span>
                  {browserDrives.map((drive) => (
                    <button key={drive.path} onClick={() => browsePath(drive.path)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors shrink-0 ${browserPath === drive.path ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                      {drive.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {browserLoading ? (
                  <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-violet-400" /></div>
                ) : browserItems.length === 0 ? (
                  <div className="text-center py-12 text-gray-400"><FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>This folder is empty</p></div>
                ) : (
                  <div className="space-y-1">
                    {browserItems.filter(item => item.type === 'directory').map((item) => (
                      <button key={item.path} onClick={() => browsePath(item.path)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${item.is_parent ? 'bg-white/5 hover:bg-white/10' : 'hover:bg-violet-500/10'}`}>
                        {item.is_parent ? <ChevronRight className="w-5 h-5 text-gray-400 rotate-180" /> : <Folder className="w-5 h-5 text-violet-400" />}
                        <span className="flex-1 truncate">{item.is_parent ? 'Go up' : item.name}</span>
                        {!item.is_parent && (
                          <span className="text-xs text-gray-500">
                            {item.permission_denied ? <Lock className="w-4 h-4 text-red-400" /> : `${item.item_count || 0} items`}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-white/10 bg-black/20">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    {browserMediaCount > 0 && (
                      <span className="flex items-center gap-2"><Film className="w-4 h-4 text-green-400" />{browserMediaCount} media files in this folder</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowFileBrowser(false)} className="border-white/20">Cancel</Button>
                    <Button onClick={selectFolderFromBrowser} className="bg-violet-600 hover:bg-violet-700">
                      <Check className="w-4 h-4 mr-2" /> Select This Folder
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default SettingsPage;
