import React, { useRef, useState } from 'react';
import { Play, Plus, Trash2, ArrowUp, Flame, Clock } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const HistoryPanel: React.FC = () => {
  const {
    playHistory,
    topPlayed,
    playSong,
    addToPlaylist,
    clearPlayHistory,
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<'recent' | 'top'>('recent');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatTime = (secs: number) => {
    if (!secs) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    if (isToday) return `今天 ${time}`;
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${time}`;
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="glass-card" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-to-top-btn" onClick={scrollToTop} title="回到顶部">
            <ArrowUp size={18} />
          </button>
          <Clock size={24} style={{ color: 'var(--primary-color)' }} />
          <div>
            <h2>播放历史</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              {activeTab === 'recent'
                ? `最近播放了 ${playHistory.length} 首歌`
                : `本周最爱 Top ${topPlayed.length}`}
            </p>
          </div>
          {playHistory.length > 0 && (
            <button
              className="icon-btn"
              onClick={clearPlayHistory}
              title="清空历史"
              style={{ marginLeft: 'auto', color: '#f87171', width: 28, height: 28, padding: 0 }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div className="type-selectors" style={{ marginTop: 24 }}>
          <label className={`type-radio ${activeTab === 'recent' ? 'active' : ''}`}>
            <input type="radio" name="historyTab" checked={activeTab === 'recent'}
              onChange={() => setActiveTab('recent')} style={{ display: 'none' }} />
            <span>最近播放</span>
          </label>
          <label className={`type-radio ${activeTab === 'top' ? 'active' : ''}`}>
            <input type="radio" name="historyTab" checked={activeTab === 'top'}
              onChange={() => setActiveTab('top')} style={{ display: 'none' }} />
            <span>本周最爱</span>
          </label>
        </div>
      </div>

      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', marginTop: 24 }}>
        <div className="glass-card" style={{ minHeight: '100%' }}>
          {activeTab === 'recent' ? (
            playHistory.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', gap: 12
              }}>
                <Clock size={48} strokeWidth={1} style={{ color: 'var(--primary-color)' }} />
                <p style={{ fontSize: 15 }}>还没有播放记录</p>
                <span style={{ fontSize: 11, color: 'var(--text-dark)' }}>开始播放歌曲后这里会显示记录</span>
              </div>
            ) : (
              <div className="song-list-container">
                {playHistory.map((entry, index) => (
                  <div key={`${entry.song.id}_${index}`}
                    className="song-row"
                    onDoubleClick={() => playSong(entry.song)}
                  >
                    <div className="song-col-index" style={{ fontSize: 11, color: 'var(--text-dark)', width: 70 }}>
                      {formatDate(entry.playedAt)}
                    </div>
                    <div className="song-col-info" style={{ flex: 1, minWidth: 0 }}>
                      <div className="song-title-row">
                        <span className="song-name">{entry.song.name}</span>
                        <span className="tag-source">
                          {entry.song.isLocal ? '本地' : entry.song.source === 'netease' ? '网易云' : entry.song.source}
                        </span>
                      </div>
                      <span className="song-artist">{entry.song.artist}</span>
                    </div>
                    <div className="song-col-album">{entry.song.album}</div>
                    <div className="song-col-duration">{formatTime(entry.song.duration)}</div>
                    <div className="song-row-actions">
                      <button className="song-row-action-btn" onClick={() => playSong(entry.song)} title="立即播放">
                        <Play size={14} fill="currentColor" />
                      </button>
                      <button className="song-row-action-btn" onClick={() => addToPlaylist(entry.song)} title="添加到播放列表">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            topPlayed.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', gap: 12
              }}>
                <Flame size={48} strokeWidth={1} style={{ color: '#ef4444' }} />
                <p style={{ fontSize: 15 }}>本周最爱暂无数据</p>
                <span style={{ fontSize: 11, color: 'var(--text-dark)' }}>多听几首歌就会出现你的最爱榜单</span>
              </div>
            ) : (
              <div className="song-list-container">
                {topPlayed.map((entry, index) => (
                  <div key={entry.song.id}
                    className="song-row"
                    onDoubleClick={() => playSong(entry.song)}
                  >
                    <div className="song-col-index" style={{
                      color: index < 3 ? '#ef4444' : 'var(--text-muted)',
                      fontWeight: index < 3 ? 700 : 400,
                    }}>
                      {(index + 1).toString().padStart(2, '0')}
                    </div>
                    <div className="song-col-info">
                      <div className="song-title-row">
                        <span className="song-name">{entry.song.name}</span>
                        <span className="tag-source">
                          {entry.song.isLocal ? '本地' : entry.song.source === 'netease' ? '网易云' : entry.song.source}
                        </span>
                      </div>
                      <span className="song-artist">{entry.song.artist}</span>
                    </div>
                    <div className="song-col-album">{entry.song.album}</div>
                    <div className="song-col-duration">{formatTime(entry.song.duration)}</div>
                    <div className="song-row-actions">
                      <button className="song-row-action-btn" onClick={() => playSong(entry.song)} title="立即播放">
                        <Play size={14} fill="currentColor" />
                      </button>
                      <button className="song-row-action-btn" onClick={() => addToPlaylist(entry.song)} title="添加到播放列表">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
