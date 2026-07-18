export type MusicSource = 'netease' | 'tencent' | 'kugou' | 'kuwo' | 'migu';

/**
 * 应用版本号（单一来源）。
 * package.json / tauri.conf.json / Cargo.toml 必须与此保持一致。
 * 显示时统一带 v 前缀。
 */
export const APP_VERSION = '26.7.17';

/** 音质档位：标准 128 / 高品 320 / 无损 / Hi-Res */
export type AudioQuality = 'standard' | 'high' | 'lossless' | 'hires';

export const QUALITY_OPTIONS: Array<{ id: AudioQuality; name: string; br: string }> = [
  { id: 'standard', name: '标准 128k', br: '128' },
  { id: 'high', name: '高品 320k', br: '320' },
  { id: 'lossless', name: '无损 FLAC', br: '999' },
  { id: 'hires', name: 'Hi-Res', br: '1999' },
];

export const DEFAULT_DOWNLOAD_PATH = 'C:\\Users\\Public\\Downloads';
export const DOWNLOAD_PATH_KEY = 'mp3freer_download_path';
export const DEFAULT_SEARCH_SOURCE_KEY = 'mp3freer_default_search_source';
export const DEFAULT_SEARCH_SOURCE: MusicSource = 'netease';
export const PROXY_URL_KEY = 'mp3freer_proxy_url';
export const ENABLED_API_ENDPOINTS_KEY = 'mp3freer_enabled_api_endpoints';
export const PREFERRED_QUALITY_KEY = 'mp3freer_preferred_quality';
export const DEFAULT_QUALITY: AudioQuality = 'high';

export const API_ENDPOINTS = [
  'https://music-api.gdstudio.xyz',
  'https://api.xingzhige.com',
];

export const MUSIC_SOURCES: Array<{ id: MusicSource; name: string }> = [
  { id: 'netease', name: '网易云音乐' },
  { id: 'tencent', name: 'QQ 音乐' },
  { id: 'kugou', name: '酷狗音乐' },
  { id: 'kuwo', name: '酷我音乐' },
  { id: 'migu', name: '咪咕音乐' },
];

export function getDownloadPath(): string {
  const savedPath = localStorage.getItem(DOWNLOAD_PATH_KEY);
  return savedPath || DEFAULT_DOWNLOAD_PATH;
}

export function setDownloadPath(path: string) {
  localStorage.setItem(DOWNLOAD_PATH_KEY, path);
}

export function getDefaultSearchSource(): MusicSource {
  const savedSource = localStorage.getItem(DEFAULT_SEARCH_SOURCE_KEY);
  if (MUSIC_SOURCES.some(source => source.id === savedSource)) {
    return savedSource as MusicSource;
  }
  return DEFAULT_SEARCH_SOURCE;
}

export function setDefaultSearchSource(source: MusicSource) {
  localStorage.setItem(DEFAULT_SEARCH_SOURCE_KEY, source);
}

export function getProxyUrl(): string {
  return localStorage.getItem(PROXY_URL_KEY) || '';
}

export function setProxyUrl(url: string) {
  if (url) {
    localStorage.setItem(PROXY_URL_KEY, url);
  } else {
    localStorage.removeItem(PROXY_URL_KEY);
  }
}

export function getEnabledApiEndpoints(): string[] {
  const saved = localStorage.getItem(ENABLED_API_ENDPOINTS_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // 只保留是字符串且以 http 开头的合法 URL，过滤掉被污染或手改坏的值
        const valid = parsed.filter(
          (ep): ep is string => typeof ep === 'string' && /^https?:\/\//i.test(ep)
        );
        // 校验后回写，剔除脏数据；若全部非法则走默认
        if (valid.length > 0) return valid;
      }
    } catch (e) {
      console.warn('Failed to parse enabled API endpoints', e);
    }
  }
  // Default: all enabled
  return [...API_ENDPOINTS];
}

export function setEnabledApiEndpoints(endpoints: string[]) {
  localStorage.setItem(ENABLED_API_ENDPOINTS_KEY, JSON.stringify(endpoints));
}

export function getPreferredQuality(): AudioQuality {
  const saved = localStorage.getItem(PREFERRED_QUALITY_KEY);
  if (QUALITY_OPTIONS.some(q => q.id === saved)) {
    return saved as AudioQuality;
  }
  return DEFAULT_QUALITY;
}

export function setPreferredQuality(quality: AudioQuality) {
  localStorage.setItem(PREFERRED_QUALITY_KEY, quality);
}

export function getQualityBr(quality: AudioQuality): string {
  return QUALITY_OPTIONS.find(q => q.id === quality)?.br || '320';
}
