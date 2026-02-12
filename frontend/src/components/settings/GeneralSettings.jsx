import { motion } from 'framer-motion';
import { Folder } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export const GeneralSettings = ({ 
  settings, 
  setSettings, 
  onSave, 
  saving 
}) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Folder className="w-5 h-5 text-violet-400" />
        General Settings
      </h2>

      <div className="grid gap-4">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Download Path</label>
          <Input
            value={settings.download_path}
            onChange={(e) => setSettings({ ...settings, download_path: e.target.value })}
            placeholder="/media/downloads"
            className="bg-white/5 border-white/10"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">Library Path</label>
          <Input
            value={settings.library_path}
            onChange={(e) => setSettings({ ...settings, library_path: e.target.value })}
            placeholder="/media/library"
            className="bg-white/5 border-white/10"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">Quality Preference</label>
          <select
            value={settings.quality_preference}
            onChange={(e) => setSettings({ ...settings, quality_preference: e.target.value })}
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
          >
            <option value="4k">4K / 2160p</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>
        </div>
      </div>

      <Button onClick={onSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </motion.div>
  );
};
