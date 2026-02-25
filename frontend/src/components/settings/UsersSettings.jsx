import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, UserPlus, User, Crown, Edit2, Trash2, 
  Shield, RefreshCw, Key, Activity
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { SettingsTabHeader, SettingsTabContent } from './SettingsTabHeader';

// Tabs for Users Settings
const USERS_TABS = [
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'access', label: 'Access & API', icon: Key },
  { id: 'activity', label: 'Activity Log', icon: Activity },
];

export const UsersSettings = ({
  users,
  loadingUsers,
  showAddUser,
  setShowAddUser,
  newUser,
  setNewUser,
  savingUser,
  editingUser,
  setEditingUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  currentUserId
}) => {
  const [activeTab, setActiveTab] = useState('users');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return (
          <UsersTab
            users={users}
            loadingUsers={loadingUsers}
            showAddUser={showAddUser}
            setShowAddUser={setShowAddUser}
            newUser={newUser}
            setNewUser={setNewUser}
            savingUser={savingUser}
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            onAddUser={onAddUser}
            onUpdateUser={onUpdateUser}
            onDeleteUser={onDeleteUser}
          />
        );
      case 'access':
        return <AccessTab />;
      case 'activity':
        return <ActivityTab />;
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6" data-testid="users-settings">
      <SettingsTabHeader
        title="Users & Access"
        subtitle="Manage users, permissions, and access controls"
        icon={Users}
        tabs={USERS_TABS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        iconBgColor="from-blue-600 to-cyan-500"
      />

      <SettingsTabContent activeTab={activeTab}>
        {renderTabContent()}
      </SettingsTabContent>
    </motion.div>
  );
};

// Users Tab
const UsersTab = ({
  users, loadingUsers, showAddUser, setShowAddUser, newUser, setNewUser,
  savingUser, editingUser, setEditingUser, onAddUser, onUpdateUser, onDeleteUser
}) => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" />
            Registered Users
          </h3>
          <p className="text-sm text-gray-400 mt-1">{users.length} user(s) configured</p>
        </div>
        <Button onClick={() => setShowAddUser(!showAddUser)} className="bg-violet-600 hover:bg-violet-700">
          <UserPlus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      {/* Add User Form */}
      <AnimatePresence>
        {showAddUser && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-4 mb-6">
              <h4 className="font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-green-400" />
                Create New User
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Username *</label>
                  <Input
                    value={newUser.username}
                    onChange={(e) => setNewUser(p => ({ ...p, username: e.target.value }))}
                    placeholder="johndoe"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Email *</label>
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(p => ({ ...p, email: e.target.value }))}
                    placeholder="user@example.com"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Password *</label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser(p => ({ ...p, role: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md bg-black/50 border border-white/10 text-white [&>option]:bg-[#1a1a1a] [&>option]:text-white"
                  >
                    <option value="user">User</option>
                    <option value="admin">Administrator</option>
                    <option value="guest">Guest</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <h5 className="text-sm font-medium mb-3">Permissions</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={newUser.permissions.can_download}
                      onCheckedChange={(v) => setNewUser(p => ({ ...p, permissions: { ...p.permissions, can_download: v } }))}
                    />
                    Can Download
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={newUser.permissions.can_delete}
                      onCheckedChange={(v) => setNewUser(p => ({ ...p, permissions: { ...p.permissions, can_delete: v } }))}
                    />
                    Can Delete Media
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={newUser.permissions.can_manage_library}
                      onCheckedChange={(v) => setNewUser(p => ({ ...p, permissions: { ...p.permissions, can_manage_library: v } }))}
                    />
                    Manage Library
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={newUser.permissions.can_access_settings}
                      onCheckedChange={(v) => setNewUser(p => ({ ...p, permissions: { ...p.permissions, can_access_settings: v } }))}
                    />
                    Access Settings
                  </label>
                  <div className="col-span-2">
                    <label className="text-sm text-gray-400 mb-1 block">Max Concurrent Streams</label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={newUser.permissions.max_streams}
                      onChange={(e) => setNewUser(p => ({ ...p, permissions: { ...p.permissions, max_streams: parseInt(e.target.value) || 1 } }))}
                      className="bg-white/5 border-white/10 w-24"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={onAddUser} disabled={savingUser} className="bg-green-600 hover:bg-green-700">
                  {savingUser ? 'Creating...' : 'Create User'}
                </Button>
                <Button variant="outline" onClick={() => setShowAddUser(false)} className="border-white/20">
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users List */}
      {loadingUsers ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No users found</p>
          <p className="text-sm">Create your first user to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <UserCard 
              key={user.id}
              user={user}
              editingUser={editingUser}
              setEditingUser={setEditingUser}
              onUpdate={onUpdateUser}
              onDelete={onDeleteUser}
            />
          ))}
        </div>
      )}
    </div>
  </div>
);

// Access Tab
const AccessTab = () => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-green-400" />
        Server Access
      </h3>
      <p className="text-sm text-gray-400 mb-6">API endpoints for connecting external clients</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-black/30 border border-white/10">
          <p className="text-gray-400 mb-2 text-sm">Jellyfin-Compatible API</p>
          <code className="text-violet-400 text-lg">/api/emby/*</code>
          <p className="text-xs text-gray-500 mt-2">Connect using Jellyfin/Emby clients</p>
        </div>
        <div className="p-4 rounded-xl bg-black/30 border border-white/10">
          <p className="text-gray-400 mb-2 text-sm">Native API</p>
          <code className="text-violet-400 text-lg">/api/*</code>
          <p className="text-xs text-gray-500 mt-2">For WatchNexus native clients</p>
        </div>
      </div>
    </div>

    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Key className="w-5 h-5 text-amber-400" />
        API Keys
      </h3>
      <p className="text-sm text-gray-400 mb-4">Generate API keys for third-party integrations</p>
      
      <div className="p-4 rounded-xl bg-black/30 border border-dashed border-white/10 text-center">
        <Key className="w-8 h-8 mx-auto mb-2 text-gray-500" />
        <p className="text-gray-500">No API keys generated</p>
        <Button className="mt-3 bg-amber-600 hover:bg-amber-700" size="sm">
          <Key className="w-4 h-4 mr-2" /> Generate API Key
        </Button>
      </div>
    </div>
  </div>
);

// Activity Tab
const ActivityTab = () => (
  <div className="space-y-6">
    <div className="bg-surface border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-cyan-400" />
        Recent Activity
      </h3>
      <p className="text-sm text-gray-400 mb-4">User login and action history</p>
      
      <div className="p-8 rounded-xl bg-black/30 border border-dashed border-white/10 text-center">
        <Activity className="w-8 h-8 mx-auto mb-2 text-gray-500" />
        <p className="text-gray-500">No recent activity</p>
        <p className="text-xs text-gray-600 mt-1">Activity will appear here as users interact with the system</p>
      </div>
    </div>
  </div>
);

// User Card Component
const UserCard = ({ user, editingUser, setEditingUser, onUpdate, onDelete }) => {
  return (
    <div className="p-4 rounded-xl bg-black/30 border border-white/10 hover:border-violet-500/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 
            user.role === 'guest' ? 'bg-gray-500/20 text-gray-400' : 
            'bg-violet-500/20 text-violet-400'
          }`}>
            {user.role === 'admin' ? <Crown className="w-5 h-5" /> : <User className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{user.username}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 
                user.role === 'guest' ? 'bg-gray-500/20 text-gray-400' : 
                'bg-violet-500/20 text-violet-400'
              }`}>
                {user.role}
              </span>
            </div>
            <p className="text-sm text-gray-400">{user.email}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right text-sm text-gray-400 hidden sm:block">
            <p>Last login: {user.last_login || 'Never'}</p>
            <p className="text-xs">Created: {user.created_at}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingUser(editingUser === user.id ? null : user.id)}
              className="hover:bg-violet-500/20"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            {user.role !== 'admin' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(user.id)}
                className="hover:bg-red-500/20 text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Edit Panel */}
      <AnimatePresence>
        {editingUser === user.id && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-white/10"
          >
            <h4 className="text-sm font-medium mb-3">Edit Permissions</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={user.permissions?.can_download ?? true}
                  onCheckedChange={(v) => onUpdate(user.id, { permissions: { ...user.permissions, can_download: v } })}
                />
                Download
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={user.permissions?.can_delete ?? false}
                  onCheckedChange={(v) => onUpdate(user.id, { permissions: { ...user.permissions, can_delete: v } })}
                />
                Delete Media
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={user.permissions?.can_manage_library ?? false}
                  onCheckedChange={(v) => onUpdate(user.id, { permissions: { ...user.permissions, can_manage_library: v } })}
                />
                Manage Library
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={user.permissions?.can_access_settings ?? false}
                  onCheckedChange={(v) => onUpdate(user.id, { permissions: { ...user.permissions, can_access_settings: v } })}
                />
                Settings Access
              </label>
            </div>
            <div className="mt-3">
              <label className="text-sm text-gray-400 mb-1 block">Max Streams</label>
              <Input
                type="number"
                min="1"
                max="10"
                value={user.permissions?.max_streams || 3}
                onChange={(e) => onUpdate(user.id, { permissions: { ...user.permissions, max_streams: parseInt(e.target.value) || 1 } })}
                className="bg-white/5 border-white/10 w-24"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UsersSettings;
