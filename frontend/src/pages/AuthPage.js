import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, Home, Globe, Users, ChevronRight, Wifi } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
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
  const { login, register } = useAuth();
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
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/users/profiles`);
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
    setSelectedUser(user);
    setShowUserSelect(false);
    setEmail(user.email);
  };

  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  // User Profile Card Component
  const UserProfileCard = ({ user, onClick }) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(user)}
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
              >
                <h1 className="text-2xl font-bold text-center mb-2">Who's Watching?</h1>
                <p className="text-gray-400 text-center mb-6">Select your profile to continue</p>
                
                <div className="space-y-3 mb-6">
                  {localUsers.map((user) => (
                    <UserProfileCard 
                      key={user.id} 
                      user={user} 
                      onClick={handleLocalUserLogin}
                    />
                  ))}
                </div>

                {/* Switch to manual login */}
                <button
                  onClick={() => setSelectedUser({ manual: true })}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Sign in with different account
                </button>
              </motion.div>
            )}

            {/* Password Entry for Selected User OR Standard Login */}
            {(selectedUser || !isLocal || localUsers.length === 0) && (
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

                {/* Divider - only show for remote or manual login */}
                {(!isLocal || selectedUser?.manual || localUsers.length === 0) && (
                  <>
                    <div className="flex items-center gap-4 my-6">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-sm text-gray-500">or</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Google OAuth Button */}
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        data-testid="google-login-btn"
                        className="w-full h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-3 text-white hover:bg-white/10 transition-all"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                      </button>
                    </div>
                  </>
                )}

                {/* Toggle - only for remote/manual */}
                {(!isLocal || selectedUser?.manual || localUsers.length === 0) && (
                  <p className="text-center mt-6 text-gray-400">
                    {isLogin ? "Don't have an account? " : 'Already have an account? '}
                    <button
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      data-testid="toggle-auth-mode"
                      className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                    >
                      {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                  </p>
                )}

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
