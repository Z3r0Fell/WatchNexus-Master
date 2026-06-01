import { BACKEND_URL } from '../../lib/config';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Palette, Paintbrush, Sparkles, Check, Import, FileJson, Eye, Sun, Moon,
  Contrast, Layers
} from 'lucide-react';
import { Button } from '../ui/button';
import { JuiceColorPicker } from '../juice/JuiceColorPicker';
import { toast } from 'sonner';
import axios from 'axios';
import { useTheme } from '../../context/ThemeContext';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';

// Tabs for Theme Settings
const THEME_TABS = [
  { id: 'mode', label: 'Light/Dark Mode', icon: Contrast },
  { id: 'presets', label: 'Theme Presets', icon: Sparkles },
  { id: 'custom', label: 'Custom Theme', icon: Paintbrush },
];

export const ThemeForgeSettings = () => {
  const [activeTab, setActiveTab] = useState('mode');
  const { themeType, mode, toggleMode, applyBuiltInTheme, applyCustomColors, previewColors, resetToSaved } = useTheme();
  const [themeForgeConfig, setThemeForgeConfig] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(themeType);
  const [customColors, setCustomColors] = useState({
    primary: '#8B5CF6', secondary: '#EC4899', background: '#0F0F0F', surface: '#1A1A1A', text_primary: '#FFFFFF',
  });
  const [savingTheme, setSavingTheme] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const fetchThemeForgeConfig = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/milk/theme-forge`);
      setThemeForgeConfig(res.data);
      if (res.data.current_theme) {
        setSelectedTheme(res.data.current_theme.type);
        if (res.data.current_theme.colors) setCustomColors(res.data.current_theme.colors);
      }
    } catch { console.error('[ThemeForgeSettings] Failed to fetch theme forge config'); toast.error('[ThemeForgeSettings] Failed to fetch theme forge config');; }
  }, []);

  useEffect(() => { fetchThemeForgeConfig(); }, [fetchThemeForgeConfig]);

  const handleSetTheme = async (themeType) => {
    const success = await applyBuiltInTheme(themeType);
    if (success) {
      setSelectedTheme(themeType);
      toast.success('Theme applied!');
      fetchThemeForgeConfig();
    } else {
      toast.error('Failed to apply theme');
    }
  };

  const handleSaveCustomTheme = async () => {
    setSavingTheme(true);
    const success = await applyCustomColors(customColors);
    if (success) {
      toast.success('Custom theme saved!');
      setSelectedTheme('custom');
      setPreviewMode(false);
      fetchThemeForgeConfig();
    } else {
      toast.error('Failed to save custom theme');
    }
    setSavingTheme(false);
  };

  const handleColorChange = (key, color) => {
    const newColors = { ...customColors, [key]: color };
    setCustomColors(newColors);
    if (previewMode) previewColors(newColors);
  };

  const togglePreview = () => {
    if (previewMode) {
      resetToSaved();
      setPreviewMode(false);
    } else {
      previewColors(customColors);
      setPreviewMode(true);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'mode':
        return <ModeTab mode={mode} toggleMode={toggleMode} />;
      case 'presets':
        return <PresetsTab themeForgeConfig={themeForgeConfig} selectedTheme={selectedTheme} handleSetTheme={handleSetTheme} />;
      case 'custom':
        return (
          <CustomTab 
            customColors={customColors}
            handleColorChange={handleColorChange}
            previewMode={previewMode}
            togglePreview={togglePreview}
            handleSaveCustomTheme={handleSaveCustomTheme}
            savingTheme={savingTheme}
          />
        );
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="theme-forge-settings">
      <SettingsTabHeader
        title="Theme Forge"
        subtitle="Customize the visual appearance of WatchNexus"
        icon={Palette}
        tabs={THEME_TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        iconBgColor="from-violet-600 to-purple-500"
        version="Milk"
        help={{ title: "Theme Forge", description: "Personalize the look and feel of WatchNexus. Switch between dark and light modes, choose from community-created themes, or customize accent colors to match your style.", examples: ["Dark Mode: Best for home theater and low-light environments", "Light Mode: Better readability in bright rooms", "Community themes: Browse and install themes from other users"] }}
      />

      <SettingsTabContent activeTab={activeTab}>
        {renderTabContent()}
      </SettingsTabContent>
    </motion.div>
  );
};

// Mode Tab
const ModeTab = ({ mode, toggleMode }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {mode === 'dark' ? <Moon className="w-5 h-5 text-violet-400" /> : <Sun className="w-5 h-5 text-yellow-400" />}
            Appearance Mode
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Currently using <span className="font-medium text-white">{mode === 'dark' ? 'Dark' : 'Light'}</span> mode
          </p>
        </div>
        <button
          onClick={toggleMode}
          className={`relative w-20 h-10 rounded-full transition-all duration-300 ${
            mode === 'dark' 
              ? 'bg-gradient-to-r from-violet-600 to-purple-600' 
              : 'bg-gradient-to-r from-yellow-400 to-orange-400'
          }`}
          data-testid="theme-mode-toggle"
        >
          <div className={`absolute top-1 w-8 h-8 rounded-full bg-white shadow-lg transition-all duration-300 flex items-center justify-center ${
            mode === 'dark' ? 'left-1' : 'left-11'
          }`}>
            {mode === 'dark' ? <Moon className="w-4 h-4 text-violet-600" /> : <Sun className="w-4 h-4 text-yellow-500" />}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => mode !== 'dark' && toggleMode()}
          className={`p-6 rounded-xl border transition-all ${
            mode === 'dark' ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
          }`}
        >
          <Moon className="w-8 h-8 mb-3 text-violet-400" />
          <p className="font-semibold text-lg">Dark Mode</p>
          <p className="text-sm text-gray-500 mt-1">Easy on the eyes, perfect for night viewing</p>
          {mode === 'dark' && <div className="mt-3 flex items-center gap-1 text-violet-400 text-sm"><Check className="w-4 h-4" /> Active</div>}
        </button>
        <button
          onClick={() => mode !== 'light' && toggleMode()}
          className={`p-6 rounded-xl border transition-all ${
            mode === 'light' ? 'border-yellow-500 bg-yellow-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
          }`}
        >
          <Sun className="w-8 h-8 mb-3 text-yellow-400" />
          <p className="font-semibold text-lg">Light Mode</p>
          <p className="text-sm text-gray-500 mt-1">Bright and clear for daytime use</p>
          {mode === 'light' && <div className="mt-3 flex items-center gap-1 text-yellow-400 text-sm"><Check className="w-4 h-4" /> Active</div>}
        </button>
      </div>
    </div>
  </div>
);

// Presets Tab
const PresetsTab = ({ themeForgeConfig, selectedTheme, handleSetTheme }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-pink-400" />
        Built-in Themes
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {themeForgeConfig?.built_in_themes?.map((theme) => (
          <button key={theme.type} onClick={() => handleSetTheme(theme.type)}
            className={`p-4 rounded-xl border transition-all text-left ${
              selectedTheme === theme.type ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.preview_colors?.primary }} />
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.preview_colors?.secondary }} />
            </div>
            <p className="font-semibold">{theme.name}</p>
            <p className="text-xs text-gray-500 mt-1">{theme.description}</p>
            {selectedTheme === theme.type && (
              <div className="mt-3 flex items-center gap-1 text-violet-400 text-xs"><Check className="w-3 h-3" /> Active</div>
            )}
          </button>
        ))}
      </div>
    </div>
  </div>
);

// Custom Tab
const CustomTab = ({ customColors, handleColorChange, previewMode, togglePreview, handleSaveCustomTheme, savingTheme }) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Paintbrush className="w-5 h-5 text-cyan-400" />
          Custom Theme Builder
        </h3>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={togglePreview} 
            className={previewMode ? 'border-yellow-500 text-yellow-400' : 'border-white/10'}
          >
            <Eye className="w-4 h-4 mr-1" />
            {previewMode ? 'Stop Preview' : 'Preview'}
          </Button>
          <Button onClick={handleSaveCustomTheme} disabled={savingTheme} className="bg-violet-600 hover:bg-violet-700">
            {savingTheme ? 'Saving...' : 'Save & Apply'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <JuiceColorPicker label="Primary Color" color={customColors.primary} onChange={(color) => handleColorChange('primary', color)} />
        <JuiceColorPicker label="Secondary Color" color={customColors.secondary} onChange={(color) => handleColorChange('secondary', color)} />
        <JuiceColorPicker label="Background" color={customColors.background} onChange={(color) => handleColorChange('background', color)} />
        <JuiceColorPicker label="Surface" color={customColors.surface} onChange={(color) => handleColorChange('surface', color)} />
      </div>

      {/* Live Preview */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: customColors.background }}>
        <p className="text-sm text-gray-500 mb-2">Live Preview</p>
        <div className="p-3 rounded-lg" style={{ backgroundColor: customColors.surface }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${customColors.primary}, ${customColors.secondary})` }} />
            <div>
              <p style={{ color: customColors.text_primary || '#fff' }}>Sample Title</p>
              <p className="text-sm" style={{ color: '#a1a1aa' }}>Sample description text</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: customColors.primary }}>Primary</button>
            <button className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: customColors.secondary }}>Secondary</button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" className="border-white/10 hover:bg-white/5"><Import className="w-4 h-4 mr-2" /> Import Theme</Button>
        <Button variant="outline" className="border-white/10 hover:bg-white/5"><FileJson className="w-4 h-4 mr-2" /> Export Theme</Button>
      </div>
    </div>

    <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20">
      <p className="text-sm text-pink-400">
        <strong>Tip:</strong> Use Preview mode to see how colors look together before saving.
      </p>
    </div>
  </div>
);

export default ThemeForgeSettings;
