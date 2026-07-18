import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ListMusic, SkipBack, SkipForward } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { usePlaybackProgress } from '../services/playbackProgress';
import defaultCoverIcon from '../assets/default-cover.png';

interface LyricViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LyricView: React.FC<LyricViewProps> = ({ isOpen, onClose }) => {
  const {
    currentSong, lyrics, currentLyricIndex, seekTo,
    playlist, playIndex, playSong, togglePlay, prevSong, nextSong,
    showTranslation,
  } = usePlayer();
  // 播放进度/状态走独立 store，避免随 usePlayer 的其它字段一起重渲染
  const { currentTime, duration, isPlaying } = usePlaybackProgress();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isPlaylistOpen && 
        popupRef.current && 
        btnRef.current && 
        !popupRef.current.contains(e.target as Node) && 
        !btnRef.current.contains(e.target as Node)
      ) {
        setIsPlaylistOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPlaylistOpen) {
          setIsPlaylistOpen(false);
        } else if (isOpen) {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaylistOpen, isOpen, onClose]);

  // 当歌词行改变时，平滑滚动让当前行保持在容器中央
  useEffect(() => {
    if (!isOpen || !containerRef.current || currentLyricIndex < 0) return;
    // 用 rAF 确保在 DOM 更新（active class 切换）之后再滚动，
    // 避免 querySelector 找到的是旧的 active 元素
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const activeEl = container.querySelector('.lyric-line.active') as HTMLElement;
      if (!activeEl) return;
      const targetTop = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
      // scrollTo + behavior:smooth 比 scrollTop 直接赋值更可靠地触发平滑滚动
      container.scrollTo({ top: targetTop, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [currentLyricIndex, isOpen, lyrics]);

  // 当面板第一次打开时，也滚动到正确位置
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (!containerRef.current || currentLyricIndex < 0) return;
      const activeEl = containerRef.current.querySelector('.lyric-line.active') as HTMLElement;
      if (!activeEl) return;
      const targetTop = activeEl.offsetTop - containerRef.current.clientHeight / 2 + activeEl.clientHeight / 2;
      containerRef.current.scrollTo({ top: targetTop, behavior: 'smooth' });
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const defaultCover = defaultCoverIcon;

  const songCover = currentSong?.pic || defaultCover;

  const formatSecs = (secs: number) => {
    if (!secs) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(Number(e.target.value));
  };

  return (
    <div className={`lyric-view-fullscreen ${isOpen ? 'open' : ''}`}>
      {/* 虚化的大封面作为背景 */}
      <div 
        className="lyric-bg-blur" 
        style={{ backgroundImage: `url(${songCover})` }}
      ></div>

      {/* 关闭按钮 */}
      <button className="close-lyric-btn" onClick={onClose} title="收起歌词">
        <ChevronDown size={24} />
      </button>

      {/* 左半：黑胶唱片旋转 */}
      <div className="lyric-left-half">
        <div className="lyric-cover-area">
          <button className="lyric-control-btn" onClick={prevSong} title="上一曲" style={{ width: 48, height: 48 }}>
            <SkipBack size={28} />
          </button>
          
          <div 
            className={`vinyl-record ${isPlaying ? 'spinning' : ''}`} 
            onClick={togglePlay}
            title={isPlaying ? "点击暂停" : "点击播放"}
            style={{ cursor: 'pointer' }}
          >
            <img 
              src={songCover} 
              alt="cover" 
              className="vinyl-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = defaultCover;
              }}
            />
          </div>
          
          <button className="lyric-control-btn" onClick={nextSong} title="下一曲" style={{ width: 48, height: 48 }}>
            <SkipForward size={28} />
          </button>
        </div>

        <div className="lyric-progress-wrapper" style={{ margin: '16px 15% 0 15%', width: '70%', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatSecs(currentTime)}</span>
          <div className="slider-bar" style={{ flex: 1 }}>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                left: 0,
                top: 0,
                zIndex: 2
              }}
            />
            <div
              className="slider-fill"
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
            ></div>
            <div
              className="slider-thumb"
              style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
            ></div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatSecs(duration)}</span>
        </div>
        
        <div className="lyric-song-info" style={{ marginTop: 24 }}>
          <h2 className="lyric-song-name">{currentSong?.name || '未知曲目'}</h2>
          <span className="lyric-song-artist">{currentSong?.artist || '未知歌手'}</span>
        </div>

        <button 
          ref={btnRef}
          className="lyric-playlist-btn"
          onClick={() => setIsPlaylistOpen(!isPlaylistOpen)}
          title="当前播放列表"
        >
          <ListMusic size={20} />
        </button>

        {isPlaylistOpen && (
          <div className="lyric-playlist-popup" ref={popupRef}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-main)' }}>当前播放列表 ({playlist.length})</h3>
            <div className="lyric-playlist-scroll">
              {playlist.map((song, i) => (
                <div 
                  key={`${song.id}_${i}`}
                  className={`lyric-playlist-item ${i === playIndex ? 'playing' : ''}`}
                  onClick={() => playSong(song)}
                >
                  <div className="song-name" style={{ color: i === playIndex ? 'var(--primary-hover)' : 'var(--text-main)' }}>{song.name}</div>
                  <div className="song-artist">- {song.artist}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 右半：平滑滚动的歌词列表 */}
      <div className="lyric-right-half">
        <div className="lyric-list-container" ref={containerRef}>
          {lyrics.length === 0 ? (
            <div className="lyric-line" style={{ color: 'var(--text-muted)', fontSize: 16, marginTop: '20%' }}>
              {currentSong ? '暂无歌词，尽情享受音乐吧~' : '未在播放歌曲'}
            </div>
          ) : (
            lyrics.map((line, index) => (
              <div
                key={index}
                className={`lyric-line ${index === currentLyricIndex ? 'active' : ''}`}
                onClick={() => seekTo(line.time)}
              >
                {line.text}
                {showTranslation && line.translation && (
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{line.translation}</div>
                )}
                {showTranslation && line.romanization && (
                  <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2, fontStyle: 'italic' }}>{line.romanization}</div>
                )}
              </div>
            ))
          )}
        </div>



      </div>
    </div>
  );
};
