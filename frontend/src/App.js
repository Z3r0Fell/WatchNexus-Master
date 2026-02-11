import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";

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

import "./App.css";

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
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
