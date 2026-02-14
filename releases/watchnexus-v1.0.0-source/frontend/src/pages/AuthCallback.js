import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { toast } from 'sonner';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

export const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setIsAuthenticated } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Use useRef to prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processOAuthCallback = async () => {
      try {
        // Extract session_id from URL fragment (hash)
        const hash = location.hash;
        const sessionIdMatch = hash.match(/session_id=([^&]+)/);
        
        if (!sessionIdMatch) {
          toast.error('Invalid OAuth callback');
          navigate('/login');
          return;
        }

        const sessionId = sessionIdMatch[1];

        // Exchange session_id for session token
        const response = await authApi.googleSession(sessionId);
        const { user, session_token } = response.data;

        // Update auth context
        if (setUser) setUser(user);
        if (setIsAuthenticated) setIsAuthenticated(true);

        // Store token for JWT fallback
        localStorage.setItem('token', session_token);

        toast.success(`Welcome, ${user.username || user.email}!`);
        
        // Navigate to dashboard with user data
        navigate('/', { state: { user }, replace: true });
        
      } catch (error) {
        console.error('OAuth callback error:', error);
        toast.error('Authentication failed. Please try again.');
        navigate('/login');
      }
    };

    processOAuthCallback();
  }, [navigate, location.hash, setUser, setIsAuthenticated]);

  // Show minimal loading while processing (no UI flash)
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Completing sign in...</p>
      </div>
    </div>
  );
};
