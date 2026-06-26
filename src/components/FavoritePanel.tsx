import React, { useState, useRef } from 'react';
import { Heart, Play, Plus, Music, ArrowUp } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

const FALLBACK_COVER = 'assets/default-cover.png';

export const FavoritePanel: React.FC = () => {
  const { favoriteSongs, favoritePlaylists, favoriteArtists, playSong, addToPlaylist } = usePlayer();
  const [activeTab, setActiveTab] = useState<'songs' | 'artists' | 'playlists'>('songs');

  const formatSecs = (secs: number) => {
    if (!secs) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlaylistClick = (id: string) => {
    window.dispatchEvent(new CustomEvent('openPlaylist', { detail: id }));
    window.dispatchEvent(new CustomEvent('globalSearch', { detail: '' }));
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="glass-card" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-to-top-btn" onClick={scrollToTop} title="回到顶部">
            <ArrowUp size={18} />
          </button>
          <Heart size={24} fill="#ef4444" stroke="#ef4444" />
          <div>
            <h2>我的收藏</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              收藏的歌曲和歌单将保存在本地，随时回味。
            </p>
          </div>
        </div>

        <div className="type-selectors" style={{ marginTop: 24 }}>
          <label className={`type-radio ${activeTab === 'songs' ? 'active' : ''}`}>
            <input
              type="radio"
              name="favType"
              checked={activeTab === 'songs'}
              onChange={() => setActiveTab('songs')}
              style={{ display: 'none' }}
            />
            <span style={{ fontSize: '1.1em', fontWeight: activeTab === 'songs' ? 700 : 500 }}>歌曲</span>
          </label>
          <label className={`type-radio ${activeTab === 'artists' ? 'active' : ''}`}>
            <input
              type="radio"
              name="favType"
              checked={activeTab === 'artists'}
              onChange={() => setActiveTab('artists')}
              style={{ display: 'none' }}
            />
            <span style={{ fontSize: '1.1em', fontWeight: activeTab === 'artists' ? 700 : 500 }}>歌手</span>
          </label>
          <label className={`type-radio ${activeTab === 'playlists' ? 'active' : ''}`}>
            <input
              type="radio"
              name="favType"
              checked={activeTab === 'playlists'}
              onChange={() => setActiveTab('playlists')}
              style={{ display: 'none' }}
            />
            <span style={{ fontSize: '1.1em', fontWeight: activeTab === 'playlists' ? 700 : 500 }}>歌单</span>
          </label>
        </div>
      </div>

      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', marginTop: 24 }}>
        <div className="glass-card" style={{ minHeight: '100%' }}>
          {activeTab === 'songs' ? (
            favoriteSongs.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 0',
              color: 'var(--text-muted)',
              gap: 12
            }}>
              <Heart size={48} strokeWidth={1} style={{ color: '#ef4444' }} />
              <p style={{ fontSize: 15 }}>暂无收藏歌曲</p>
              <span style={{ fontSize: 11, color: 'var(--text-dark)' }}>点击播放栏的心形图标收藏喜欢的歌曲</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3>全部收藏 ({favoriteSongs.length})</h3>
              </div>
              <div className="song-list-container">
                {favoriteSongs.map((song, index) => (
                  <div
                    key={song.id}
                    className="song-row"
                    onDoubleClick={() => playSong(song)}
                  >
                    <div className="song-col-index">{(index + 1).toString().padStart(2, '0')}</div>
                    <div className="song-col-info">
                      <div className="song-title-row">
                        <span className="song-name">{song.name}</span>
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
                        onClick={() => addToPlaylist(song)}
                        title="添加到播放列表"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )) : activeTab === 'artists' ? (
            favoriteArtists.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 0',
                color: 'var(--text-muted)',
                gap: 12
              }}>
                <Heart size={48} strokeWidth={1} style={{ color: '#ef4444' }} />
                <p style={{ fontSize: 15 }}>暂无收藏歌手</p>
                <span style={{ fontSize: 11, color: 'var(--text-dark)' }}>搜索喜欢的歌手并收藏他们吧</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3>全部歌手 ({favoriteArtists.length})</h3>
                </div>
                <div className="playlist-grid">
                  {favoriteArtists.map(artist => (
                    <div key={artist.id} className="playlist-card" onClick={() => {
                      window.dispatchEvent(new CustomEvent('globalSearch', { detail: artist.name }));
                    }}>
                      <div className="playlist-cover-wrapper" style={{ borderRadius: '50%', overflow: 'hidden', aspectRatio: '1/1' }}>
                        <img src={artist.picUrl || FALLBACK_COVER} alt="cover" className="playlist-card-cover" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                      </div>
                      <span className="playlist-card-name" title={artist.name} style={{ textAlign: 'center', marginTop: 12 }}>{artist.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          ) : (
            favoritePlaylists.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 0',
                color: 'var(--text-muted)',
                gap: 12
              }}>
                <Heart size={48} strokeWidth={1} style={{ color: '#ef4444' }} />
                <p style={{ fontSize: 15 }}>暂无收藏歌单</p>
                <span style={{ fontSize: 11, color: 'var(--text-dark)' }}>去在线音乐页面收藏一些歌单吧</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3>全部歌单 ({favoritePlaylists.length})</h3>
                </div>
                <div className="playlist-grid">
                  {favoritePlaylists.map(pl => (
                    <div key={pl.id} className="playlist-card" onClick={() => handlePlaylistClick(pl.id)}>
                      <div className="playlist-cover-wrapper">
                        <img src={pl.coverImgUrl || FALLBACK_COVER} alt="cover" className="playlist-card-cover" />
                        <div className="playlist-stats">
                          <div className="playlist-stat-item">
                            <Music size={10} />
                            <span>{pl.trackCount || 0}</span>
                          </div>
                        </div>
                      </div>
                      <span className="playlist-card-name" title={pl.name}>{pl.name}</span>
                      <span className="playlist-card-author">{pl.creatorName || '未知'}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};