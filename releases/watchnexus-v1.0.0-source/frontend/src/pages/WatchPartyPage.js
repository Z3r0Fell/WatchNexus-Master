import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { watchPartyApi, gelatinApi } from '../services/api';
import { toast } from 'sonner';
import { 
  Users, Play, Pause, Volume2, VolumeX, Maximize, 
  Send, Copy, Share2, Crown, CheckCircle, X,
  Clock, MessageCircle, Smile, ExternalLink, Wifi
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏'];

export const WatchPartyPage = () => {
  const { partyCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // State
  const [party, setParty] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [reactions, setReactions] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showReactions, setShowReactions] = useState(false);
  
  // Video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  // Refs
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const chatContainerRef = useRef(null);
  const reconnectAttempts = useRef(0);
  
  // Get user info from localStorage or session
  const getUserInfo = () => {
    const stored = localStorage.getItem('watchnexus_user');
    if (stored) {
      const user = JSON.parse(stored);
      return { id: user.id || user._id, username: user.username || user.email?.split('@')[0] || 'Guest' };
    }
    return { id: `guest_${Math.random().toString(36).substr(2, 9)}`, username: 'Guest' };
  };
  
  // Connect to WebSocket
  const connectWebSocket = useCallback((action = 'join') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    const user = getUserInfo();
    const wsUrl = watchPartyApi.getWebSocketUrl(partyCode);
    
    console.log('Connecting to Watch Party:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts.current = 0;
      
      // Send auth message
      ws.send(JSON.stringify({
        type: 'auth',
        user_id: user.id,
        username: user.username,
        action: action,
        token: localStorage.getItem('token'),
        ...location.state, // media info if creating
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
    
    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setConnected(false);
      
      // Attempt reconnect
      if (reconnectAttempts.current < 5) {
        reconnectAttempts.current++;
        setTimeout(() => connectWebSocket('join'), 2000 * reconnectAttempts.current);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [partyCode, location.state]);
  
  // Handle incoming messages
  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'party_joined':
        setParty(data.party);
        setConnected(true);
        setIsHost(data.party.host_id === getUserInfo().id);
        setLoading(false);
        toast.success('Joined watch party!');
        break;
        
      case 'party_update':
        setParty(data.party);
        setIsHost(data.party.host_id === getUserInfo().id);
        break;
        
      case 'sync':
        // Sync playback state
        setIsPlaying(data.is_playing);
        setCurrentTime(data.current_time);
        
        if (videoRef.current) {
          const diff = Math.abs(videoRef.current.currentTime - data.current_time);
          if (diff > 2 || data.resync) {
            videoRef.current.currentTime = data.current_time;
          }
          
          if (data.is_playing && videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
          } else if (!data.is_playing && !videoRef.current.paused) {
            videoRef.current.pause();
          }
        }
        break;
        
      case 'chat':
        setMessages(prev => [...prev.slice(-99), data.message]);
        // Auto-scroll chat
        if (chatContainerRef.current) {
          setTimeout(() => {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }, 50);
        }
        break;
        
      case 'reaction':
        // Show floating reaction
        const id = Date.now();
        setReactions(prev => [...prev, { id, emoji: data.emoji, username: data.username }]);
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== id));
        }, 3000);
        break;
        
      case 'error':
        toast.error(data.message);
        setLoading(false);
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  }, []);
  
  // Initialize
  useEffect(() => {
    const fetchPartyInfo = async () => {
      try {
        const res = await watchPartyApi.get(partyCode);
        
        if (res.data.status === 'pending') {
          // This is a new party being created
          connectWebSocket('create');
        } else {
          // Existing party, join it
          setParty(res.data);
          connectWebSocket('join');
        }
        
        // Get share URL
        const shareRes = await gelatinApi.getShareLink(partyCode, false);
        setShareUrl(shareRes.data.share_link);
        
      } catch (error) {
        if (location.state?.media_id) {
          // Creating new party
          connectWebSocket('create');
        } else {
          toast.error('Party not found');
          setLoading(false);
        }
      }
    };
    
    fetchPartyInfo();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [partyCode, connectWebSocket, location.state]);
  
  // Send message
  const sendMessage = () => {
    if (!newMessage.trim() || !wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'chat',
      message: newMessage.trim(),
    }));
    
    setNewMessage('');
  };
  
  // Send reaction
  const sendReaction = (emoji) => {
    if (!wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'reaction',
      emoji,
    }));
    
    setShowReactions(false);
  };
  
  // Toggle ready state
  const toggleReady = () => {
    if (!wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'ready',
      ready: !isReady,
    }));
    
    setIsReady(!isReady);
  };
  
  // Host controls
  const hostPlay = () => {
    if (!wsRef.current || !isHost) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'play',
      time: videoRef.current?.currentTime || 0,
    }));
  };
  
  const hostPause = () => {
    if (!wsRef.current || !isHost) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'pause',
      time: videoRef.current?.currentTime || 0,
    }));
  };
  
  const hostSeek = (time) => {
    if (!wsRef.current || !isHost) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'seek',
      time,
    }));
  };
  
  // Copy share link
  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl || `${window.location.origin}/party/${partyCode}`);
    toast.success('Link copied to clipboard!');
  };
  
  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Connecting to watch party...</p>
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div data-testid="watch-party-page" className="min-h-screen p-4 md:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-600 to-violet-500 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                Watch Party
                {connected && (
                  <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                    Live
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-400">
                {party?.media_title || 'Starting...'}
              </p>
            </div>
          </div>
          
          {/* Share Button */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <span className="text-sm font-mono text-violet-400">{partyCode}</span>
            </div>
            <Button onClick={copyShareLink} variant="outline" className="border-white/10">
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
          </div>
        </motion.div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Video Player */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-video bg-black rounded-xl overflow-hidden"
            >
              {/* Actual Video Player - connects to Marmalade */}
              {party?.media_id ? (
                <video
                  ref={videoRef}
                  src={`${process.env.REACT_APP_BACKEND_URL}/api/marmalade/stream/${party.media_id}/file`}
                  className="w-full h-full object-contain"
                  poster={party.media_poster || ''}
                  muted={isMuted}
                  onLoadedMetadata={(e) => setDuration(e.target.duration)}
                  onTimeUpdate={(e) => {
                    if (!isHost) return; // Only host updates time
                    setCurrentTime(e.target.currentTime);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-900/50 to-pink-900/50">
                  <div className="text-center">
                    <Play className="w-16 h-16 mx-auto mb-4 text-white/50" />
                    <p className="text-white/70">Waiting for media...</p>
                    <p className="text-sm text-white/50">Host will select content</p>
                  </div>
                </div>
              )}
              
              {/* Sync indicator */}
              {connected && party?.media_id && (
                <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-green-400 animate-pulse" />
                  <span className="text-xs text-white">Synced</span>
                </div>
              )}
              
              {/* Floating Reactions */}
              <AnimatePresence>
                {reactions.map((reaction) => (
                  <motion.div
                    key={reaction.id}
                    initial={{ opacity: 0, y: 50, x: Math.random() * 200 }}
                    animate={{ opacity: 1, y: -100 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-20 left-1/4 text-4xl pointer-events-none"
                  >
                    {reaction.emoji}
                    <span className="text-xs text-white bg-black/50 px-1 rounded ml-1">
                      {reaction.username}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                {/* Progress Bar */}
                <div className="mb-3">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={(e) => {
                      const time = parseFloat(e.target.value);
                      setCurrentTime(time);
                      if (isHost) hostSeek(time);
                    }}
                    disabled={!isHost}
                    className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-white/60 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
                
                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Play/Pause */}
                    {isHost ? (
                      <Button
                        onClick={isPlaying ? hostPause : hostPlay}
                        className="bg-white/20 hover:bg-white/30"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </Button>
                    ) : (
                      <div className="px-3 py-2 rounded-lg bg-white/10 text-sm text-white/60">
                        {isPlaying ? 'Playing' : 'Paused'}
                      </div>
                    )}
                    
                    {/* Volume */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setIsMuted(!isMuted)}
                        className="text-white"
                      >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </Button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-20 h-1 bg-white/20 rounded-full"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Reactions */}
                    <div className="relative">
                      <Button
                        variant="ghost"
                        onClick={() => setShowReactions(!showReactions)}
                        className="text-white"
                      >
                        <Smile className="w-5 h-5" />
                      </Button>
                      
                      <AnimatePresence>
                        {showReactions && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-full right-0 mb-2 p-2 rounded-lg bg-gray-900 border border-white/10 flex gap-1"
                          >
                            {REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => sendReaction(emoji)}
                                className="p-1 hover:bg-white/10 rounded text-xl"
                              >
                                {emoji}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    {/* Fullscreen */}
                    <Button variant="ghost" className="text-white">
                      <Maximize className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Host Controls Info */}
            {!isHost && (
              <div className="mt-2 px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-sm text-violet-400">
                <Crown className="w-4 h-4 inline mr-2" />
                Only the host can control playback. Sit back and enjoy!
              </div>
            )}
          </div>
          
          {/* Chat & Members Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* Members */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card rounded-xl p-4"
            >
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                Members ({party?.member_count || 0})
              </h3>
              
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {party?.members?.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                        {member.username[0].toUpperCase()}
                      </div>
                      <span className="text-sm">{member.username}</span>
                      {member.is_host && (
                        <Crown className="w-3 h-3 text-yellow-400" />
                      )}
                    </div>
                    {member.is_ready && (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Ready Toggle */}
              <Button
                onClick={toggleReady}
                variant="outline"
                className={`w-full mt-3 ${isReady ? 'border-green-500 text-green-400' : 'border-white/10'}`}
              >
                {isReady ? (
                  <><CheckCircle className="w-4 h-4 mr-2" /> Ready!</>
                ) : (
                  <>Click when ready</>
                )}
              </Button>
            </motion.div>
            
            {/* Chat */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-xl p-4 flex-1 flex flex-col min-h-[300px]"
            >
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-gray-400" />
                Chat
              </h3>
              
              {/* Messages */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto space-y-2 mb-3 max-h-[300px]"
              >
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-xs">Say hi to start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`text-sm ${msg.message_type === 'system' ? 'text-center text-gray-500 italic' : ''}`}
                    >
                      {msg.message_type !== 'system' && (
                        <span className="font-medium text-violet-400">{msg.username}: </span>
                      )}
                      <span className={msg.message_type === 'system' ? '' : 'text-gray-300'}>
                        {msg.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
              
              {/* Message Input */}
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="bg-white/5 border-white/10"
                />
                <Button onClick={sendMessage} className="bg-violet-600 hover:bg-violet-700">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default WatchPartyPage;
