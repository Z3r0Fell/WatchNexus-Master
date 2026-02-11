import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Film,
  Tv,
  Music,
  BookOpen,
  Radio,
  Download,
  Settings,
  Search,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Play,
  Layers,
  FolderOpen,
  Compass
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

const navItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: FolderOpen, label: 'Library', path: '/library' },
  { icon: Film, label: 'Movies', path: '/movies' },
  { icon: Tv, label: 'TV Shows', path: '/tv' },
  { icon: Music, label: 'Music', path: '/music' },
  { icon: BookOpen, label: 'Audiobooks', path: '/audiobooks' },
  { icon: Radio, label: 'Live TV', path: '/live' },
  { icon: Layers, label: 'Streaming', path: '/streaming' },
  { icon: Compass, label: 'Indexers', path: '/indexers' },
  { icon: Download, label: 'Downloads', path: '/downloads' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export const Sidebar = () => {
  const [expanded, setExpanded] = useState(true);
  const location = useLocation();
  const { logout, user } = useAuth();

  return (
    <motion.aside
      data-testid="sidebar"
      initial={false}
      animate={{ width: expanded ? 240 : 72 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="sidebar fixed left-0 top-0 h-screen z-50 flex flex-col"
    >
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <Link to="/" className="flex items-center gap-3">
          <img 
            src="/watchnexus-logo.svg" 
            alt="WatchNexus" 
            className="w-10 h-10 rounded-xl"
          />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-bold text-xl tracking-tight bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent"
              >
                WatchNexus
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <button
          data-testid="sidebar-toggle"
          onClick={() => setExpanded(!expanded)}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Search (expanded only) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 border-b border-white/5"
          >
            <Link
              to="/search"
              data-testid="search-link"
              className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Search className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Search...</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto hide-scrollbar">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-violet-600/20 text-violet-400"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className={cn("w-5 h-5", isActive && "text-violet-400")} />
                  <AnimatePresence>
                    {expanded && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="text-sm font-medium"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {isActive && expanded && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-white/5">
        <div className={cn("flex items-center", expanded ? "gap-3" : "justify-center")}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium truncate">{user?.username || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {expanded && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={logout}
                data-testid="logout-btn"
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
};
