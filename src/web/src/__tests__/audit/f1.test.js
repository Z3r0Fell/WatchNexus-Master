// Audit slice F1 regressions.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../../components/layout/Layout', () => ({ Layout: ({ children }) => <div>{children}</div> }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../services/marmaladeApi', () => ({
  marmaladeLibrary: {
    getLibraries: jest.fn(() => Promise.resolve({ data: [{ id: 'lib1', name: 'Books', media_type: 'audiobooks', item_count: 1 }] })),
    addLibrary: jest.fn(), scanLibrary: jest.fn(),
  },
  marmaladeMedia: {
    getRecent: jest.fn(() => Promise.resolve({ data: [] })),
    getMedia: jest.fn(() => Promise.resolve({ data: [{ id: 'book1', title: 'My Book', media_type: 'audiobooks', duration: 60 }] })),
  },
  marmaladeStream: { getStreamUrl: jest.fn(() => Promise.resolve('http://x/stream/book1?sig=1')) },
  formatDuration: () => '1:00',
}));

describe('ChangelogPage', () => {
  it('has a default export so React.lazy in App.js can render it', () => {
    const mod = require('../../pages/ChangelogPage');
    expect(typeof mod.default).toBe('function');
  });
});

describe('AudiobooksPage playback', () => {
  it('awaits the signed stream URL instead of assigning a Promise to audio.src', async () => {
    const playSpy = jest.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    const { AudiobooksPage } = require('../../pages/AudiobooksPage');
    render(<AudiobooksPage />);
    const title = await screen.findByText('My Book');
    fireEvent.click(title.closest('button'));
    await waitFor(() => expect(playSpy).toHaveBeenCalled());
    const audio = playSpy.mock.instances[0];
    expect(audio.src).toBe('http://x/stream/book1?sig=1');
    playSpy.mockRestore();
  });
});
