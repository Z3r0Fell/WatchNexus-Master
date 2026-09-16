import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { GadgetProvider } from "./context/GadgetContext";
import { LicenseProvider } from "./context/LicenseContext";
import { FirstLaunchGate } from "./components/FirstLaunchGate";
import { TierGate } from "./components/TierGate";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RouteErrorBoundary, withErrorBoundary } from "./components/RouteErrorBoundary";
import { ApiProvider } from "./services/enhancedApi";
import { lazy, Suspense } from "react";
import "./App.css";

// Eager: first-paint critical pages only.
import { Dashboard } from "./pages/Dashboard";
import { AuthPage } from "./pages/AuthPage";

// Lazy: everything else is code-split into its own chunk.
// Each route is wrapped with RouteErrorBoundary for crash isolation.
const MoviesPage = withErrorBoundary(lazy(() => import("./pages/MoviesPage").then(m => ({ default: m.MoviesPage }))), 'Movies');
const TVShowsPage = withErrorBoundary(lazy(() => import("./pages/TVShowsPage").then(m => ({ default: m.TVShowsPage }))), 'TV Shows');
const MediaDetails = withErrorBoundary(lazy(() => import("./pages/MediaDetails").then(m => ({ default: m.MediaDetails }))), 'Media Details');
const SearchPage = withErrorBoundary(lazy(() => import("./pages/SearchPage").then(m => ({ default: m.SearchPage }))), 'Search');
const IndexerSearchPage = withErrorBoundary(lazy(() => import("./pages/IndexerSearchPage").then(m => ({ default: m.IndexerSearchPage }))), 'Indexers');
const DownloadsPage = withErrorBoundary(lazy(() => import("./pages/DownloadsPage").then(m => ({ default: m.DownloadsPage }))), 'Downloads');
const SettingsPage = withErrorBoundary(lazy(() => import("./pages/SettingsPage").then(m => ({ default: m.SettingsPage }))), 'Settings');
const StreamingPage = withErrorBoundary(lazy(() => import("./pages/StreamingPage").then(m => ({ default: m.StreamingPage }))), 'Streaming');
const MusicPage = withErrorBoundary(lazy(() => import("./pages/MusicPage").then(m => ({ default: m.MusicPage }))), 'Music');
const AudiobooksPage = withErrorBoundary(lazy(() => import("./pages/AudiobooksPage").then(m => ({ default: m.AudiobooksPage }))), 'Audiobooks');
const LiveTVPage = withErrorBoundary(lazy(() => import("./pages/LiveTVPage").then(m => ({ default: m.LiveTVPage }))), 'Live TV');
const LibraryPage = withErrorBoundary(lazy(() => import("./pages/LibraryPage").then(m => ({ default: m.LibraryPage }))), 'Library');
const PluginMarketplacePage = withErrorBoundary(lazy(() => import("./pages/PluginMarketplacePage").then(m => ({ default: m.PluginMarketplacePage }))), 'Plugin Marketplace');
const ThemeCommunityPage = withErrorBoundary(lazy(() => import("./pages/ThemeCommunityPage").then(m => ({ default: m.ThemeCommunityPage }))), 'Themes');
const WatchHistoryPage = withErrorBoundary(lazy(() => import("./pages/WatchHistoryPage").then(m => ({ default: m.WatchHistoryPage }))), 'Watch History');
const WatchlistPage = withErrorBoundary(lazy(() => import("./pages/WatchlistPage").then(m => ({ default: m.WatchlistPage }))), 'Watchlist');
const DiscoverPage = withErrorBoundary(lazy(() => import("./pages/DiscoverPage").then(m => ({ default: m.DiscoverPage }))), 'Discover');
const PlaylistsPage = withErrorBoundary(lazy(() => import("./pages/PlaylistsPage")), 'Playlists');
const AnimePage = withErrorBoundary(lazy(() => import("./pages/AnimePage")), 'Anime');
const VideoPlayer = withErrorBoundary(lazy(() => import("./components/VideoPlayer")), 'Video Player');

// Admin / Security / VPN / System
const SecurityPage = withErrorBoundary(lazy(() => import("./pages/SecurityPage")), 'Security');
const VpnPage = withErrorBoundary(lazy(() => import("./pages/VpnPage")), 'VPN');
const SystemPage = withErrorBoundary(lazy(() => import("./pages/SystemPage")), 'System');
const LibraryManagerPage = withErrorBoundary(lazy(() => import("./pages/LibraryManagerPage")), 'Library Manager');
const LogViewerPage = withErrorBoundary(lazy(() => import("./pages/LogViewerPage")), 'Log Viewer');
const MediaBrowserPage = withErrorBoundary(lazy(() => import("./pages/MediaBrowserPage")), 'Media Browser');
const HelpPage = withErrorBoundary(lazy(() => import("./pages/HelpPage")), 'Help');

// Gadget Pages
const WeatherPage = withErrorBoundary(lazy(() => import("./pages/gadgets/WeatherPage")), 'Weather');
const PodcastsPage = withErrorBoundary(lazy(() => import("./pages/gadgets/PodcastsPage")), 'Podcasts');
const RadioPage = withErrorBoundary(lazy(() => import("./pages/gadgets/RadioPage")), 'Radio');
const PhotosPage = withErrorBoundary(lazy(() => import("./pages/gadgets/PhotosPage")), 'Photos');
const WebVideoPage = withErrorBoundary(lazy(() => import("./pages/gadgets/WebVideoPage")), 'Web Video');
const AnalyticsPage = withErrorBoundary(lazy(() => import("./pages/gadgets/AnalyticsPage")), 'Analytics');
const NotificationsPage = withErrorBoundary(lazy(() => import("./pages/gadgets/NotificationsPage")), 'Notifications');
const RequestsPage = withErrorBoundary(lazy(() => import("./pages/gadgets/RequestsPage")), 'Requests');
const ParentalControlsPage = withErrorBoundary(lazy(() => import("./pages/gadgets/ParentalControlsPage")), 'Parental Controls');
const ProcessingPage = withErrorBoundary(lazy(() => import("./pages/gadgets/ProcessingPage")), 'Processing');
const UsenetPage = withErrorBoundary(lazy(() => import("./pages/gadgets/UsenetPage")), 'Usenet');

// Module Pages
const GlazePage = withErrorBoundary(lazy(() => import("./pages/GlazePage")), 'Scrobbling');
const SaffronPage = withErrorBoundary(lazy(() => import("./pages/SaffronPage")), 'Tasks');
const FonduePage = withErrorBoundary(lazy(() => import("./pages/FonduePage")), 'Automation');
const SourdoughPage = withErrorBoundary(lazy(() => import("./pages/SourdoughPage")), 'Backups');
const ChurroPage = withErrorBoundary(lazy(() => import("./pages/ChurroPage")), 'Download Clients');
const RouxPage = withErrorBoundary(lazy(() => import("./pages/RouxPage")), 'Collections');
const SproutPage = withErrorBoundary(lazy(() => import("./pages/SproutPage")), 'RSS');
const StrudelPage = withErrorBoundary(lazy(() => import("./pages/StrudelPage")), 'Disc Ripping');
const ParfaitPage = withErrorBoundary(lazy(() => import("./pages/ParfaitPage")), 'Jellyseerr');
const MenuPage = withErrorBoundary(lazy(() => import("./pages/MenuPage")), 'Requests Manager');
const PretzelPage = withErrorBoundary(lazy(() => import("./pages/PretzelPage")), 'Gaming');
const BiscottiPage = withErrorBoundary(lazy(() => import("./pages/BiscottiPage")), 'Ebooks');
const TreaclePage = withErrorBoundary(lazy(() => import("./pages/TreaclePage")), 'Music Library');
const SagePage = withErrorBoundary(lazy(() => import("./pages/SagePage")), 'For You');
const TerrinePage = withErrorBoundary(lazy(() => import("./pages/TerrinePage")), 'DVR');
const PopsiclePage = withErrorBoundary(lazy(() => import("./pages/PopsiclePage")), 'Offline');
const PreservesPage = withErrorBoundary(lazy(() => import("./pages/PreservesPage")), 'Cloud Backup');
const MarshmallowPage = withErrorBoundary(lazy(() => import("./pages/MarshmallowPage")), 'Cloud Sync');
const ChowderPage = withErrorBoundary(lazy(() => import("./pages/ChowderPage")), 'Media Sync');
const WatchPartyPage = withErrorBoundary(lazy(() => import("./pages/WatchPartyPage")), 'Watch Party');
const LobsterPage = withErrorBoundary(lazy(() => import("./pages/LobsterPage")), 'Lobster');
const RoadmapPage = withErrorBoundary(lazy(() => import("./pages/RoadmapPage")), 'Roadmap');
const ChangelogPage = withErrorBoundary(lazy(() => import("./pages/ChangelogPage")), 'Changelog');

const PageLoader = () => (
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
    return <PageLoader />;
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
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Router wrapper.
// (Google OAuth callback handling was removed in v1.0.0 RTP — no
// third-party identity providers in a self-hosted media server.)
function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><AuthPage /></PublicRoute>} />

        {/* Protected Routes */}
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/movies" element={<ProtectedRoute><MoviesPage /></ProtectedRoute>} />
        <Route path="/tv" element={<ProtectedRoute><TVShowsPage /></ProtectedRoute>} />
        <Route path="/:type/:id" element={<ProtectedRoute><MediaDetails /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="/indexers" element={<TierRoute path="/indexers"><IndexerSearchPage /></TierRoute>} />
        <Route path="/downloads" element={<ProtectedRoute><DownloadsPage /></ProtectedRoute>} />
        <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
        <Route path="/watch/:mediaId" element={<ProtectedRoute><VideoPlayer /></ProtectedRoute>} />
        <Route path="/anime" element={<ProtectedRoute><AnimePage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/streaming" element={<TierRoute path="/streaming"><StreamingPage /></TierRoute>} />
        <Route path="/music" element={<ProtectedRoute><MusicPage /></ProtectedRoute>} />
        <Route path="/audiobooks" element={<ProtectedRoute><AudiobooksPage /></ProtectedRoute>} />
        <Route path="/live" element={<TierRoute path="/live"><LiveTVPage /></TierRoute>} />
        <Route path="/plugins" element={<ProtectedRoute><PluginMarketplacePage /></ProtectedRoute>} />
        <Route path="/themes" element={<ProtectedRoute><ThemeCommunityPage /></ProtectedRoute>} />
        <Route path="/playlists" element={<ProtectedRoute><PlaylistsPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><WatchHistoryPage /></ProtectedRoute>} />
        <Route path="/watchlist" element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} />
        <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />

        {/* Gadget Pages */}
        <Route path="/weather" element={<ProtectedRoute><WeatherPage /></ProtectedRoute>} />
        <Route path="/podcasts" element={<ProtectedRoute><PodcastsPage /></ProtectedRoute>} />
        <Route path="/radio" element={<ProtectedRoute><RadioPage /></ProtectedRoute>} />
        <Route path="/photos" element={<ProtectedRoute><PhotosPage /></ProtectedRoute>} />
        <Route path="/webvideo" element={<ProtectedRoute><WebVideoPage /></ProtectedRoute>} />
        <Route path="/security" element={<TierRoute path="/security"><SecurityPage /></TierRoute>} />
        <Route path="/vpn" element={<TierRoute path="/vpn"><VpnPage /></TierRoute>} />
        <Route path="/system" element={<ProtectedRoute><SystemPage /></ProtectedRoute>} />
        <Route path="/library-manager" element={<ProtectedRoute><LibraryManagerPage /></ProtectedRoute>} />
        <Route path="/log-viewer" element={<ProtectedRoute><LogViewerPage /></ProtectedRoute>} />
        <Route path="/browse" element={<ProtectedRoute><MediaBrowserPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<TierRoute path="/analytics"><AnalyticsPage /></TierRoute>} />
        <Route path="/notifications" element={<TierRoute path="/notifications"><NotificationsPage /></TierRoute>} />
        <Route path="/requests" element={<TierRoute path="/requests"><RequestsPage /></TierRoute>} />
        <Route path="/parental-controls" element={<TierRoute path="/parental-controls"><ParentalControlsPage /></TierRoute>} />
        <Route path="/processing" element={<TierRoute path="/processing"><ProcessingPage /></TierRoute>} />
        <Route path="/usenet" element={<TierRoute path="/usenet"><UsenetPage /></TierRoute>} />
        <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />

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
         <Route path="/watch-party" element={<TierRoute path="/watch-party"><WatchPartyPage /></TierRoute>} />
         <Route path="/lobster" element={<TierRoute path="/lobster"><LobsterPage /></TierRoute>} />
         <Route path="/roadmap" element={<ProtectedRoute><RoadmapPage /></ProtectedRoute>} />
         <Route path="/changelog" element={<ProtectedRoute><ChangelogPage /></ProtectedRoute>} />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <ApiProvider>
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
            </ApiProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </div>
  );
}

export default App;
