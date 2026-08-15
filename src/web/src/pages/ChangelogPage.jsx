import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, FileText, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

export const ChangelogPage = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filteredLines, setFilteredLines] = useState([]);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/system/changelog`).then(r => {
      const text = r.data.content || '';
      setContent(text);
      setFilteredLines(text.split('\n'));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredLines(content.split('\n'));
      return;
    }
    const q = search.toLowerCase();
    const lines = content.split('\n');
    const matched = [];
    let block = [];
    for (const line of lines) {
      block.push(line);
      if (line.toLowerCase().includes(q) && block.length > 0) {
        matched.push(...block);
        block = [];
      }
      if (line.trim() === '' && block.length > 0) {
        if (block.some(l => l.toLowerCase().includes(q))) {
          matched.push(...block);
        }
        block = [];
      }
    }
    setFilteredLines(matched);
  }, [search, content]);

  const renderLine = (line, i) => {
    const trimmed = line.trimEnd();
    if (!trimmed) return <div key={i} className="h-2" />;
    if (trimmed.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-6 mb-2">{trimmed.slice(2)}</h1>;
    if (trimmed.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold mt-5 mb-2">{trimmed.slice(3)}</h2>;
    if (trimmed.startsWith('### ')) return <h3 key={i} className="text-lg font-medium mt-4 mb-1">{trimmed.slice(4)}</h3>;
    if (trimmed.startsWith('- **')) {
      const match = trimmed.match(/^- \*\*(.+?)\*\*[—–] (.+)$/);
      if (match) return <div key={i} className="ml-4 mb-1"><span className="font-semibold">{match[1]}</span><span className="text-muted-foreground"> — {match[2]}</span></div>;
    }
    if (trimmed.startsWith('- ')) return <li key={i} className="ml-4 mb-1 list-disc">{trimmed.slice(2)}</li>;
    if (trimmed.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-muted pl-3 italic text-muted-foreground">{trimmed.slice(2)}</blockquote>;
    if (trimmed.startsWith('```')) return null;
    if (/^\d+\./.test(trimmed)) return <li key={i} className="ml-4 mb-1 list-decimal">{trimmed.replace(/^\d+\.\s*/, '')}</li>;
    return <p key={i} className="mb-1 text-sm leading-relaxed">{trimmed}</p>;
  };

  return (
    <Layout title="Changelog">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><FileText className="w-8 h-8" /> Changelog</h1>
            <p className="text-muted-foreground mt-1">Release notes and version history for WatchNexus.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.open('https://github.com/Z3r0Fell/WatchNexus-Master/blob/main/CHANGELOG.md', '_blank')} className="gap-2">
            <ExternalLink className="w-4 h-4" /> View on GitHub
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search changelog..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {loading ? <div className="text-center py-12 text-muted-foreground">Loading changelog...</div> : (
          <div className="border rounded-lg p-6 bg-muted/10 space-y-1">
            {filteredLines.map((line, i) => renderLine(line, i))}
            {filteredLines.length === 0 && <p className="text-center text-muted-foreground py-8">No entries match your search.</p>}
          </div>
        )}
      </div>
    </Layout>
  );
};
