import React from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Repeat, RefreshCw, Shuffle, Maximize2, Loader2, Heart
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { triggerGlobalSearch } from '../utils/eventBus';

interface PlayerBarProps {
  onToggleFullscreen: () => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({ onToggleFullscreen }) => {
  const {
    currentSong,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    playMode,
    togglePlay,
    nextSong,
    prevSong,
    seekTo,
    setVolumeLevel,
    changePlayMode,
    toggleFavorite,
    isFavorite
  } = usePlayer();

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    seekTo(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolumeLevel(vol);
  };

  const toggleMute = () => {
    if (volume > 0) {
      setVolumeLevel(0);
    } else {
      setVolumeLevel(0.5);
    }
  };

  const getPlayModeTitle = () => {
    switch (playMode) {
      case 'single-loop':
        return '单曲循环';
      case 'random':
        return '随机播放';
      case 'list-loop':
      default:
        return '列表循环';
    }
  };

  const handleFavorite = () => {
    if (currentSong) {
      toggleFavorite(currentSong);
    }
  };

  const defaultCover = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%23a855f7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='3'/></svg>";

  return (
    <div className="player-bar">
      {/* 左侧：歌曲信息 */}
      <div className="player-left">
        <div className="player-cover-container" onClick={onToggleFullscreen} title="点击展开全屏歌词">
          <img
            src={currentSong?.pic || defaultCover}
            alt="cover"
            className={`player-cover ${isPlaying ? 'spinning' : ''}`}
            onError={(e) => {
              (e.target as HTMLImageElement).src = defaultCover;
            }}
          />
        </div>
        <div className="player-info">
          <span className="player-title" title={currentSong?.name || '未在播放'}>
            {currentSong?.name || '听你想听的歌'}
          </span>
          <span className="player-artist" title={currentSong?.artist || 'MP3Freer'}>
            {currentSong?.artist ? (
              currentSong.artist.split(/[/,&，、]/).map((a, i, arr) => {
                const artistName = a.trim();
                return artistName ? (
                  <React.Fragment key={i}>
                    <span className="clickable-artist" onClick={() => triggerGlobalSearch(artistName)}>
                      {artistName}
                    </span>
                    {i < arr.length - 1 && ' / '}
                  </React.Fragment>
                ) : null;
              })
            ) : '开始探索音乐吧'}
          </span>
        </div>
      </div>

      {/* 中间：播放控制与进度条 */}
      <div className="player-center">
        <div className="player-controls">
          <button className="control-btn" onClick={prevSong} title="上一首">
            <SkipBack size={20} fill="currentColor" />
          </button>

          <button className="control-btn play-pause" onClick={togglePlay} title={isLoading ? '加载中' : isPlaying ? '暂停' : '播放'} disabled={isLoading}>
            {isLoading
              ? <Loader2 size={20} className="animate-spin" />
              : isPlaying
                ? <Pause size={20} fill="currentColor" />
                : <Play size={20} fill="currentColor" style={{ marginLeft: 3 }} />
            }
          </button>

          <button className="control-btn" onClick={nextSong} title="下一首">
            <SkipForward size={20} fill="currentColor" />
          </button>
        </div>

        <div className="progress-container">
          <span className="time-text">{formatTime(currentTime)}</span>
          <div className="slider-bar">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleProgressChange}
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
          <span className="time-text right">{formatTime(duration)}</span>
        </div>
      </div>

      {/* 右侧：音量与功能 */}
      <div className="player-right">
        <button
          className={`control-btn ${currentSong && isFavorite(currentSong.id) ? 'favorited' : ''}`}
          onClick={handleFavorite}
          title="收藏"
          style={{ color: currentSong && isFavorite(currentSong.id) ? '#ef4444' : undefined }}
        >
          <Heart size={16} fill={currentSong && isFavorite(currentSong.id) ? '#ef4444' : 'none'} />
        </button>

        <button className="control-btn" onClick={changePlayMode} title={getPlayModeTitle()}>
          {playMode === 'single-loop' && <Repeat size={16} className="text-purple" />}
          {playMode === 'random' && <Shuffle size={16} />}
          {playMode === 'list-loop' && <RefreshCw size={16} />}
        </button>

        <button className="control-btn" onClick={onToggleFullscreen} title="歌词面板">
          <Maximize2 size={16} />
        </button>

        <div className="volume-container">
          <button className="control-btn" onClick={toggleMute} title="静音切换">
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <div className="slider-bar" style={{ width: 60, flex: 'none' }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
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
              style={{ width: `${volume * 100}%` }}
            ></div>
            <div
              className="slider-thumb"
              style={{ left: `${volume * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};