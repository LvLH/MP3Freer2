import { useMemo } from 'react';
import { Play, Shuffle } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { generateSmartPlaylists, SmartPlaylist } from '../utils/smartPlaylists';
import '../App.css';

export const SmartPlaylistsPanel: React.FC = () => {
  const { playHistory, localSongs, favoriteSongs, playAll, addAllToPlaylist } = usePlayer();

  const playlists: SmartPlaylist[] = useMemo(
    () => generateSmartPlaylists(playHistory, localSongs, favoriteSongs),
    [playHistory, localSongs, favoriteSongs]
  );

  if (playlists.length === 0) {
    return (
      <div className="smart-empty">
        <div className="smart-empty-icon">🎵</div>
        <h3>智能歌单等你来激活</h3>
        <p>多听几首歌、导入本地音乐、收藏喜欢的曲目，</p>
        <p>系统会自动为你生成专属歌单</p>
      </div>
    );
  }

  return (
    <div className="smart-playlists-container">
      <header className="smart-header">
        <h1>智能歌单</h1>
        <p className="smart-subtitle">根据你的听歌行为自动生成 · 每次打开都会刷新</p>
      </header>

      <div className="smart-grid">
        {playlists.map(pl => (
          <div key={pl.id} className="smart-card">
            <div className="smart-card-cover">
              <span className="smart-card-icon">{pl.icon}</span>
              <div className="smart-card-overlay">
                <button
                  className="smart-play-btn"
                  onClick={() => playAll(pl.songs)}
                  title="立即播放"
                >
                  <Play size={20} fill="currentColor" />
                </button>
                <button
                  className="smart-add-btn"
                  onClick={() => addAllToPlaylist(pl.songs)}
                  title="添加到队列"
                >
                  <Shuffle size={16} />
                </button>
              </div>
            </div>
            <div className="smart-card-info">
              <h3 className="smart-card-name" title={pl.name}>{pl.name}</h3>
              <p className="smart-card-desc" title={pl.description}>{pl.description}</p>
              <span className="smart-card-subtitle">{pl.subtitle}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
