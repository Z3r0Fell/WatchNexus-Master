import { useState } from 'react';
import { motion } from 'framer-motion';
import { Captions } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { settingsApi } from '../../services/api';

export const SubtitleSettings = () => {
  const [settings, setSettings] = useState({ auto_subtitles: true, subtitle_languages: ['en'] });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await settingsApi.update(settings); toast.success('Settings saved successfully'); }
    catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-6 space-y-6" data-testid="subtitle-settings">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Captions className="w-5 h-5 text-violet-400" /> Subtitle Settings
      </h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5">
          <div>
            <p className="font-medium">Auto-download Subtitles</p>
            <p className="text-sm text-gray-500">Automatically fetch subtitles for new media</p>
          </div>
          <Switch checked={settings.auto_subtitles}
            onCheckedChange={(checked) => setSettings({ ...settings, auto_subtitles: checked })} />
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Preferred Languages</label>
          <select multiple className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white h-32">
            <option value="en" defaultChecked>English</option>
            <option value="es">Spanish</option><option value="fr">French</option>
            <option value="de">German</option><option value="it">Italian</option>
            <option value="pt">Portuguese</option><option value="ja">Japanese</option>
            <option value="ko">Korean</option><option value="zh">Chinese</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </motion.div>
  );
};
