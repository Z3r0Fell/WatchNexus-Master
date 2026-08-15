import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { BACKEND_URL } from '../lib/config';

const GadgetContext = createContext(null);

export const useGadgets = () => {
  const ctx = useContext(GadgetContext);
  if (!ctx) throw new Error('useGadgets must be used within GadgetProvider');
  return ctx;
};

export const GadgetProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [installed, setInstalled] = useState([]);
  const [hooks, setHooks] = useState({
    sidebar_entries: [], routes: [], settings_panels: [],
    dashboard_widgets: [], theme_presets: [],
    providers: { metadata: [], subtitle: [], notification: [], indexer: [], streaming: [], sync: [], auth: [] },
    enhanced_pages: [], background_services: [],
  });
  const [loading, setLoading] = useState(true);

  // Cookie auth: the httpOnly wn_token is sent automatically by axios.
  const refresh = useCallback(async () => {
    try {
      const [instRes, hooksRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/ripen/installed`),
        axios.get(`${BACKEND_URL}/api/ripen/hooks`),
      ]);
      setInstalled(instRes.data.gadgets || []);
      setHooks(prev => hooksRes.data || prev);
    } catch (err) {
      if (err.response?.status !== 401) console.error('Ripen: Failed to load gadgets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on login; clear on logout.
  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    } else {
      setInstalled([]);
      setLoading(false);
    }
  }, [isAuthenticated, refresh]);

  const install = useCallback(async (gadgetId) => {
    const res = await axios.post(`${BACKEND_URL}/api/ripen/install/${gadgetId}`, {});
    await refresh();
    return res.data;
  }, [refresh]);

  const uninstall = useCallback(async (gadgetId) => {
    await axios.delete(`${BACKEND_URL}/api/ripen/uninstall/${gadgetId}`);
    await refresh();
  }, [refresh]);

  const activate = useCallback(async (gadgetId) => {
    await axios.post(`${BACKEND_URL}/api/ripen/activate/${gadgetId}`, {});
    await refresh();
  }, [refresh]);

  const deactivate = useCallback(async (gadgetId) => {
    await axios.post(`${BACKEND_URL}/api/ripen/deactivate/${gadgetId}`, {});
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
