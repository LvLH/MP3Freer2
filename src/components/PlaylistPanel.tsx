import React, { useRef, useEffect, useState } from 'react';
import { Play, Trash2, Music, ArrowUp } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const PlaylistPanel: React.FC = () => {
  const { playlist, playIndex, currentSong, playSong, removeFromPlaylist, clearPlaylist } = usePlayer();

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

  // 队列打开或切歌时自动定位到当前播放歌曲位置（前面最多保留 3 首）
  useEffect(() => {
    if (scrollContainerRef.current && playlist.length > 0) {
      const timer = setTimeout(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const listEl = container.querySelector('.song-list-container');
        if (!listEl) return;
        const targetIndex = Math.max(0, playIndex - 3);
        const itemEl = listEl.children[targetIndex] as HTMLElement;
        if (itemEl) {
          container.scrollTo({ top: itemEl.offsetTop, behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [playIndex, playlist.length]);

  // 左滑删除手势与淡出塌陷动效
  const [swipedSongId, setSwipedSongId] = useState<string | null>(null);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e: React.TouchEvent, songId: string) => {
    if (!touchStartRef.current) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 25) {
      if (deltaX < -25) {
        setSwipedSongId(songId);
      } else if (deltaX > 25 && swipedSongId === songId) {
        setSwipedSongId(null);
      }
    }
  };

  const handleDeleteSong = (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    setDeletingSongId(songId);
    setTimeout(() => {
      removeFromPlaylist(songId);
      setDeletingSongId(null);
      if (swipedSongId === songId) {
        setSwipedSongId(null);
      }
    }, 280);
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
              查看和管理当前排队播放的歌曲 ({playlist.length})。
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

      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', marginTop: 12 }}>
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
            <div className="song-list-container playlist-queue-container">
              {playlist.map((song, index) => {
                const isCurrent = currentSong?.id === song.id;
                const isSwiped = swipedSongId === song.id;
                const isDeleting = deletingSongId === song.id;

                return (
                  <div
                    key={`${song.id}_${index}`}
                    className={`queue-item-swipe-wrapper ${isDeleting ? 'deleting' : ''}`}
                  >
                    <div 
                      className={`song-row queue-song-row ${isCurrent ? 'active' : ''} ${isSwiped ? 'swiped' : ''}`}
                      onTouchStart={handleTouchStart}
                      onTouchMove={e => handleTouchMove(e, song.id)}
                      onClick={() => playSong(song)}
                    >
                      <div className="song-col-index">
                        {isCurrent ? (
                          <Play size={14} fill="var(--primary-color)" stroke="var(--primary-color)" />
                        ) : (
                          (index + 1).toString().padStart(2, '0')
                        )}
                      </div>
                      <div className="song-col-info">
                        <div className="song-title-row">
                          <span className="song-name" style={{ color: isCurrent ? 'var(--primary-hover)' : 'inherit' }} title={song.name}>
                            {song.name}
                          </span>
                        </div>
                        <span className="song-artist" title={song.artist}>{song.artist}</span>
                      </div>
                      <div className="song-col-album">{song.album}</div>
                      <div className="song-col-duration">{formatSecs(song.duration)}</div>
                    </div>
                    {isSwiped && (
                      <button
                        className="mobile-sheet-delete-btn"
                        onClick={e => handleDeleteSong(e, song.id)}
                        title="从队列中删除"
                      >
                        <Trash2 size={16} />
                        <span>删除</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
