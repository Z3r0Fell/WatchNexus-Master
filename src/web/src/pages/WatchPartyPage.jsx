import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Users, Play, Copy, Check, Tv2, Link2, MessageSquare, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';

export const WatchPartyPage = () => {
  const [partyCode, setPartyCode] = useState('');
  const [partyStatus, setPartyStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createParty = async () => {
    setLoading(true);
    try {
      const r = await axios.post(`${BACKEND_URL}/api/watch-party/create?media_type=movie`);
      setPartyCode(r.data.party_code);
      setPartyStatus({ ...r.data, status: 'waiting' });
      toast.success('Party created! Share the code.');
    } catch (err) {
      toast.error('Failed to create party');
    } finally {
      setLoading(false);
    }
  };

  const joinParty = async () => {
    if (!partyCode.trim()) { toast.error('Enter a party code'); return; }
    setLoading(true);
    try {
      const r = await axios.get(`${BACKEND_URL}/api/watch-party/${partyCode.trim()}`);
      setPartyStatus(r.data);
      connectWebSocket(partyCode.trim());
      toast.success('Joined party!');
    } catch (err) {
      toast.error('Party not found');
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = (code) => {
    if (ws) ws.close();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/watch-party/${code}/ws`;
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => toast.success('Connected to party');
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, data]);
      } catch { setMessages(prev => [...prev, { text: event.data, sender: 'Unknown' }]); }
    };
    socket.onerror = () => toast.error('WebSocket error');
    socket.onclose = () => toast.info('Disconnected from party');
    setWs(socket);
  };

  const sendMessage = () => {
    if (!chatInput.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ text: chatInput.trim(), sender: 'You', timestamp: Date.now() }));
    setMessages(prev => [...prev, { text: chatInput.trim(), sender: 'You', timestamp: Date.now(), self: true }]);
    setChatInput('');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(partyCode);
    toast.success('Party code copied!');
  };

  useEffect(() => {
    return () => { if (ws) ws.close(); };
  }, [ws]);

  return (
    <Layout title="Watch Party">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {!partyCode ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="text-center space-y-2">
              <Tv2 className="w-16 h-16 mx-auto text-primary" />
              <h1 className="text-3xl font-bold">Watch Party</h1>
              <p className="text-muted-foreground">Create or join a synchronized viewing session</p>
            </div>
            <div className="flex gap-4 justify-center">
              <Button onClick={createParty} disabled={loading} size="lg" className="gap-2">
                <Play className="w-5 h-5" /> Create Party
              </Button>
              <div className="flex gap-2">
                <Input placeholder="Enter party code" value={partyCode} onChange={e => setPartyCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && joinParty()} className="w-48" />
                <Button onClick={joinParty} disabled={loading} variant="secondary" size="lg">Join</Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">Watch Party</h2>
                  <p className="text-sm text-muted-foreground">Status: {partyStatus?.status || 'active'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="px-3 py-1 bg-muted rounded font-mono text-lg">{partyCode}</code>
                <Button size="icon" variant="ghost" onClick={copyCode}><Copy className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { setPartyCode(''); setPartyStatus(null); if (ws) ws.close(); }}><X className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="border rounded-lg h-96 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
                <AnimatePresence>
                  {messages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: msg.self ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} className={`flex ${msg.self ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 ${msg.self ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {!msg.self && <p className="text-xs font-semibold mb-1 opacity-70">{msg.sender}</p>}
                        <p className="text-sm">{msg.text}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t flex gap-2">
                <Input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." className="flex-1" />
                <Button onClick={sendMessage} size="icon"><Send className="w-4 h-4" /></Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};
