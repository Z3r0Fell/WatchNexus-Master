import React, { useState, useEffect } from 'react';
import { FolderTree } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Quick-pick dropdown: lists the direct subfolders of the media root(s) the
// server can see (e.g. /data/media in Docker). Saves Docker users from typing
// a host path that doesn't exist inside the container.
const MediaFolderDropdown = ({ value, onChange }) => {
  const [roots, setRoots] = useState([]);
  const [subfolders, setSubfolders] = useState([]);
  const [root, setRoot] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/filesystem/browse`, { params: { path: '' } });
        if (!alive) return;
        const drives = res.data?.drives || [];
        const mediaDrives = drives
          .filter((d) => /media|data|movies|tv|series|music|anime/i.test(d.name) || d.name === 'Container Media')
          .map((d) => ({ name: d.name, path: d.path }));
        const candidates = [
          ...mediaDrives,
          ...(drives.filter((d) => d.path === '/data/media' || d.path === '/media' || d.path === '/mnt')),
        ];
        const unique = [];
        const seen = new Set();
        for (const c of candidates) {
          if (!seen.has(c.path)) { seen.add(c.path); unique.push(c); }
        }
        setRoots(unique);
        if (unique.length > 0) {
          const first = unique.find((r) => r.path === '/data/media') || unique[0];
          setRoot(first.path);
          setSubfolders(await fetchSubfolders(first.path, alive));
        }
      } catch { if (alive) setRoots([]); }
      finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSubfolders = async (path, alive = true) => {
    try {
      const res = await axios.get(`${API_URL}/api/filesystem/browse`, { params: { path } });
      if (!alive) return [];
      return (res.data?.items || [])
        .filter((i) => i.type === 'directory')
        .map((d) => d.path);
    } catch { return []; }
  };

  const onRootChange = async (e) => {
    const p = e.target.value;
    setRoot(p);
    const subs = await fetchSubfolders(p);
    setSubfolders(subs);
    onChange(subs[0] || p);
  };

  const onFolderChange = (e) => onChange(e.target.value);

  if (!loading && roots.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg bg-white/[0.03] border border-white/10 p-3">
      <p className="text-[11px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
        <FolderTree className="w-3.5 h-3.5" /> Quick pick from media folders
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={root}
          onChange={onRootChange}
          disabled={loading}
          data-testid="media-root-select"
          className="w-full h-9 px-2 rounded-md bg-white/5 border border-white/10 text-white text-sm"
        >
          {roots.map((r) => (
            <option key={r.path} value={r.path} className="bg-zinc-900">{r.name} ({r.path})</option>
          ))}
        </select>
        <select
          value={value}
          onChange={onFolderChange}
          disabled={loading || subfolders.length === 0}
          data-testid="media-subfolder-select"
          className="w-full h-9 px-2 rounded-md bg-white/5 border border-white/10 text-white text-sm"
        >
          {subfolders.length === 0 ? (
            <option value="" className="bg-zinc-900">No subfolders found</option>
          ) : (
            subfolders.map((p) => (
              <option key={p} value={p} className="bg-zinc-900">{p}</option>
            ))
          )}
        </select>
      </div>
      {value && (
        <p className="text-xs text-emerald-400 font-mono truncate" title={value}>
          Will use: {value}
        </p>
      )}
    </div>
  );
};

export default MediaFolderDropdown;
