import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/config';

const API = API_URL;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // S-02: the JWT lives in an httpOnly cookie the browser sends automatically.
  // We never read/store it in JS. Auth state is derived from a /users/me probe.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/users/me`, { withCredentials: true });
      const d = response.data;
      // Normalize PascalCase to lowercase for consistent access
      const normalized = {
        id: d.Id || d.id,
        email: d.Email || d.email,
        username: d.Username || d.username,
        avatar: d.Avatar || d.avatar,
        role: d.Role || d.role,
        created_at: d.CreatedAt || d.created_at,
      };
      setUser(normalized);
      setIsAuthenticated(true);
      return normalized;
    } catch (error) {
      if (error.response?.status === 401) {
        setUser(null);
        setIsAuthenticated(false);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email, password) => {
    // Backend sets the httpOnly auth cookie on success; we just sync state.
    const response = await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
    const { user: userData } = response.data;
    if (userData) {
      setUser(userData);
      setIsAuthenticated(true);
    } else {
      await fetchUser();
    }
    return userData;
  }, [fetchUser]);

  // Establish a session after the backend has already issued the auth cookie
  // (e.g. setup wizard / quick-login). No token handling in JS.
  const loginWithToken = useCallback((_token, userData) => {
    if (userData) {
      setUser(userData);
      setIsAuthenticated(true);
      return userData;
    }
    return fetchUser();
  }, [fetchUser]);

  const register = useCallback(async (email, password, username) => {
    const response = await axios.post(`${API}/auth/register`, { email, password, username }, { withCredentials: true });
    const { user: userData } = response.data;
    if (userData) {
      setUser(userData);
      setIsAuthenticated(true);
    }
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      // Ignore logout errors - we're clearing local state anyway
    }
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(() => ({
    user,
    setUser,
    loading,
    login,
    loginWithToken,
    register,
    logout,
    isAuthenticated,
  }), [user, loading, login, loginWithToken, register, logout, isAuthenticated]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
