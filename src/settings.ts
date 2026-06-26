export type MusicSource = 'netease' | 'tencent' | 'kugou' | 'kuwo' | 'migu';

export const DEFAULT_DOWNLOAD_PATH = 'C:\\Users\\Public\\Downloads';
export const DOWNLOAD_PATH_KEY = 'mp3freer_download_path';
export const DEFAULT_SEARCH_SOURCE_KEY = 'mp3freer_default_search_source';
export const DEFAULT_SEARCH_SOURCE: MusicSource = 'netease';
export const PROXY_URL_KEY = 'mp3freer_proxy_url';
export const ENABLED_API_ENDPOINTS_KEY = 'mp3freer_enabled_api_endpoints';

export const API_ENDPOINTS = [
  'https://music-api.gdstudio.xyz',
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
        // filter active endpoints that actually exist in API_ENDPOINTS list
        // wait, the user said "默认全部勾选；这样以后有第三方链接也可以让你继续添加",
        // so if there's a new one added to code, we might want to automatically enable it if we don't do strict check
        // Or we just return the parsed array. Let's return parsed but only items that exist in API_ENDPOINTS,
        // and also append new items from API_ENDPOINTS that aren't in `saved` yet?
        // Actually, let's just return what's parsed, we trust the UI to manage it.
        return parsed;
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
