import { useState, useEffect } from 'react';
import { PlayerProvider } from './context/PlayerContext';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { LyricView } from './components/LyricView';
import { LocalMusicPanel } from './components/LocalMusicPanel';
import { SearchPanel } from './components/SearchPanel';
import { PlaylistPanel } from './components/PlaylistPanel';
import { FavoritePanel } from './components/FavoritePanel';
import { AboutPanel } from './components/AboutPanel';
import { ShortcutHelpModal } from './components/ShortcutHelpModal';
import { HistoryPanel } from './components/HistoryPanel';
import { useShortcuts } from './hooks/useShortcuts';
import './App.css';

function MainLayout() {
  const [activeTab, setActiveTab] = useState<string>('local');
  const [isLyricOpen, setIsLyricOpen] = useState<boolean>(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState<boolean>(false);

  useShortcuts({
    onTogglePlaylist: () => setActiveTab('playlist'),
    onFocusSearch: () => {
      setActiveTab('search');
      setTimeout(() => window.dispatchEvent(new Event('focusSearchInput')), 50);
    },
    onShowHelp: () => setIsShortcutHelpOpen(true),
    onToggleLyric: () => setIsLyricOpen(prev => !prev),
  });

  useEffect(() => {
    const handleGlobalSearch = () => {
      setActiveTab('search');
    };
    window.addEventListener('globalSearch', handleGlobalSearch);
    return () => window.removeEventListener('globalSearch', handleGlobalSearch);
  }, []);


  return (
    <div className="app-container">
      <div
        className="title-drag-region"
        data-tauri-drag-region
      />

      <div className="aurora-bg aurora-1" />
      <div className="aurora-bg aurora-2" />

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="main-content">
        <div style={{ display: activeTab === 'local' ? 'contents' : 'none' }}><LocalMusicPanel /></div>
        <div style={{ display: activeTab === 'search' ? 'contents' : 'none' }}><SearchPanel /></div>
        <div style={{ display: activeTab === 'playlist' ? 'contents' : 'none' }}><PlaylistPanel /></div>
        <div style={{ display: activeTab === 'favorites' ? 'contents' : 'none' }}><FavoritePanel /></div>
        <div style={{ display: activeTab === 'history' ? 'contents' : 'none' }}><HistoryPanel /></div>
        <div style={{ display: activeTab === 'about' ? 'contents' : 'none' }}><AboutPanel /></div>
      </main>

      <PlayerBar onToggleFullscreen={() => setIsLyricOpen(prev => !prev)} />
      <LyricView isOpen={isLyricOpen} onClose={() => setIsLyricOpen(false)} />
      
      <ShortcutHelpModal 
        isOpen={isShortcutHelpOpen} 
        onClose={() => setIsShortcutHelpOpen(false)} 
      />
    </div>
  );
}

function App() {
  return (
    <PlayerProvider>
      <MainLayout />
    </PlayerProvider>
  );
}

export default App;
