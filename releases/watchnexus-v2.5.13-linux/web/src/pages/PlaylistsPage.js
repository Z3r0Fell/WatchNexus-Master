/**
 * Playlists Page - Drizzle UI
 * Manages continuous playback, queues, and playlists
 */

import React from 'react';
import { Layout } from '../components/layout/Layout';
import { PlaylistsManager } from '../components/drizzle/PlaylistComponents';

const PlaylistsPage = () => {
  return (
    <Layout>
      <PlaylistsManager />
    </Layout>
  );
};

export default PlaylistsPage;
