import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Users, Play, Copy, Tv2, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../services/api';
import { getWebSocketUrl } from '../lib/config';

// The server (WatchPartyConnectionManager) relays every text frame to ALL
// sockets in the party, including the sender. Tag outgoing frames with a
// per-tab id so our own echo can be dropped (we already render it locally).
export const shouldShowIncoming = (data, clientId) => !(data && data.client_id && data.client_id === clientId);

export const WatchPartyPage = () => {
  // partyCode = the party we are in; joinCode = what the user is typing.
  // (Binding the input straight to partyCode flipped the page into the
  // "in a party" view on the first keystroke.)
  const [partyCode, setPartyCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [partyStatus, setPartyStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const clientIdRef = useRef(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  const closeSocket = () => {
    const socket = wsRef.current;
    wsRef.current = null;
    if (socket) {
      // Detach handlers so an intentional close doesn't toast / append.
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      try { socket.close(); } catch { /* already closed */ }
    }
  };

  // Close the socket on unmount.
  useEffect(() => closeSocket, []);

  const connectWebSocket = (code) => {
    closeSocket();
    const socket = new WebSocket(getWebSocketUrl(`/api/watch-party/${encodeURIComponent(code)}/ws`));
    socket.onopen = () => toast.success('Connected to party');
    socket.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { data = { text: String(event.data), sender: 'Unknown' }; }
      if (!shouldShowIncoming(data, clientIdRef.current)) return;
      setMessages(prev => [...prev, data]);
    };
    socket.onerror = () => toast.error('WebSocket error');
    socket.onclose = () => { if (wsRef.current === socket) wsRef.current = null; toast.info('Disconnected from party'); };
    wsRef.current = socket;
  };

  const createParty = async () => {
    setLoading(true);
    try {
      const r = await apiClient.post('/watch-party/create', null, { params: { media_type: 'movie' } });
      setMessages([]);
      setPartyCode(r.data.party_code);
      setPartyStatus({ ...r.data, status: r.data.status || 'waiting' });
      connectWebSocket(r.data.party_code);
      toast.success('Party created! Share the code.');
    } catch (err) {
      toast.error('Failed to create party');
    } finally {
      setLoading(false);
    }
  };

  const joinParty = async () => {
    const code = joinCode.trim();
    if (!code) { toast.error('Enter a party code'); return; }
    setLoading(true);
    try {
      const r = await apiClient.get(`/watch-party/${encodeURIComponent(code)}`);
      setMessages([]);
      setPartyCode(code);
      setPartyStatus(r.data);
      connectWebSocket(code);
      toast.success('Joined party!');
    } catch (err) {
      toast.error('Party not found');
    } finally {
      setLoading(false);
    }
  };

  const leaveParty = () => {
    closeSocket();
    setPartyCode('');
    setJoinCode('');
    setPartyStatus(null);
    setMessages([]);
  };

  const sendMessage = () => {
    const text = chatInput.trim();
    const ws = wsRef.current;
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    const timestamp = Date.now();
    ws.send(JSON.stringify({ type: 'chat', text, sender: `Guest-${clientIdRef.current.slice(-4)}`, client_id: clientIdRef.current, timestamp }));
    setMessages(prev => [...prev, { text, sender: 'You', timestamp, self: true }]);
    setChatInput('');
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(partyCode);
      toast.success('Party code copied!');
    } catch {
      toast.error('Could not copy party code');
    }
  };

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
                <Input placeholder="Enter party code" value={joinCode} onChange={e => setJoinCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && joinParty()} className="w-48" data-testid="party-code-input" />
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
                <Button size="icon" variant="ghost" onClick={leaveParty} data-testid="leave-party-btn"><X className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="border rounded-lg h-96 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
                <AnimatePresence>
                  {messages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: msg.self ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} className={`flex ${msg.self ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 ${msg.self ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {!msg.self && <p className="text-xs font-semibold mb-1 opacity-70">{msg.sender || msg.user || 'Guest'}</p>}
                        <p className="text-sm">{msg.text ?? msg.message ?? ''}</p>
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

export default WatchPartyPage;
