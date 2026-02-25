import { motion } from 'framer-motion';

/**
 * Reusable tabbed header component for Settings pages
 * @param {string} title - Main title
 * @param {string} subtitle - Subtitle description
 * @param {React.Element} icon - Icon component
 * @param {Array} tabs - Array of { id, label, icon } objects
 * @param {string} activeTab - Currently active tab ID
 * @param {Function} setActiveTab - Function to change active tab
 * @param {string} version - Optional version badge text
 */
export const SettingsTabHeader = ({ 
  title, 
  subtitle, 
  icon: Icon, 
  tabs, 
  activeTab, 
  setActiveTab,
  version,
  iconColor = 'text-violet-400',
  iconBgColor = 'from-violet-600 to-fuchsia-500'
}) => {
  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${iconBgColor} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            {title}
            {version && (
              <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">
                {version}
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-400">{subtitle}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2" data-testid="settings-tabs">
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {TabIcon && <TabIcon className="w-4 h-4" />}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Wrapper for animated tab content transitions
 */
export const SettingsTabContent = ({ activeTab, children }) => {
  return (
    <motion.div
      key={activeTab}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
};

export default SettingsTabHeader;
