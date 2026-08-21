import React, { useRef } from 'react';
import { Play, Trash2, Music, X, ArrowUp } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { isMobileShell } from '../utils/platform';

export const PlaylistPanel: React.FC = () => {
  const { playlist, currentSong, playSong, removeFromPlaylist, clearPlaylist } = usePlayer();

  const formatSecs = (secs: number) => {
    if (!secs) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="glass-card" style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="back-to-top-btn" onClick={scrollToTop} title="回到顶部">
            <ArrowUp size={18} />
          </button>
          <div>
            <h2>正在播放列表</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              查看和管理当前排队播放的歌曲。
            </p>
          </div>
        </div>
        {playlist.length > 0 && (
          <button 
            className="primary-btn clear-playlist-btn" 
            onClick={clearPlaylist} 
            title="清空列表"
            style={{ 
              background: 'rgba(239, 68, 68, 0.15)', 
              color: '#f87171', 
              boxShadow: 'none',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}
          >
            <Trash2 size={16} />
            <span className="btn-text">清空列表</span>
          </button>
        )}
      </div>

      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', marginTop: 24 }}>
        <div className="glass-card" style={{ minHeight: '100%' }}>
          {playlist.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '60px 0',
              color: 'var(--text-muted)',
              gap: 12
            }}>
              <Music size={48} strokeWidth={1} style={{ color: 'var(--primary-color)' }} />
              <p style={{ fontSize: 15 }}>当前播放列表空空如也</p>
              <span style={{ fontSize: 11, color: 'var(--text-dark)' }}>可以前往本地歌曲或在线音乐中添加曲目</span>
            </div>
          ) : (
            <div className="song-list-container">
              {playlist.map((song, index) => (
                <div 
                  key={song.id} 
                  className={`song-row ${currentSong?.id === song.id ? 'active' : ''}`}
                  onClick={isMobileShell() ? () => playSong(song) : undefined}
                  onDoubleClick={isMobileShell() ? undefined : () => playSong(song)}
                >
                  <div className="song-col-index">
                    {currentSong?.id === song.id ? (
                      <Play size={14} fill="var(--primary-color)" stroke="var(--primary-color)" />
                    ) : (
                      (index + 1).toString().padStart(2, '0')
                    )}
                  </div>
                  <div className="song-col-info">
                    <div className="song-title-row">
                      <span className="song-name" style={{ color: currentSong?.id === song.id ? 'var(--primary-hover)' : 'inherit' }}>
                        {song.name}
                      </span>
                      <span className="tag-source">
                        {song.isLocal ? '本地' : song.source === 'netease' ? '网易云' : song.source === 'tencent' ? 'QQ' : song.source}
                      </span>
                    </div>
                    <span className="song-artist">{song.artist}</span>
                  </div>
                  <div className="song-col-album">{song.album}</div>
                  <div className="song-col-duration">{formatSecs(song.duration)}</div>

                  <div className="song-row-actions">
                    <button 
                      className="song-row-action-btn"
                      onClick={() => playSong(song)}
                      title="立即播放"
                    >
                      <Play size={14} fill="currentColor" />
                    </button>
                    <button 
                      className="song-row-action-btn"
                      onClick={() => removeFromPlaylist(song.id)}
                      title="移出列表"
                      style={{ color: '#f87171' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
