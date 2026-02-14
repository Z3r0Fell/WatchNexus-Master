import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Palette, Paintbrush, Sparkles, Check, Import, FileJson } from 'lucide-react';
import { Button } from '../ui/button';
import { JuiceColorPicker } from '../juice/JuiceColorPicker';
import { toast } from 'sonner';
import axios from 'axios';

export const ThemeForgeSettings = () => {
  const [themeForgeConfig, setThemeForgeConfig] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [customColors, setCustomColors] = useState({
    primary: '#8B5CF6', secondary: '#EC4899', background: '#0F0F0F', surface: '#1A1A1A', text_primary: '#FFFFFF',
  });
  const [savingTheme, setSavingTheme] = useState(false);

  const fetchThemeForgeConfig = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/milk/theme-forge`);
      setThemeForgeConfig(res.data);
      if (res.data.current_theme) {
        setSelectedTheme(res.data.current_theme.type);
        if (res.data.current_theme.colors) setCustomColors(res.data.current_theme.colors);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchThemeForgeConfig(); }, [fetchThemeForgeConfig]);

  const handleSetTheme = async (themeType) => {
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/milk/set-theme?theme_type=${themeType}`);
      setSelectedTheme(themeType); toast.success('Theme applied!'); fetchThemeForgeConfig();
    } catch { toast.error('Failed to apply theme'); }
  };

  const handleSaveCustomTheme = async () => {
    setSavingTheme(true);
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/milk/custom-theme`, { name: 'My Custom Theme', type: 'custom', colors: customColors });
      toast.success('Custom theme saved!'); setSelectedTheme('custom'); fetchThemeForgeConfig();
    } catch { toast.error('Failed to save custom theme'); }
    finally { setSavingTheme(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6" data-testid="theme-forge-settings">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Palette className="w-5 h-5 text-violet-400" /> Theme Forge
        <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">Milk</span>
      </h2>
      <p className="text-gray-400">Customize the visual appearance of WatchNexus with built-in themes or create your own.</p>

      <div className="space-y-4">
        <h3 className="font-medium flex items-center gap-2"><Sparkles className="w-4 h-4 text-gray-400" /> Built-in Themes</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {themeForgeConfig?.built_in_themes?.map((theme) => (
            <button key={theme.type} onClick={() => handleSetTheme(theme.type)}
              className={`p-4 rounded-xl border transition-all text-left ${
                selectedTheme === theme.type ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.preview_colors?.primary }} />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.preview_colors?.secondary }} />
              </div>
              <p className="font-medium">{theme.name}</p>
              <p className="text-xs text-gray-500 mt-1">{theme.description}</p>
              {selectedTheme === theme.type && (
                <div className="mt-2 flex items-center gap-1 text-violet-400 text-xs"><Check className="w-3 h-3" /> Active</div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2"><Paintbrush className="w-4 h-4 text-gray-400" /> Custom Theme</h3>
          <Button onClick={handleSaveCustomTheme} disabled={savingTheme} className="bg-violet-600 hover:bg-violet-700">
            {savingTheme ? 'Saving...' : 'Save & Apply'}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <JuiceColorPicker label="Primary Color" color={customColors.primary} onChange={(color) => setCustomColors(prev => ({ ...prev, primary: color }))} />
          <JuiceColorPicker label="Secondary Color" color={customColors.secondary} onChange={(color) => setCustomColors(prev => ({ ...prev, secondary: color }))} />
          <JuiceColorPicker label="Background" color={customColors.background} onChange={(color) => setCustomColors(prev => ({ ...prev, background: color }))} />
          <JuiceColorPicker label="Surface" color={customColors.surface} onChange={(color) => setCustomColors(prev => ({ ...prev, surface: color }))} />
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: customColors.background }}>
          <p className="text-sm text-gray-500 mb-2">Preview</p>
          <div className="p-3 rounded-lg" style={{ backgroundColor: customColors.surface }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${customColors.primary}, ${customColors.secondary})` }} />
              <div>
                <p style={{ color: customColors.text_primary || '#fff' }}>Sample Title</p>
                <p className="text-sm" style={{ color: '#a1a1aa' }}>Sample description text</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: customColors.primary }}>Primary Button</button>
              <button className="px-4 py-2 rounded-lg text-white text-sm" style={{ backgroundColor: customColors.secondary }}>Secondary</button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" className="border-white/10 hover:bg-white/5"><Import className="w-4 h-4 mr-2" /> Import Theme</Button>
        <Button variant="outline" className="border-white/10 hover:bg-white/5"><FileJson className="w-4 h-4 mr-2" /> Export Theme</Button>
      </div>

      <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20">
        <p className="text-sm text-pink-400">
          <strong>Tip:</strong> Changes are applied instantly. Use the preview to see how colors look together before saving.
        </p>
      </div>
    </motion.div>
  );
};
