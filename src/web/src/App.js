import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { GadgetProvider, useGadgets } from "./context/GadgetContext";
import { lazy, Suspense } from "react";

// Pages
import { Dashboard } from "./pages/Dashboard";
import { AuthPage } from "./pages/AuthPage";
import { AuthCallback } from "./pages/AuthCallback";
import { MoviesPage } from "./pages/MoviesPage";
import { TVShowsPage } from "./pages/TVShowsPage";
import { MediaDetails } from "./pages/MediaDetails";
import { SearchPage } from "./pages/SearchPage";
import { IndexerSearchPage } from "./pages/IndexerSearchPage";
import { DownloadsPage } from "./pages/DownloadsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StreamingPage } from "./pages/StreamingPage";
import { MusicPage } from "./pages/MusicPage";
import { AudiobooksPage } from "./pages/AudiobooksPage";
import { LiveTVPage } from "./pages/LiveTVPage";
import { LibraryPage } from "./pages/LibraryPage";
import { WatchPartyPage } from "./pages/WatchPartyPage";
import { PluginMarketplacePage } from "./pages/PluginMarketplacePage";
import { ThemeCommunityPage } from "./pages/ThemeCommunityPage";
import { DVRPage } from "./pages/DVRPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import AnimePage from "./pages/AnimePage";
import VideoPlayer from "./components/VideoPlayer";
import { WatchHistoryPage } from "./pages/WatchHistoryPage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { DiscoverPage } from "./pages/DiscoverPage";

// Admin / Security / VPN / System
import SecurityPage from "./pages/SecurityPage";
import VpnPage from "./pages/VpnPage";
import SystemPage from "./pages/SystemPage";
import LibraryManagerPage from "./pages/LibraryManagerPage";
import LogViewerPage from "./pages/LogViewerPage";
import MediaBrowserPage from "./pages/MediaBrowserPage";

// Gadget Pages
import WeatherPage from "./pages/gadgets/WeatherPage";
import PodcastsPage from "./pages/gadgets/PodcastsPage";
import RadioPage from "./pages/gadgets/RadioPage";
import PhotosPage from "./pages/gadgets/PhotosPage";
import WebVideoPage from "./pages/gadgets/WebVideoPage";
import AnalyticsPage from "./pages/gadgets/AnalyticsPage";
import NotificationsPage from "./pages/gadgets/NotificationsPage";
import RequestsPage from "./pages/gadgets/RequestsPage";
import ParentalControlsPage from "./pages/gadgets/ParentalControlsPage";
import ProcessingPage from "./pages/gadgets/ProcessingPage";
import UsenetPage from "./pages/gadgets/UsenetPage";
import HelpPage from "./pages/HelpPage";

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
    return <AuthCallback />;
  }

  return (
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
      <Route
        path="/indexers"
        element={
          <ProtectedRoute>
            <IndexerSearchPage />
          </ProtectedRoute>
        }
      />
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
      <Route
        path="/streaming"
        element={
          <ProtectedRoute>
            <StreamingPage />
          </ProtectedRoute>
        }
      />
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
      <Route
        path="/live"
        element={
          <ProtectedRoute>
            <LiveTVPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/party/:partyCode"
        element={
          <ProtectedRoute>
            <WatchPartyPage />
          </ProtectedRoute>
        }
      />
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
        path="/dvr"
        element={
          <ProtectedRoute>
            <DVRPage />
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
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <WatchHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/watchlist"
        element={
          <ProtectedRoute>
            <WatchlistPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/discover"
        element={
          <ProtectedRoute>
            <DiscoverPage />
          </ProtectedRoute>
        }
      />

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
        path="/security"
        element={
          <ProtectedRoute>
            <SecurityPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vpn"
        element={
          <ProtectedRoute>
            <VpnPage />
          </ProtectedRoute>
        }
      />
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
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/requests"
        element={
          <ProtectedRoute>
            <RequestsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parental-controls"
        element={
          <ProtectedRoute>
            <ParentalControlsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/processing"
        element={
          <ProtectedRoute>
            <ProcessingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/usenet"
        element={
          <ProtectedRoute>
            <UsenetPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <HelpPage />
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <GadgetProvider>
              <AppRouter />
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
            </GadgetProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
