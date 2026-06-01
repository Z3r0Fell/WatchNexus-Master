import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const GadgetContext = createContext(null);

export const useGadgets = () => {
  const ctx = useContext(GadgetContext);
  if (!ctx) throw new Error('useGadgets must be used within GadgetProvider');
  return ctx;
};

export const GadgetProvider = ({ children }) => {
  const [installed, setInstalled] = useState([]);
  const [hooks, setHooks] = useState({
    sidebar_entries: [], routes: [], settings_panels: [],
    dashboard_widgets: [], theme_presets: [],
    providers: { metadata: [], subtitle: [], notification: [], indexer: [], streaming: [], sync: [], auth: [] },
    enhanced_pages: [], background_services: [],
  });
  const [loading, setLoading] = useState(true);

  const getAuth = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [instRes, hooksRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/ripen/installed`, { headers }),
        axios.get(`${BACKEND_URL}/api/ripen/hooks`, { headers }),
      ]);
      setInstalled(instRes.data.gadgets || []);
      setHooks(prev => hooksRes.data || prev);
    } catch (err) {
      console.error('Ripen: Failed to load gadgets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + listen for storage changes (login/logout)
  useEffect(() => {
    refresh();

    // Re-fetch when token changes (login/logout events)
    const handleStorage = (e) => {
      if (e.key === 'token') refresh();
    };
    window.addEventListener('storage', handleStorage);

    // Also poll for token changes (same-tab login won't fire storage event)
    let lastToken = localStorage.getItem('token');
    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('token');
      if (currentToken !== lastToken) {
        lastToken = currentToken;
        refresh();
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [refresh]);

  const install = useCallback(async (gadgetId) => {
    const res = await axios.post(`${BACKEND_URL}/api/ripen/install/${gadgetId}`, {}, { headers: getAuth() });
    await refresh();
    return res.data;
  }, [refresh]);

  const uninstall = useCallback(async (gadgetId) => {
    await axios.delete(`${BACKEND_URL}/api/ripen/uninstall/${gadgetId}`, { headers: getAuth() });
    await refresh();
  }, [refresh]);

  const activate = useCallback(async (gadgetId) => {
    await axios.post(`${BACKEND_URL}/api/ripen/activate/${gadgetId}`, {}, { headers: getAuth() });
    await refresh();
  }, [refresh]);

  const deactivate = useCallback(async (gadgetId) => {
    await axios.post(`${BACKEND_URL}/api/ripen/deactivate/${gadgetId}`, {}, { headers: getAuth() });
    await refresh();
  }, [refresh]);

  const isInstalled = useCallback((gadgetId) => installed.some(g => g.gadget_id === gadgetId), [installed]);
  const isActive = useCallback((gadgetId) => installed.some(g => g.gadget_id === gadgetId && g.status === 'active'), [installed]);
  const getGadget = useCallback((gadgetId) => installed.find(g => g.gadget_id === gadgetId), [installed]);

  const value = useMemo(() => ({
    installed, hooks, loading, refresh,
    install, uninstall, activate, deactivate,
    isInstalled, isActive, getGadget,
  }), [installed, hooks, loading, refresh, install, uninstall, activate, deactivate, isInstalled, isActive, getGadget]);

  return (
    <GadgetContext.Provider value={value}>
      {children}
    </GadgetContext.Provider>
  );
};
