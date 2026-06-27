import React, { useEffect, useState } from 'react';
import { AlertCircle, Disc, FolderOpen, Trash2 } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  API_ENDPOINTS,
  DEFAULT_DOWNLOAD_PATH,
  DOWNLOAD_PATH_KEY,
  getDefaultSearchSource,
  getDownloadPath,
  getEnabledApiEndpoints,
  getPreferredQuality,
  MUSIC_SOURCES,
  MusicSource,
  QUALITY_OPTIONS,
  AudioQuality,
  setDefaultSearchSource,
  setDownloadPath,
  setEnabledApiEndpoints,
  setPreferredQuality,
} from '../settings';

export const AboutPanel: React.FC = () => {
  const [downloadPath, setDownloadPathState] = useState<string>('');
  const [searchSource, setSearchSource] = useState<MusicSource>('netease');
  const [enabledEndpoints, setEnabledEndpointsState] = useState<string[]>([]);
  const [preferredQuality, setPreferredQualityState] = useState<AudioQuality>('high');

  useEffect(() => {
    const savedDownloadPath = getDownloadPath();
    setDownloadPathState(savedDownloadPath);
    if (!localStorage.getItem(DOWNLOAD_PATH_KEY)) {
      localStorage.setItem(DOWNLOAD_PATH_KEY, DEFAULT_DOWNLOAD_PATH);
    }

    const savedSource = getDefaultSearchSource();
    setSearchSource(savedSource);
    setDefaultSearchSource(savedSource);

    setPreferredQualityState(getPreferredQuality());
    setEnabledEndpointsState(getEnabledApiEndpoints());
  }, []);

  const handleQualityChange = (quality: AudioQuality) => {
    setPreferredQualityState(quality);
    setPreferredQuality(quality);
  };

  const handleClearCache = () => {
    if (confirm('确定要清空导入的本地音乐和收藏索引吗？该操作不会删除磁盘上的音乐文件。')) {
      localStorage.removeItem('mp3freer_local_songs');
      localStorage.removeItem('mp3freer_favorite_songs');
      window.location.reload();
    }
  };

  const handleSelectDownloadPath = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: '选择收藏歌曲下载目录',
      });

      if (selected && !Array.isArray(selected)) {
        setDownloadPathState(selected);
        setDownloadPath(selected);
      }
    } catch (err) {
      console.error('Failed to select download path:', err);
    }
  };

  const handleSourceChange = (source: MusicSource) => {
    setSearchSource(source);
    setDefaultSearchSource(source);
  };

  const handleEndpointToggle = (endpoint: string) => {
    setEnabledEndpointsState(prev => {
      const next = prev.includes(endpoint)
        ? prev.filter(ep => ep !== endpoint)
        : [...prev, endpoint];
      setEnabledApiEndpoints(next);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      <div className="glass-card" style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 24px rgba(168, 85, 247, 0.4)',
        }}>
          <Disc size={40} className="spinning" style={{ color: 'white' }} />
        </div>
        <div>
          <h2>MP3Freer 音乐播放器</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            版本：v1.0.0 | 基于 Tauri v2 的本地与在线音乐播放器。
          </p>
        </div>
      </div>

      <div className="glass-card">
        <h3>系统设置</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div className="setting-row">
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>默认搜索平台</span>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                在线音乐搜索和本地歌曲自动匹配歌词时会优先使用该平台。默认是网易云音乐。
              </p>
              <div className="source-selectors" style={{ marginTop: 10 }}>
                {MUSIC_SOURCES.map(source => (
                  <button
                    key={source.id}
                    className={`source-tab ${searchSource === source.id ? 'active' : ''}`}
                    onClick={() => handleSourceChange(source.id)}
                    type="button"
                  >
                    {source.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="setting-row">
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>播放音质</span>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                在线播放与下载时优先请求的音质档位。无损/Hi-Res 取决于歌曲本身是否拥有高品质源。
              </p>
              <div className="source-selectors" style={{ marginTop: 10 }}>
                {QUALITY_OPTIONS.map(q => (
                  <button
                    key={q.id}
                    className={`source-tab ${preferredQuality === q.id ? 'active' : ''}`}
                    onClick={() => handleQualityChange(q.id)}
                    type="button"
                  >
                    {q.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="setting-row">
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>收藏歌曲下载目录</span>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                收藏在线歌曲时，会自动下载歌曲和歌词到该目录。目录不存在时会提醒并停止收藏下载。
              </p>
              <p style={{ color: 'var(--primary-hover)', fontSize: 11, marginTop: 6, wordBreak: 'break-all' }}>
                {downloadPath || '未设置'}
              </p>
            </div>
            <button className="primary-btn" onClick={handleSelectDownloadPath} style={{ height: 38, marginLeft: 16, flexShrink: 0 }}>
              <FolderOpen size={14} />
              <span style={{ fontSize: 13 }}>选择目录</span>
            </button>
          </div>



          <div className="setting-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>第三方 API 接口节点</span>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                勾选可用节点，系统在请求失败时会自动顺延重试下一个节点。
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {API_ENDPOINTS.map(endpoint => (
                  <label key={endpoint} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-main)' }}>
                    <input
                      type="checkbox"
                      checked={enabledEndpoints.includes(endpoint)}
                      onChange={() => handleEndpointToggle(endpoint)}
                      style={{ accentColor: '#10b981', width: 16, height: 16 }}
                    />
                    {endpoint}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>清理数据索引</span>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                清除本地导入和收藏记录，不会删除任何磁盘上的音乐或歌词文件。
              </p>
            </div>
            <button
              className="primary-btn"
              onClick={handleClearCache}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                boxShadow: 'none',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                height: 38,
              }}
            >
              <Trash2 size={14} />
              <span style={{ fontSize: 13 }}>清除索引</span>
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ display: 'flex', gap: 16, borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.03)' }}>
        <AlertCircle size={24} style={{ color: '#f59e0b', flex: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h4 style={{ color: '#f59e0b' }}>免责声明与服务说明</h4>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)' }}>
            在线解析的数据来自第三方公开网络服务，仅用于个人学习、交流和演示。软件本身不存储、分发或传播任何在线音频文件，相关资源版权归原作者所有。
            <br/><br/>
            <b>版权鸣谢：</b> 本软件内置的第三方音乐搜索解析 API 由 <b>GD音乐台 (music.gdstudio.xyz)</b> 强力提供。感谢原作者的无私奉献与开源精神！
          </p>
        </div>
      </div>
    </div>
  );
};
