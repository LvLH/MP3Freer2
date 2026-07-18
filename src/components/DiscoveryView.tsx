import React, { useEffect, useRef, useState } from 'react';
import { MusicApiService, OnlinePlaylist, ToplistDetail, OnlineSong } from '../services/musicApi';
import { usePlayer } from '../context/PlayerContext';
import { Play, Music, Flame, Sparkles, Mic2 } from 'lucide-react';
import { DEFAULT_COVER } from '../utils/defaultCover';

const FALLBACK_COVER = DEFAULT_COVER;

export const DiscoveryView: React.FC<{ active?: boolean }> = ({ active = true }) => {
  const { playSong } = usePlayer();
  const [toplists, setToplists] = useState<ToplistDetail[]>([]);
  const [hqPlaylists, setHqPlaylists] = useState<OnlinePlaylist[]>([]);
  const [newSongs, setNewSongs] = useState<OnlineSong[]>([]);
  const [topArtists, setTopArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fetchedRef = useRef(false);

  useEffect(() => {
    // 仅在面板激活时拉取一次，避免 App 用 display:none 常驻挂载各面板时
    // 未激活的 DiscoveryView 也发请求（4 个接口）。
    if (!active || fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchDiscoveryData = async () => {
      setLoading(true);
      try {
        // Fetch official toplists and high-quality playlists concurrently
        const [tLists, hqLists, nSongs, artists] = await Promise.all([
          MusicApiService.getNeteaseToplists(),
          MusicApiService.getNeteaseHighQualityPlaylists(),
          MusicApiService.getNewSongs(),
          MusicApiService.getTopArtists()
        ]);
        
        setToplists(tLists || []);
        setHqPlaylists(hqLists || []);
        setNewSongs((nSongs || []).slice(0, 10)); // Just show top 10 new songs
        setTopArtists((artists || []).slice(0, 12));

      } catch (e: any) {
        console.error('Failed to fetch discovery data', e);
        setErrorMsg(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    };

    fetchDiscoveryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const handlePlaylistClick = (id: string) => {
    window.dispatchEvent(new CustomEvent('openPlaylist', { detail: id }));
  };

  const formatCount = (count?: number) => {
    if (!count) return '0';
    if (count > 100000000) return (count / 100000000).toFixed(1) + '亿';
    if (count > 10000) return (count / 10000).toFixed(1) + '万';
    return count.toString();
  };

  const handlePlaySong = (onlineSong: OnlineSong) => {
    playSong({
      ...onlineSong,
      isLocal: false,
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: '20px 0' }}>
        {/* Skeleton UI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton-box" style={{ width: 120, height: 28, borderRadius: 8 }} />
          <div className="playlist-grid">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton-box" style={{ aspectRatio: '1/1', borderRadius: 12 }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton-box" style={{ width: 120, height: 28, borderRadius: 8 }} />
          <div className="playlist-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton-box" style={{ height: 160, borderRadius: 12 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36, padding: '20px 0', animation: 'fadeIn 0.5s ease' }}>
      
      {/* 精品歌单 */}
      {hqPlaylists.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Sparkles size={20} style={{ color: 'var(--primary-color)' }} />
            <h2 style={{ fontSize: 18, margin: 0 }}>精品推荐</h2>
          </div>
          <div className="playlist-grid">
            {hqPlaylists.map(pl => (
              <div key={pl.id} className="playlist-card" onClick={() => handlePlaylistClick(pl.id)}>
                <div className="playlist-cover-wrapper">
                  <img src={pl.cover || FALLBACK_COVER} alt="cover" className="playlist-card-cover" />
                  <div className="playlist-stats">
                    <div className="playlist-stat-item">
                      <Play size={10} fill="currentColor" />
                      <span>{formatCount(pl.playCount)}</span>
                    </div>
                  </div>
                </div>
                <span className="playlist-card-name" title={pl.name}>{pl.name}</span>
                <span className="playlist-card-author">{pl.creatorName || '官方'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 热门歌手 */}
      {topArtists.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Mic2 size={20} style={{ color: '#10b981' }} />
            <h2 style={{ fontSize: 18, margin: 0 }}>热门歌手</h2>
          </div>
          <div className="playlist-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
            {topArtists.map(artist => (
              <div 
                key={artist.id} 
                className="playlist-card" 
                onClick={() => window.dispatchEvent(new CustomEvent('globalSearch', { detail: artist.name }))}
                style={{ textAlign: 'center' }}
              >
                <div className="playlist-cover-wrapper" style={{ borderRadius: '50%', aspectRatio: '1/1', overflow: 'hidden' }}>
                  <img src={artist.picUrl || FALLBACK_COVER} alt={artist.name} className="playlist-card-cover" style={{ objectFit: 'cover' }} />
                </div>
                <span className="playlist-card-name" style={{ marginTop: 12, display: 'block', width: '100%' }} title={artist.name}>{artist.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 官方榜单 */}
      {toplists.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Flame size={20} style={{ color: '#ef4444' }} />
            <h2 style={{ fontSize: 18, margin: 0 }}>官方榜单</h2>
          </div>
          <div className="toplist-grid">
            {toplists.map(tl => (
              <div key={tl.id} className="toplist-card glass-card" onClick={() => handlePlaylistClick(tl.id)}>
                <div className="toplist-cover-wrapper">
                  <img src={tl.cover || FALLBACK_COVER} alt={tl.name} className="toplist-cover" />
                  <div className="toplist-overlay">
                    <Play size={24} fill="white" />
                  </div>
                </div>
                <div className="toplist-info">
                  <h4 className="toplist-name">{tl.name}</h4>
                  <div className="toplist-tracks">
                    {tl.topTracks?.map((track, idx) => (
                      <div key={idx} className="toplist-track-item">
                        <span className="track-idx">{idx + 1}</span>
                        <span className="track-name">{track.first}</span>
                        <span className="track-artist">- {track.second}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 新歌速递 */}
      {newSongs.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Music size={20} style={{ color: '#3b82f6' }} />
            <h2 style={{ fontSize: 18, margin: 0 }}>新歌速递</h2>
          </div>
          <div className="song-list-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {newSongs.map((song) => (
              <div 
                key={song.id} 
                className="song-row" 
                style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.03)' }}
                onClick={() => handlePlaySong(song)}
              >
                <div className="song-col-info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="song-title-row">
                    <span className="song-name" style={{ fontSize: 14 }}>{song.name}</span>
                  </div>
                  <span className="song-artist" style={{ fontSize: 12 }}>{song.artist}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 空状态保护 */}
      {!loading && toplists.length === 0 && hqPlaylists.length === 0 && newSongs.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', marginTop: 60 }}>
          <Sparkles size={48} strokeWidth={1} style={{ marginBottom: 16, color: 'var(--primary-color)' }} />
          <h3 style={{ margin: 0 }}>探索发现</h3>
          <p style={{ marginTop: 8, fontSize: 13 }}>暂未获取到推荐内容，请尝试搜索你想听的歌曲</p>
          {errorMsg && (
            <p style={{ marginTop: 16, fontSize: 12, color: '#ef4444', maxWidth: '80%', textAlign: 'center', wordBreak: 'break-all' }}>
              Error Detail: {errorMsg}
            </p>
          )}
        </div>
      )}

    </div>
  );
};
