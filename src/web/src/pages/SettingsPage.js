import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Check, X, FolderSearch } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  GeneralSettings, UsersSettings, LibrarySettings,
  MediaHealthSettings, IndexerSettings, DownloadSettings,
  IPTVSettings, StreamingSettings, SubtitleSettings,
  GelatinSettings, ThemeForgeSettings, PluginsSettings,
  MaintenanceSettings, PlaybackSettings, AboutSettings,
  QualityProfilesSettings, ActivationSettings
} from '../components/settings';
import { UpdateSettings } from '../components/settings/UpdateSettings';
import { ZestSettings } from '../components/settings/ZestSettings';
import { CrumbsSettings } from '../components/settings/CrumbsSettings';
import { FFmpegSettings } from '../components/settings/FFmpegSettings';
import { Layout } from '../components/layout/Layout';
import FolderBrowser from '../components/FolderBrowser';
import axios from 'axios';
import { toast } from 'sonner';
import { settingsApi } from '../services/api';
import { BACKEND_URL } from '../lib/config';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../hooks/use-confirm';

const VIDEO_EXT_RE = /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|mpg|mpeg|m2ts)$/i;

const API_URL = BACKEND_URL;

export const SettingsPage = () => {
  const { user: currentUser } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();
  // Current active setting — deep-linkable via navigate('/settings', { state: { section } })
  // (TierGate; React Router v6 keeps navigation state in history.state.usr) or
  // /settings?section=... (apiErrorHandler). Read without router hooks so the
  // page still renders outside a <Router>.
  const [activeSection, setActiveSection] = useState(() => {
    try {
      return window.history.state?.usr?.section
        || new URLSearchParams(window.location.search).get('section')
        || 'general';
    } catch {
      return 'general';
    }
  });
  
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

  // File browser - using centralized FolderBrowser component
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [browserTargetField, setBrowserTargetField] = useState(null); // Track which field needs the path
  const [selectedBrowserPath, setSelectedBrowserPath] = useState('');
  const [initialBrowserPath, setInitialBrowserPath] = useState('');

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
    } catch (error) {
      // Never fabricate users on failure; /api/users is admin-only (403 for normal users).
      setUsers([]);
      if (error?.response?.status !== 403) toast.error('Failed to load users');
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
      // Don't close edit panel for permission updates - only show success for major changes
      if (updates.username || updates.email || updates.role) {
        setEditingUser(null);
        toast.success('User updated successfully');
      }
    } catch { toast.error('Failed to update user'); }
    finally { setSavingUser(false); }
  };

  const handleDeleteUser = async (userId) => {
    const ok = await confirm({ title: 'Delete User', description: 'Are you sure you want to delete this user?', confirmText: 'Delete' });
    if (!ok) return;
    try { await axios.delete(`${API_URL}/api/users/${userId}`); setUsers(prev => prev.filter(u => u.id !== userId)); toast.success('User deleted'); }
    catch { toast.error('Failed to delete user'); }
  };

  // Fetch libraries
  const fetchLibraries = useCallback(async () => {
    setLoadingLibraries(true);
    try { const res = await axios.get(`${API_URL}/api/marmalade/libraries`); setLibraries(res.data || []); }
    catch (error) { console.error('Failed to fetch libraries:', error); toast.error('Failed to load libraries'); }
    finally { setLoadingLibraries(false); }
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

  // File browser - opens the FolderBrowser modal
  const openFileBrowser = (targetField = null, initialPath = '/') => {
    setBrowserTargetField(targetField);
    setInitialBrowserPath(initialPath);
    setSelectedBrowserPath('');
    setShowFileBrowser(true);
  };

  // Handle folder selection from FolderBrowser component
  const handleBrowserPathSelect = (path) => {
    setSelectedBrowserPath(path);
  };

  // Confirm folder selection
  const confirmFolderSelection = () => {
    if (!selectedBrowserPath) return;
    
    // If we have a target field (for settings), update settings directly
    if (browserTargetField) {
      setSettings(prev => ({ ...prev, [browserTargetField]: selectedBrowserPath }));
      setShowFileBrowser(false);
      setBrowserTargetField(null);
      return;
    }
    
    // Otherwise, it's for library creation
    setNewLibrary(prev => ({ ...prev, path: selectedBrowserPath }));
    const folderName = selectedBrowserPath.split('/').filter(Boolean).pop() || selectedBrowserPath.split('\\').filter(Boolean).pop();
    if (folderName && !newLibrary.name) {
      setNewLibrary(prev => ({ ...prev, name: folderName.charAt(0).toUpperCase() + folderName.slice(1).replace(/[-_]/g, ' ') }));
    }
    const lowerName = folderName?.toLowerCase() || '';
    if (lowerName.includes('movie')) setNewLibrary(prev => ({ ...prev, media_type: 'movies' }));
    else if (lowerName.includes('tv') || lowerName.includes('series')) setNewLibrary(prev => ({ ...prev, media_type: 'tv' }));
    else if (lowerName.includes('anime')) setNewLibrary(prev => ({ ...prev, media_type: 'anime' }));
    else if (lowerName.includes('music')) setNewLibrary(prev => ({ ...prev, media_type: 'music' }));
    setShowFileBrowser(false);
    setShowAddLibrary(true);
  };

  // Media management handlers
  const handleManualImportScan = async () => {
    if (!manualImportPath) { toast.error('Please enter a path to scan'); return; }
    try {
      // Backend directory scan (media-root allowlisted). Returns [{ file_path, status, size, ... }].
      const res = await axios.post(`${API_URL}/api/media/scan-library`, null, { params: { directory: manualImportPath } });
      const files = (Array.isArray(res.data) ? res.data : [])
        .filter(f => f.status !== 'error' && VIDEO_EXT_RE.test(f.file_path || ''))
        .map(f => ({
          path: f.file_path,
          name: (f.file_path || '').split(/[\\/]/).pop(),
          size: f.size || 0,
          status: f.status,
        }));
      setManualImportFiles(files); toast.success(`Found ${files.length} importable files`);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) toast.error('That path is outside the configured media roots');
      else if (status === 404) toast.error('Directory not found');
      else toast.error('Failed to scan directory');
    }
  };

  // There is no per-file import endpoint: media enters a library via a library
  // scan. If the scanned path is inside a library, rescan that library;
  // otherwise tell the user to add the folder as a library.
  const handleImportFiles = async () => {
    const norm = (p) => (p || '').replace(/[\\/]+$/, '');
    const target = norm(manualImportPath);
    const lib = libraries.find(l => l.path && (target === norm(l.path) || target.startsWith(norm(l.path) + '/')));
    if (!lib) {
      toast.error('Files can only be imported from inside a library folder. Add this folder as a library (or move the files into one) and scan it.');
      return;
    }
    await handleScanLibrary(lib.id);
    setManualImportFiles([]);
  };

  // Settings handlers
  const fetchData = useCallback(async () => {
    try {
      const settingsRes = await settingsApi.get();
      if (settingsRes?.data) setSettings(settingsRes.data);
    } catch (error) {
      // Keep defaults but tell the user: saving them would overwrite the real config.
      toast.error(error?.response?.status === 403 ? 'Admin access required to view server settings' : 'Failed to load settings');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try { await settingsApi.update(settings); toast.success('Settings saved successfully'); }
    catch (error) { toast.error(error?.response?.status === 403 ? 'Admin access required to change server settings' : 'Failed to save settings'); }
    finally { setSaving(false); }
  };

  useEffect(() => { fetchData(); fetchLibraries(); fetchUsers(); }, [fetchData, fetchLibraries, fetchUsers]);

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
            setEditingUser={setEditingUser} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser}
            currentUserId={currentUser?.id} />
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
      case 'integrations': return <CrumbsSettings />;
      case 'playback': return <PlaybackSettings />;
      case 'ffmpeg': return <FFmpegSettings />;
      case 'quality-profiles': return <QualityProfilesSettings />;
      case 'indexers': return <IndexerSettings />;
      case 'download': return <DownloadSettings />;
      case 'iptv': return <IPTVSettings />;
      case 'streaming': return <StreamingSettings />;
      case 'subtitles': return <SubtitleSettings />;
      case 'gelatin': return <GelatinSettings />;
      case 'theme-forge': return <ThemeForgeSettings />;
      case 'plugins': return <PluginsSettings />;
      case 'logs': return <ZestSettings />;
      case 'maintenance': return <MaintenanceSettings />;
      case 'about': return <AboutSettings />;
      case 'activation': return <ActivationSettings />;
      case 'updates': return <UpdateSettings />;
      default: return null;
    }
  };

  // Helper to render nav button - uses theme primary color
  const NavButton = ({ id, label }) => (
    <button
      onClick={() => setActiveSection(id)}
      className={`w-full text-left px-4 py-2.5 rounded-lg transition-all ${
        activeSection === id 
          ? 'text-white shadow-lg'
          : 'text-gray-400 hover:bg-white/5 hover:text-white'
      }`}
      style={activeSection === id ? {
        backgroundColor: 'var(--primary, #8B5CF6)',
        boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--primary, #8B5CF6) 30%, transparent)'
      } : {}}
      data-testid={`settings-nav-${id}`}
    >
      {label}
    </button>
  );

  return (
    <Layout>
      <div data-testid="settings-page" className="min-h-screen flex">
        {/* Sidebar Navigation */}
        <aside className="w-72 shrink-0 border-r border-white/10 bg-black/20 sticky top-0 h-screen overflow-y-auto">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, var(--primary, #8B5CF6), var(--secondary, #EC4899))`
                }}
              >
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Settings</h1>
                <p className="text-xs text-gray-400">Configure WatchNexus</p>
              </div>
            </div>
          </div>

          <nav className="p-3 space-y-4">
            {/* Core Settings */}
            <div>
              <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Core Settings</h3>
              <div className="space-y-0.5">
                <NavButton id="general" label="General" />
                <NavButton id="users" label="Users" />
                <NavButton id="library" label="Media Libraries" />
                <NavButton id="media-health" label="Media Health" />
              </div>
            </div>

            {/* Integrations */}
            <div>
              <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Integrations</h3>
              <div className="space-y-0.5">
                <NavButton id="integrations" label="API Management" />
                <NavButton id="indexers" label="Indexers" />
                <NavButton id="download" label="Download Client" />
              </div>
            </div>

            {/* Playback & Streaming */}
            <div>
              <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Playback & Streaming</h3>
              <div className="space-y-0.5">
                <NavButton id="playback" label="Playback" />
                <NavButton id="ffmpeg" label="FFmpeg" />
                <NavButton id="quality-profiles" label="Quality Profiles" />
                <NavButton id="iptv" label="IPTV" />
                <NavButton id="streaming" label="Streaming Services" />
                <NavButton id="subtitles" label="Subtitles" />
              </div>
            </div>

            {/* Advanced */}
            <div>
              <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Advanced</h3>
              <div className="space-y-0.5">
                <NavButton id="gelatin" label="External Access" />
                <NavButton id="theme-forge" label="Theme Forge" />
                <NavButton id="plugins" label="Gadgets" />
                <NavButton id="logs" label="Logs & Health" />
                <NavButton id="maintenance" label="Maintenance" />
              </div>
            </div>

            {/* About & Help */}
            <div>
              <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">About</h3>
              <div className="space-y-0.5">
                <NavButton id="activation" label="Activation" />
                <NavButton id="updates" label="Updates" />
                <NavButton id="about" label="About & Releases" />
              </div>
            </div>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-h-screen">
          {/* Content Header */}
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-white/10 px-8 py-4">
            <h2 className="font-medium capitalize">{activeSection === 'plugins' ? 'Gadgets' : activeSection === 'integrations' ? 'API Management' : activeSection === 'activation' ? 'License Activation' : activeSection === 'updates' ? 'Software Updates' : activeSection.replace('-', ' ')} Settings</h2>
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

      {/* File Browser Modal - Using centralized FolderBrowser component */}
      <AnimatePresence>
        {showFileBrowser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowFileBrowser(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FolderSearch className="w-5 h-5 text-violet-400" /> Browse for Folder
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setShowFileBrowser(false)} className="hover:bg-white/10">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <FolderBrowser
                  onSelect={handleBrowserPathSelect}
                  initialPath={initialBrowserPath}
                  selectedPath={selectedBrowserPath}
                />
              </div>
              <div className="p-4 border-t border-white/10 bg-black/20">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    {selectedBrowserPath && (
                      <span className="text-violet-400 font-mono">{selectedBrowserPath}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowFileBrowser(false)} className="border-white/20">Cancel</Button>
                    <Button 
                      onClick={confirmFolderSelection} 
                      className="bg-violet-600 hover:bg-violet-700"
                      disabled={!selectedBrowserPath}
                      data-testid="confirm-folder-selection-btn"
                    >
                      <Check className="w-4 h-4 mr-2" /> Select This Folder
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog />
    </Layout>
  );
};

export default SettingsPage;
