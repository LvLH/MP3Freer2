import React, { useState, useRef } from 'react';
import { Heart, Play, Plus, Music, ArrowUp, Download, Upload, RefreshCw, Key, Edit3, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { CoverImage } from './CoverImage';
import { MUSIC_SOURCES } from '../settings';
import { DEFAULT_SYNC_CODE } from '../services/syncService';

export const FavoritePanel: React.FC = () => {
  const {
    favoriteSongs,
    favoritePlaylists,
    favoriteArtists,
    playSong,
    addToPlaylist,
    exportFavorites,
    importFavorites,
    syncFavoritesNow,
    uploadFavoritesNow,
    restoreFavoritesNow,
    syncCode,
    updateSyncCode,
  } = usePlayer();
  const [activeTab, setActiveTab] = useState<'songs' | 'artists' | 'playlists'>('songs');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [tempCode, setTempCode] = useState(syncCode);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSyncClick = async () => {
    setIsSyncing(true);
    try {
      await syncFavoritesNow();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void importFavorites(file);
      e.target.value = '';
    }
  };

  const handleSaveSyncCode = () => {
    const trimmed = tempCode.trim();
    if (!trimmed) return;
    updateSyncCode(trimmed);
    setShowCodeModal(false);
  };

  const formatSecs = (secs: number) => {
    if (!secs) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlaylistClick = (id: string) => {
    window.dispatchEvent(new CustomEvent('openPlaylist', {
      detail: { id, isNeteaseDirect: true, source: 'netease' },
    }));
    window.dispatchEvent(new CustomEvent('globalSearch', { detail: '' }));
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFile}
        accept=".json"
        style={{ display: 'none' }}
      />
      <div className="glass-card" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="back-to-top-btn" onClick={scrollToTop} title="回到顶部">
              <ArrowUp size={18} />
            </button>
            <Heart size={24} fill="#ef4444" stroke="#ef4444" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0 }}>我的收藏</h2>
                <button
                  type="button"
                  onClick={() => {
                    setTempCode(syncCode);
                    setShowCodeModal(true);
                  }}
                  title="点击修改同步暗号，多端输入相同暗号即可互通"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    padding: '3px 10px',
                    borderRadius: 14,
                    background: 'rgba(168, 85, 247, 0.18)',
                    color: '#c084fc',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <Key size={13} />
                  <span>暗号: <strong>{syncCode}</strong></span>
                  <Edit3 size={11} style={{ opacity: 0.7 }} />
                </button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                安卓手机、车机与电脑端输入相同暗号即可实时双向互通；新增收藏自动云端静默同步。
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleSyncClick}
              disabled={isSyncing}
              title="立即与云端双向智能合并"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#d8b4fe',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={13} className={isSyncing ? 'spin' : ''} />
              <span>{isSyncing ? '同步中...' : '立即双向同步'}</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="从备份的 JSON 文件导入收藏"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-main)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                cursor: 'pointer',
              }}
            >
              <Upload size={13} />
              <span>导入备份</span>
            </button>
            <button
              onClick={exportFavorites}
              title="将当前收藏导出为 JSON 备份文件"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-main)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                cursor: 'pointer',
              }}
            >
              <Download size={13} />
              <span>导出备份</span>
            </button>
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
                          {song.isLocal ? '本地' : MUSIC_SOURCES.find(item => item.id === song.source)?.name || song.source}
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
                        <CoverImage src={artist.picUrl} alt="" className="playlist-card-cover" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
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
                        <CoverImage src={pl.coverImgUrl} alt="" className="playlist-card-cover" />
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

      {/* 修改同步暗号模态弹窗 */}
      {showCodeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowCodeModal(false)}
        >
          <div
            style={{
              background: '#1e1e24',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 14,
              padding: 24,
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Key size={18} style={{ color: '#c084fc' }} />
                <h3 style={{ margin: 0, fontSize: 16 }}>设置云端同步暗号</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCodeModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, margin: '0 0 16px 0' }}>
              不同设备（安卓手机、车机、电脑）只需输入<strong>完全一致的暗号</strong>，即可实现收藏无缝双向互通。默认暗号为 <code>{DEFAULT_SYNC_CODE}</code>。
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                type="text"
                value={tempCode}
                onChange={e => setTempCode(e.target.value)}
                placeholder="例如: SKY-0608"
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  outline: 'none',
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveSyncCode();
                }}
              />
              <button
                type="button"
                onClick={() => setTempCode(DEFAULT_SYNC_CODE)}
                style={{
                  padding: '0 10px',
                  fontSize: 12,
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--text-muted)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                恢复默认
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setShowCodeModal(false)}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 8,
                  fontSize: 13,
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-muted)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveSyncCode}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  background: '#9333ea',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                保存暗号
              </button>
            </div>

            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <button
                type="button"
                onClick={async () => {
                  setShowCodeModal(false);
                  await uploadFavoritesNow();
                }}
                title="用本地当前收藏直接覆盖云端该暗号对应的数据"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-muted)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                }}
              >
                <ArrowUpCircle size={12} />
                <span>仅备份到云端</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowCodeModal(false);
                  await restoreFavoritesNow();
                }}
                title="直接拉取云端该暗号数据覆盖/恢复本地收藏"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-muted)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                }}
              >
                <ArrowDownCircle size={12} />
                <span>从云端强制恢复</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};