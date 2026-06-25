import { BACKEND_URL } from '../lib/config';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, Home, Globe, Users, ChevronRight, Wifi } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import axios from 'axios';

// Check if IP is local/private network
const isLocalNetwork = () => {
  const hostname = window.location.hostname;
  
  // Check for localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  
  // Check for private IP ranges
  const privateRanges = [
    /^10\./,                          // 10.0.0.0 - 10.255.255.255
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0 - 172.31.255.255
    /^192\.168\./,                    // 192.168.0.0 - 192.168.255.255
    /^169\.254\./,                    // Link-local
    /^fc00:/,                         // IPv6 unique local
    /^fe80:/,                         // IPv6 link-local
  ];
  
  return privateRanges.some(range => range.test(hostname));
};

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, loginWithToken, register } = useAuth();
  const navigate = useNavigate();
  
  // Local/Remote detection
  const [isLocal, setIsLocal] = useState(false);
  const [authMode, setAuthMode] = useState('auto'); // 'auto', 'local', 'remote'
  const [localUsers, setLocalUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserSelect, setShowUserSelect] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    const local = isLocalNetwork();
    setIsLocal(local);
    setAuthMode(local ? 'local' : 'remote');
    
    // If local, fetch available users
    if (local) {
      fetchLocalUsers();
    }
  }, []);

  const fetchLocalUsers = async () => {
    setLoadingUsers(true);
    try {
      // Fetch users without auth for local network profile selection
      const res = await axios.get(`${BACKEND_URL}/api/users/profiles`);
      setLocalUsers(res.data || []);
    } catch (error) {
      // If endpoint doesn't exist or fails, fall back to regular login
      console.log('Local user profiles not available, using standard login');
      setLocalUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Welcome back!');
      } else {
        await register(email, password, username);
        toast.success('Account created successfully!');
      }
      navigate('/');
    } catch (error) {
      const message = error.response?.data?.detail || 'Authentication failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocalUserLogin = async (user) => {
    // Check if user has a PIN
    try {
      const pinCheck = await axios.get(`${BACKEND_URL}/api/users/${user.id}/has-pin`);
      
      if (pinCheck.data.has_pin) {
        // User has PIN - show PIN entry
        setSelectedUser({ ...user, requiresPin: true });
        setShowUserSelect(false);
      } else {
        // No PIN - quick login directly
        await performQuickLogin(user.id);
      }
    } catch (error) {
      // If PIN check fails, fall back to password login
      setSelectedUser(user);
      setShowUserSelect(false);
      setEmail(user.email);
    }
  };

  const performQuickLogin = async (userId, pin = null) => {
    setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/users/quick-login`, {
        user_id: userId,
        pin: pin
      });
      
      // Store token and login - use 'token' key for consistency
      loginWithToken(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.username || 'User'}!`);
      navigate('/');
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Invalid PIN');
      } else if (error.response?.status === 403) {
        // Not on home network - fall back to password
        toast.error('Quick login only available on home network');
        setSelectedUser(prev => ({ ...prev, requiresPin: false }));
      } else {
        toast.error('Login failed. Please try with password.');
        setSelectedUser(prev => ({ ...prev, requiresPin: false }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (pin) => {
    if (selectedUser?.id) {
      await performQuickLogin(selectedUser.id, pin);
    }
  };

  // Google OAuth removed in v1.0.0 RTP — WatchNexus is a self-hosted media
  // server with local-account auth only. No external dependencies, no third-
  // party identity providers, no analytics, no phone-home.

  // PIN Entry Component
  const PinEntry = ({ onSubmit, onCancel, username }) => {
    const [pin, setPin] = useState(['', '', '', '']);
    const inputRefs = [null, null, null, null];
    
    const handlePinChange = (index, value) => {
      if (!/^\d*$/.test(value)) return; // Only digits
      
      const newPin = [...pin];
      newPin[index] = value.slice(-1); // Only last character
      setPin(newPin);
      
      // Auto-focus next input
      if (value && index < 3) {
        inputRefs[index + 1]?.focus();
      }
      
      // Auto-submit when complete
      if (index === 3 && value) {
        const fullPin = newPin.join('');
        if (fullPin.length === 4) {
          onSubmit(fullPin);
        }
      }
    };
    
    const handleKeyDown = (index, e) => {
      if (e.key === 'Backspace' && !pin[index] && index > 0) {
        inputRefs[index - 1]?.focus();
      }
    };
    
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/30 flex items-center justify-center text-2xl">
          {username?.charAt(0).toUpperCase() || '👤'}
        </div>
        <h2 className="text-xl font-bold mb-2">Enter PIN</h2>
        <p className="text-gray-400 text-sm mb-6">Enter your 4-digit PIN to continue</p>
        
        <div className="flex justify-center gap-3 mb-6">
          {pin.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs[index] = el}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handlePinChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-2xl font-bold rounded-xl bg-white/10 border border-white/20 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
              autoFocus={index === 0}
              data-testid={`pin-input-${index}`}
            />
          ))}
        </div>
        
        <button
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          data-testid="pin-cancel-btn"
        >
          Use password instead
        </button>
      </div>
    );
  };

  // User Profile Card Component
  const UserProfileCard = ({ user, onClick }) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(user)}
      data-testid={`user-profile-${user.id}`}
      className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/50 transition-all flex items-center gap-4 text-left"
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
        user.avatar_color || 'bg-violet-500/30'
      }`}>
        {user.avatar || user.username?.charAt(0).toUpperCase() || '👤'}
      </div>
      <div className="flex-1">
        <p className="font-medium text-white">{user.username}</p>
        <p className="text-sm text-gray-400">{user.email}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-500" />
    </motion.button>
  );

  return (
    <div
      data-testid="auth-page"
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
    >
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1762278804729-13d330fad71a?w=1920)',
        }}
      />
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="absolute inset-0 brand-glow" />
      <div className="noise-overlay" />

      {/* Language picker — top right */}
      <div className="absolute top-4 right-4 z-20" data-testid="auth-language-picker">
        <LanguageSwitcher compact align="right" />
      </div>

      {/* Form Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="glass-card rounded-2xl p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <img 
              src="https://customer-assets.emergentagent.com/job_viewhub-1008/artifacts/z5wboqjd_image.png" 
              alt="WatchNexus" 
              className="h-12 w-auto"
            />
          </div>

          {/* Network Status Badge */}
          <div className="flex justify-center mb-6">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              isLocal 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}>
              {isLocal ? (
                <>
                  <Home className="w-3.5 h-3.5" />
                  Home Network
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  Remote Access
                </>
              )}
            </div>
          </div>

          {/* Local User Selection Mode */}
          <AnimatePresence mode="wait">
            {isLocal && localUsers.length > 0 && !selectedUser && (
              <motion.div
                key="user-select"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                data-testid="whos-watching"
              >
                <h1 className="text-2xl font-bold text-center mb-2">Who's Watching?</h1>
                <p className="text-gray-400 text-center mb-6">Select your profile to continue</p>
                
                <div className="space-y-3 mb-6">
                  {loadingUsers ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-gray-400 text-sm">Loading profiles...</p>
                    </div>
                  ) : (
                    localUsers.map((user) => (
                      <UserProfileCard 
                        key={user.id} 
                        user={user} 
                        onClick={handleLocalUserLogin}
                      />
                    ))
                  )}
                </div>

                {/* Switch to manual login */}
                <button
                  onClick={() => setSelectedUser({ manual: true })}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  data-testid="manual-login-btn"
                >
                  Sign in with different account
                </button>
              </motion.div>
            )}

            {/* PIN Entry Mode */}
            {selectedUser?.requiresPin && (
              <motion.div
                key="pin-entry"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                data-testid="pin-entry-screen"
              >
                <PinEntry
                  username={selectedUser.username}
                  onSubmit={handlePinSubmit}
                  onCancel={() => {
                    setSelectedUser({ ...selectedUser, requiresPin: false });
                    setEmail(selectedUser.email);
                  }}
                />
                {loading && (
                  <div className="text-center mt-4">
                    <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Password Entry for Selected User OR Standard Login */}
            {((selectedUser && !selectedUser.requiresPin) || !isLocal || localUsers.length === 0) && !selectedUser?.requiresPin && (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Show selected user info */}
                {selectedUser && !selectedUser.manual && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mb-6">
                    <div className="w-10 h-10 rounded-full bg-violet-500/30 flex items-center justify-center">
                      {selectedUser.avatar || selectedUser.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{selectedUser.username}</p>
                      <p className="text-sm text-gray-400">{selectedUser.email}</p>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-gray-500 hover:text-white text-sm"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Title */}
                <h1 className="text-2xl font-bold text-center mb-2">
                  {selectedUser && !selectedUser.manual 
                    ? 'Enter Password' 
                    : isLogin ? 'Welcome Back' : 'Create Account'}
                </h1>
                <p className="text-gray-400 text-center mb-6">
                  {selectedUser && !selectedUser.manual
                    ? 'Verify your identity to continue'
                    : isLogin
                      ? 'Sign in to access your media library'
                      : 'Start your streaming journey'}
                </p>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        data-testid="username-input"
                        className="pl-10 bg-white/5 border-white/10 focus:border-violet-500 h-12"
                        required
                      />
                    </div>
                  )}

                  {/* Only show email field if not using selected user */}
                  {(!selectedUser || selectedUser.manual) && (
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        data-testid="email-input"
                        className="pl-10 bg-white/5 border-white/10 focus:border-violet-500 h-12"
                        required
                      />
                    </div>
                  )}

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="password-input"
                      className="pl-10 pr-10 bg-white/5 border-white/10 focus:border-violet-500 h-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    data-testid="auth-submit-btn"
                    disabled={loading}
                    className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl btn-glow"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : isLogin ? (
                      'Sign In'
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>

                {/* Public sign-up is disabled — a server administrator creates accounts. */}

                {/* Back to profile selection for local */}
                {isLocal && localUsers.length > 0 && selectedUser && (
                  <button
                    onClick={() => {
                      setSelectedUser(null);
                      setEmail('');
                      setPassword('');
                    }}
                    className="w-full text-center mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    ← Back to profile selection
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Connection Info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
            <Wifi className="w-3 h-3" />
            {isLocal ? 'Connected via local network' : 'Connected via internet'}
          </p>
        </div>
      </motion.div>
    </div>
  );
};
