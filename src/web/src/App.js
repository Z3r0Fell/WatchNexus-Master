import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { GadgetProvider, useGadgets } from "./context/GadgetContext";
import { LicenseProvider } from "./context/LicenseContext";
import { FirstLaunchGate } from "./components/FirstLaunchGate";
import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";

// Lazy-loaded Pages (React.lazy + Suspense for code splitting)
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const AuthPage = lazy(() => import("./pages/AuthPage").then(m => ({ default: m.AuthPage })));
const AuthCallback = lazy(() => import("./pages/AuthCallback").then(m => ({ default: m.AuthCallback })));
const MoviesPage = lazy(() => import("./pages/MoviesPage").then(m => ({ default: m.MoviesPage })));
const TVShowsPage = lazy(() => import("./pages/TVShowsPage").then(m => ({ default: m.TVShowsPage })));
const MediaDetails = lazy(() => import("./pages/MediaDetails").then(m => ({ default: m.MediaDetails })));
const SearchPage = lazy(() => import("./pages/SearchPage").then(m => ({ default: m.SearchPage })));
const IndexerSearchPage = lazy(() => import("./pages/IndexerSearchPage"));
const DownloadsPage = lazy(() => import("./pages/DownloadsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const StreamingPage = lazy(() => import("./pages/StreamingPage").then(m => ({ default: m.StreamingPage })));
const MusicPage = lazy(() => import("./pages/MusicPage").then(m => ({ default: m.MusicPage })));
const AudiobooksPage = lazy(() => import("./pages/AudiobooksPage").then(m => ({ default: m.AudiobooksPage })));
const LiveTVPage = lazy(() => import("./pages/LiveTVPage").then(m => ({ default: m.LiveTVPage })));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const WatchPartyPage = lazy(() => import("./pages/WatchPartyPage"));
const PluginMarketplacePage = lazy(() => import("./pages/PluginMarketplacePage"));
const ThemeCommunityPage = lazy(() => import("./pages/ThemeCommunityPage").then(m => ({ default: m.ThemeCommunityPage })));

const PlaylistsPage = lazy(() => import("./pages/PlaylistsPage"));
const AnimePage = lazy(() => import("./pages/AnimePage"));
import VideoPlayer from "./components/VideoPlayer";
const WatchHistoryPage = lazy(() => import("./pages/WatchHistoryPage"));
const WatchlistPage = lazy(() => import("./pages/WatchlistPage"));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));

// Admin / Security / VPN / System
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const VpnPage = lazy(() => import("./pages/VpnPage"));
const SystemPage = lazy(() => import("./pages/SystemPage"));
const LibraryManagerPage = lazy(() => import("./pages/LibraryManagerPage"));
const LogViewerPage = lazy(() => import("./pages/LogViewerPage"));
const MediaBrowserPage = lazy(() => import("./pages/MediaBrowserPage"));

// Gadget Pages
const WeatherPage = lazy(() => import("./pages/gadgets/WeatherPage"));
const PodcastsPage = lazy(() => import("./pages/gadgets/PodcastsPage"));
const RadioPage = lazy(() => import("./pages/gadgets/RadioPage"));
const PhotosPage = lazy(() => import("./pages/gadgets/PhotosPage"));
const WebVideoPage = lazy(() => import("./pages/gadgets/WebVideoPage"));
const SpotdlPage = lazy(() => import("./pages/gadgets/SpotdlPage"));
const AnalyticsPage = lazy(() => import("./pages/gadgets/AnalyticsPage"));
const NotificationsPage = lazy(() => import("./pages/gadgets/NotificationsPage"));
const RequestsPage = lazy(() => import("./pages/gadgets/RequestsPage"));
const ParentalControlsPage = lazy(() => import("./pages/gadgets/ParentalControlsPage"));
const ProcessingPage = lazy(() => import("./pages/gadgets/ProcessingPage"));
const UsenetPage = lazy(() => import("./pages/gadgets/UsenetPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
import { TierGate } from "./components/TierGate";

// Module Pages
const GlazePage = lazy(() => import("./pages/GlazePage"));
const SaffronPage = lazy(() => import("./pages/SaffronPage"));
const FonduePage = lazy(() => import("./pages/FonduePage"));
const SourdoughPage = lazy(() => import("./pages/SourdoughPage"));
const ChurroPage = lazy(() => import("./pages/ChurroPage"));
const RouxPage = lazy(() => import("./pages/RouxPage"));
const SproutPage = lazy(() => import("./pages/SproutPage"));
const StrudelPage = lazy(() => import("./pages/StrudelPage"));
const ParfaitPage = lazy(() => import("./pages/ParfaitPage"));
const MenuPage = lazy(() => import("./pages/MenuPage"));
const PretzelPage = lazy(() => import("./pages/PretzelPage"));
const BiscottiPage = lazy(() => import("./pages/BiscottiPage"));
const TreaclePage = lazy(() => import("./pages/TreaclePage"));
const SagePage = lazy(() => import("./pages/SagePage"));
const TerrinePage = lazy(() => import("./pages/TerrinePage"));
const PopsiclePage = lazy(() => import("./pages/PopsiclePage"));
const PreservesPage = lazy(() => import("./pages/PreservesPage"));
const MarshmallowPage = lazy(() => import("./pages/MarshmallowPage"));
const ChowderPage = lazy(() => import("./pages/ChowderPage"));

import "./App.css";

// Gadget Pages - Currently none are functional
// When gadgets are properly implemented, they will be registered here dynamically

const GADGET_PAGE_MAP = {
  // Gadget pages will be added here when they become functional
};

const GadgetPageLoader = () => (
  <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Skip auth check if user data was passed from OAuth callback
  if (location.state?.user) {
    return children;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Protected + Tier-gated Route
const TierRoute = ({ children, path }) => {
  return (
    <ProtectedRoute>
      <TierGate path={path}>
        {children}
      </TierGate>
    </ProtectedRoute>
  );
};

// Public Route (redirect to home if logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Router wrapper to detect OAuth callback synchronously
function AppRouter() {
  const location = useLocation();
  
  // CRITICAL: Check URL fragment for session_id synchronously during render
  // This prevents race conditions by processing OAuth callback BEFORE checking existing auth
  if (location.hash?.includes('session_id=')) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>}>
        <AuthCallback />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>}>
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <AuthPage />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/movies"
        element={
          <ProtectedRoute>
            <MoviesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tv"
        element={
          <ProtectedRoute>
            <TVShowsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:type/:id"
        element={
          <ProtectedRoute>
            <MediaDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <SearchPage />
          </ProtectedRoute>
        }
      />
      <Route path="/indexers" element={<TierRoute path="/indexers"><IndexerSearchPage /></TierRoute>} />
      <Route
        path="/downloads"
        element={
          <ProtectedRoute>
            <DownloadsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <LibraryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/watch/:mediaId"
        element={
          <ProtectedRoute>
            <VideoPlayer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/anime"
        element={
          <ProtectedRoute>
            <AnimePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/streaming" element={<TierRoute path="/streaming"><StreamingPage /></TierRoute>} />
      <Route
        path="/music"
        element={
          <ProtectedRoute>
            <MusicPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audiobooks"
        element={
          <ProtectedRoute>
            <AudiobooksPage />
          </ProtectedRoute>
        }
      />
      <Route path="/live" element={<TierRoute path="/live"><LiveTVPage /></TierRoute>} />
      <Route path="/party/:partyCode" element={<TierRoute path="/party"><WatchPartyPage /></TierRoute>} />
      <Route
        path="/plugins"
        element={
          <ProtectedRoute>
            <PluginMarketplacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/themes"
        element={
          <ProtectedRoute>
            <ThemeCommunityPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/playlists"
        element={
          <ProtectedRoute>
            <PlaylistsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/history" element={<TierRoute path="/history"><WatchHistoryPage /></TierRoute>} />
      <Route
        path="/watchlist"
        element={
          <ProtectedRoute>
            <WatchlistPage />
          </ProtectedRoute>
        }
      />
      <Route path="/discover" element={<TierRoute path="/discover"><DiscoverPage /></TierRoute>} />

      {/* Gadget Pages */}
      <Route
        path="/weather"
        element={
          <ProtectedRoute>
            <WeatherPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/podcasts"
        element={
          <ProtectedRoute>
            <PodcastsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/radio"
        element={
          <ProtectedRoute>
            <RadioPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/photos"
        element={
          <ProtectedRoute>
            <PhotosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/webvideo"
        element={
          <ProtectedRoute>
            <WebVideoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/spotdl"
        element={
          <ProtectedRoute>
            <SpotdlPage />
          </ProtectedRoute>
        }
      />
      <Route path="/security" element={<TierRoute path="/security"><SecurityPage /></TierRoute>} />
      <Route path="/vpn" element={<TierRoute path="/vpn"><VpnPage /></TierRoute>} />
      <Route
        path="/system"
        element={
          <ProtectedRoute>
            <SystemPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library-manager"
        element={
          <ProtectedRoute>
            <LibraryManagerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/log-viewer"
        element={
          <ProtectedRoute>
            <LogViewerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/browse"
        element={
          <ProtectedRoute>
            <MediaBrowserPage />
          </ProtectedRoute>
        }
      />
      <Route path="/analytics" element={<TierRoute path="/analytics"><AnalyticsPage /></TierRoute>} />
      <Route path="/notifications" element={<TierRoute path="/notifications"><NotificationsPage /></TierRoute>} />
      <Route path="/requests" element={<TierRoute path="/requests"><RequestsPage /></TierRoute>} />
      <Route path="/parental-controls" element={<TierRoute path="/parental-controls"><ParentalControlsPage /></TierRoute>} />
      <Route path="/processing" element={<TierRoute path="/processing"><ProcessingPage /></TierRoute>} />
      <Route path="/usenet" element={<TierRoute path="/usenet"><UsenetPage /></TierRoute>} />
      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <HelpPage />
          </ProtectedRoute>
        }
      />

      {/* Module Pages */}
      <Route path="/scrobbling" element={<ProtectedRoute><GlazePage /></ProtectedRoute>} />
      <Route path="/tasks" element={<TierRoute path="/tasks"><SaffronPage /></TierRoute>} />
      <Route path="/automation" element={<TierRoute path="/automation"><FonduePage /></TierRoute>} />
      <Route path="/backups" element={<TierRoute path="/backups"><SourdoughPage /></TierRoute>} />
      <Route path="/download-clients" element={<ProtectedRoute><ChurroPage /></ProtectedRoute>} />
      <Route path="/collections" element={<ProtectedRoute><RouxPage /></ProtectedRoute>} />
      <Route path="/rss" element={<TierRoute path="/rss"><SproutPage /></TierRoute>} />
      <Route path="/disc-ripping" element={<TierRoute path="/disc-ripping"><StrudelPage /></TierRoute>} />
      <Route path="/jellyseerr" element={<TierRoute path="/jellyseerr"><ParfaitPage /></TierRoute>} />
      <Route path="/requests-manager" element={<TierRoute path="/requests-manager"><MenuPage /></TierRoute>} />
      <Route path="/gaming" element={<TierRoute path="/gaming"><PretzelPage /></TierRoute>} />
      <Route path="/ebooks" element={<TierRoute path="/ebooks"><BiscottiPage /></TierRoute>} />
      <Route path="/music-library" element={<TierRoute path="/music-library"><TreaclePage /></TierRoute>} />
      <Route path="/for-you" element={<TierRoute path="/for-you"><SagePage /></TierRoute>} />
      <Route path="/dvr" element={<TierRoute path="/dvr"><TerrinePage /></TierRoute>} />
      <Route path="/offline" element={<TierRoute path="/offline"><PopsiclePage /></TierRoute>} />
      <Route path="/cloud-backup" element={<TierRoute path="/cloud-backup"><PreservesPage /></TierRoute>} />
      <Route path="/cloud-sync" element={<TierRoute path="/cloud-sync"><MarshmallowPage /></TierRoute>} />
      <Route path="/media-sync" element={<TierRoute path="/media-sync"><ChowderPage /></TierRoute>} />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <GadgetProvider>
              <LicenseProvider>
                <FirstLaunchGate>
                  <AppRouter />
                </FirstLaunchGate>
                <Toaster 
                  position="bottom-right" 
                  toastOptions={{
                    style: {
                      background: '#1E1E1E',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#F3F4F6',
                    },
                  }}
                />
              </LicenseProvider>
            </GadgetProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
