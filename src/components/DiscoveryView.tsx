import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MusicApiService, OnlinePlaylist, ToplistDetail, OnlineSong } from '../services/musicApi';
import { usePlayer } from '../context/PlayerContext';
import { Play, Music, Flame, Sparkles, Mic2, RefreshCw } from 'lucide-react';
import { toPlayerSong } from '../utils/songUtils';
import { CoverImage } from './CoverImage';
/** 精品推荐每次展示条数 */
const HQ_DISPLAY_COUNT = 10;
/** 一次多拉一些，便于打乱/换一批 */
const HQ_FETCH_LIMIT = 40;
/** 发现页整体数据过期时间：再次进入时超过则重拉 */
const DISCOVERY_TTL_MS = 15 * 60 * 1000;
const HQ_CATS = ['全部', '华语', '流行', '电子', '轻音乐', '摇滚', '民谣', '说唱', '古风', '欧美'];

function shufflePick<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

function randomHqCat(): string {
  return HQ_CATS[Math.floor(Math.random() * HQ_CATS.length)];
}

export const DiscoveryView: React.FC<{ active?: boolean }> = ({ active = true }) => {
  const { playSong } = usePlayer();
  const [toplists, setToplists] = useState<ToplistDetail[]>([]);
  const [hqPlaylists, setHqPlaylists] = useState<OnlinePlaylist[]>([]);
  const [hqPool, setHqPool] = useState<OnlinePlaylist[]>([]);
  const [hqCat, setHqCat] = useState('全部');
  const [hqRefreshing, setHqRefreshing] = useState(false);
  const [newSongs, setNewSongs] = useState<OnlineSong[]>([]);
  const [topArtists, setTopArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fetchedRef = useRef(false);
  const lastFetchedAtRef = useRef(0);
  const hqBeforeRef = useRef<number | undefined>(undefined);

  const loadHighQuality = useCallback(async (mode: 'reshuffle' | 'refresh') => {
    // 池子够大时先本地重抽，避免每次点「换一批」都打接口
    if (mode === 'reshuffle' && hqPool.length > HQ_DISPLAY_COUNT) {
      setHqPlaylists(shufflePick(hqPool, HQ_DISPLAY_COUNT));
      return;
    }

    setHqRefreshing(true);
    try {
      const cat = randomHqCat();
      const { playlists, lastUpdateTime } = await MusicApiService.getNeteaseHighQualityPlaylists({
        limit: HQ_FETCH_LIMIT,
        cat,
        // 同分类翻页：池子不够时用游标再取一页
        before: mode === 'refresh' ? undefined : hqBeforeRef.current,
      });

      let pool = playlists;
      let usedCat = cat;
      let usedBefore = lastUpdateTime;
      if (pool.length === 0) {
        usedCat = randomHqCat();
        const retry = await MusicApiService.getNeteaseHighQualityPlaylists({
          limit: HQ_FETCH_LIMIT,
          cat: usedCat,
        });
        pool = retry.playlists;
        usedBefore = retry.lastUpdateTime;
      }

      setHqCat(usedCat);
      setHqPool(pool);
      hqBeforeRef.current = usedBefore;
      setHqPlaylists(shufflePick(pool, HQ_DISPLAY_COUNT));
    } finally {
      setHqRefreshing(false);
    }
  }, [hqPool]);

  useEffect(() => {
    // 面板激活时拉取；15 分钟内重复进入复用缓存，避免每次切换侧边栏都打 4 个接口
    if (!active) return;
    const stale = Date.now() - lastFetchedAtRef.current > DISCOVERY_TTL_MS;
    if (fetchedRef.current && !stale) return;
    fetchedRef.current = true;

    const fetchDiscoveryData = async () => {
      setLoading(true);
      try {
        const cat = randomHqCat();
        const [tLists, hqResult, nSongs, artists] = await Promise.all([
          MusicApiService.getNeteaseToplists(),
          MusicApiService.getNeteaseHighQualityPlaylists({ limit: HQ_FETCH_LIMIT, cat }),
          MusicApiService.getNewSongs(),
          MusicApiService.getTopArtists(),
        ]);

        setToplists(tLists || []);
        setHqCat(cat);
        setHqPool(hqResult.playlists || []);
        hqBeforeRef.current = hqResult.lastUpdateTime;
        setHqPlaylists(shufflePick(hqResult.playlists || [], HQ_DISPLAY_COUNT));
        setNewSongs((nSongs || []).slice(0, 10));
        setTopArtists((artists || []).slice(0, 12));
        lastFetchedAtRef.current = Date.now();
      } catch (e: any) {
        console.error('Failed to fetch discovery data', e);
        setErrorMsg(e?.message || String(e));
        fetchedRef.current = false;
      } finally {
        setLoading(false);
      }
    };

    void fetchDiscoveryData();
  }, [active]);

  const handlePlaylistClick = (id: string) => {
    window.dispatchEvent(new CustomEvent('openPlaylist', {
      detail: { id, isNeteaseDirect: true, source: 'netease' },
    }));
  };

  const formatCount = (count?: number) => {
    if (!count) return '0';
    if (count > 100000000) return (count / 100000000).toFixed(1) + '亿';
    if (count > 10000) return (count / 10000).toFixed(1) + '万';
    return count.toString();
  };

  const handlePlaySong = (onlineSong: OnlineSong) => {
    void playSong(toPlayerSong(onlineSong));
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
      
      {/* 精品歌单：多拉一批 + 打乱展示；可换一批 */}
      {hqPlaylists.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Sparkles size={20} style={{ color: 'var(--primary-color)' }} />
            <h2 style={{ fontSize: 18, margin: 0 }}>精品推荐</h2>
            {hqCat && hqCat !== '全部' && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hqCat}</span>
            )}
            <button
              className="icon-btn"
              onClick={() => void loadHighQuality(hqPool.length > HQ_DISPLAY_COUNT ? 'reshuffle' : 'refresh')}
              disabled={hqRefreshing}
              title="换一批精品歌单"
              style={{
                marginLeft: 'auto',
                width: 'auto',
                height: 28,
                padding: '0 10px',
                gap: 6,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.05)',
                fontSize: 12,
                opacity: hqRefreshing ? 0.6 : 1,
              }}
            >
              <RefreshCw size={13} className={hqRefreshing ? 'animate-spin' : undefined} />
              <span>换一批</span>
            </button>
          </div>
          <div className="playlist-grid">
            {hqPlaylists.map(pl => (
              <div key={pl.id} className="playlist-card" onClick={() => handlePlaylistClick(pl.id)}>
                <div className="playlist-cover-wrapper">
                  <CoverImage src={pl.cover} alt="" className="playlist-card-cover" />
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
                  <CoverImage src={artist.picUrl} alt={artist.name} className="playlist-card-cover" style={{ objectFit: 'cover' }} />
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
                  <CoverImage src={tl.cover} alt={tl.name} className="toplist-cover" />
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
          <div className="song-list-container discovery-newsong-grid">
            {newSongs.map((song) => (
              <div 
                key={song.id} 
                className="song-row discovery-song-row"
                onClick={() => handlePlaySong(song)}
              >
                <CoverImage src={song.pic || ''} alt="" className="discovery-song-cover" />
                <div className="song-col-info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="song-title-row">
                    <span className="song-name" style={{ fontSize: 14 }}>{song.name}</span>
                  </div>
                  <span className="song-artist" style={{ fontSize: 12 }}>{song.artist}</span>
                </div>
                <div className="discovery-play-icon">
                  <Play size={15} fill="currentColor" />
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
