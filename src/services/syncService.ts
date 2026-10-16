import { Song, FavoritePlaylist, FavoriteArtist } from '../types/music';
import { storage, StorageKeys } from './storage';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export interface FavoritesBackupData {
  version: string;
  app: string;
  syncCode: string;
  deviceId: string;
  exportedAt: number;
  favorites: {
    songs: Song[];
    playlists: FavoritePlaylist[];
    artists: FavoriteArtist[];
  };
}

/**
 * 按照规则生成随机暗号：SKY-开头 + 1个随机大写字母 + 1个随机三位数
 * 例如: SKY-A128, SKY-K892, SKY-Z007
 */
export function generateRandomSyncCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetter = letters[Math.floor(Math.random() * letters.length)];
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `SKY-${randomLetter}${randomNum}`;
}

export const DEFAULT_SYNC_CODE = 'SKY-0608';
const DEVICE_ID_KEY = 'mp3tao_device_id';
const LAST_SYNC_TIME_KEY = 'mp3tao_last_sync_time';

const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

async function universalFetch(url: string, options?: any) {
  if (isTauri) {
    return await tauriFetch(url, options);
  }
  return await fetch(url, options);
}

/** 获取当前同步暗号（若本地未设置，则自动按规则生成并持久化一个独立随机暗号） */
export function getSyncCode(): string {
  if (typeof window === 'undefined') return DEFAULT_SYNC_CODE;
  const saved = storage.getString(StorageKeys.SYNC_CODE);
  if (saved && saved.trim().length > 0) {
    return saved.trim();
  }
  const newCode = generateRandomSyncCode();
  storage.setString(StorageKeys.SYNC_CODE, newCode);
  return newCode;
}

/** 设置同步暗号 */
export function setSyncCode(code: string): void {
  const clean = (code || '').trim() || generateRandomSyncCode();
  storage.setString(StorageKeys.SYNC_CODE, clean);
}

/** 获取自定义同步服务器地址（可选） */
export function getSyncServerUrl(): string {
  if (typeof window === 'undefined') return '';
  return storage.getString(StorageKeys.SYNC_SERVER_URL) || '';
}

/** 设置自定义同步服务器地址 */
export function setSyncServerUrl(url: string): void {
  storage.setString(StorageKeys.SYNC_SERVER_URL, (url || '').trim());
}

/**
 * 获取本机的唯一设备识别码（用于日志与来源追踪）
 */
export function getDeviceId(): string {
  if (typeof window !== 'undefined') {
    const bridge = (window as any).AndroidMediaBridge;
    if (bridge && typeof bridge.getDeviceId === 'function') {
      try {
        const androidId = bridge.getDeviceId();
        if (androidId && typeof androidId === 'string' && androidId.trim().length > 4) {
          return `android_${androidId.trim()}`;
        }
      } catch (e) {
        console.warn('Failed to get native Android ID:', e);
      }
    }

    let saved = localStorage.getItem(DEVICE_ID_KEY);
    if (!saved || saved.length < 8) {
      saved = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, saved);
    }
    return saved;
  }
  return 'unknown_device';
}

export function getLastSyncTime(): number {
  if (typeof window === 'undefined') return 0;
  const t = localStorage.getItem(LAST_SYNC_TIME_KEY);
  return t ? Number(t) || 0 : 0;
}

export function setLastSyncTime(time: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_SYNC_TIME_KEY, String(time));
  }
}

/** 将暗号转换为安全的网络路径标识 */
function getSafeSyncPath(syncCode: string): string {
  const alphanumeric = syncCode.replace(/[^a-zA-Z0-9]/g, '');
  return `mp3tao_sync_${alphanumeric || 'SKY0608'}`;
}

/** 纯净化收藏歌曲：剥离临时流地址及大段歌词文本，大幅缩减体积并加速同步与持久化 */
export function sanitizeFavoriteSong(s: Song): Song {
  const { lyric, ...rest } = s;
  return {
    ...rest,
    url: s.isLocal ? (s.localPath || s.url || null) : null,
  };
}

/**
 * 将收藏数据备份到云端（以暗号 SKY-0608 为凭证）
 */
export async function backupFavoritesToCloud(favorites: {
  songs: Song[];
  playlists: FavoritePlaylist[];
  artists: FavoriteArtist[];
}): Promise<{ success: boolean; message?: string }> {
  const syncCode = getSyncCode();
  const deviceId = getDeviceId();
  const now = Date.now();

  try {
    // 过滤在线歌曲临时的短期有效流 url 并剔除歌词文本，保持数据极简轻量
    const cleanedSongs = (favorites.songs || []).map(sanitizeFavoriteSong);

    const payload: FavoritesBackupData = {
      version: '1.0',
      app: 'MP3Tao',
      syncCode,
      deviceId,
      exportedAt: now,
      favorites: {
        songs: cleanedSongs,
        playlists: favorites.playlists || [],
        artists: favorites.artists || [],
      },
    };

    const serverUrl = getSyncServerUrl();

    // 1. 若配置了自定义云端同步服务器
    if (serverUrl) {
      try {
        const resp = await universalFetch(`${serverUrl.replace(/\/+$/, '')}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': deviceId,
            'X-Sync-Code': syncCode,
          },
          body: JSON.stringify({
            action: 'backup',
            syncCode,
            deviceId,
            favorites: payload.favorites,
          }),
        });
        if (resp.ok) {
          const resData = await resp.json();
          if (resData.success) {
            setLastSyncTime(now);
            return { success: true };
          }
        }
      } catch (custErr) {
        console.warn('Custom sync server failed, falling back to public relay:', custErr);
      }
    }

    // 2. 默认开箱即用公网极速同步通道（以暗号构建专属云中继）
    const path = getSafeSyncPath(syncCode);
    const postBody = new URLSearchParams({
      content: JSON.stringify(payload),
    }).toString();

    const resp = await universalFetch(`https://cl1p.net/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: postBody,
    });

    if (resp.ok) {
      setLastSyncTime(now);
      return { success: true };
    }

    return { success: false, message: `上传状态码异常: ${resp.status}` };
  } catch (err: any) {
    console.error('[SyncService] Cloud backup error:', err);
    return { success: false, message: err?.message || '网络连接异常' };
  }
}

/**
 * 从云端拉取恢复收藏数据（以暗号 SKY-0608 为凭证）
 */
export async function restoreFavoritesFromCloud(): Promise<{
  songs: Song[];
  playlists: FavoritePlaylist[];
  artists: FavoriteArtist[];
  updatedAt: number;
} | null> {
  const syncCode = getSyncCode();
  const deviceId = getDeviceId();
  const serverUrl = getSyncServerUrl();

  try {
    // 1. 若配置了自定义云端同步服务器
    if (serverUrl) {
      try {
        const resp = await universalFetch(
          `${serverUrl.replace(/\/+$/, '')}/api/sync?action=restore&syncCode=${encodeURIComponent(syncCode)}&deviceId=${encodeURIComponent(deviceId)}`,
          {
            method: 'GET',
            headers: {
              'X-Device-Id': deviceId,
              'X-Sync-Code': syncCode,
            },
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data.success && data.favorites) {
            const fav = data.favorites;
            const songs = Array.isArray(fav.songs) ? fav.songs : [];
            const playlists = Array.isArray(fav.playlists) ? fav.playlists : [];
            const artists = Array.isArray(fav.artists) ? fav.artists : [];
            if (data.updatedAt) setLastSyncTime(data.updatedAt);
            return {
              songs,
              playlists,
              artists,
              updatedAt: data.updatedAt || 0,
            };
          }
        }
      } catch (custErr) {
        console.warn('Custom sync restore failed, fallback to public relay:', custErr);
      }
    }

    // 2. 默认开箱即用公网极速同步通道
    const path = getSafeSyncPath(syncCode);
    const resp = await universalFetch(`https://cl1p.net/${path}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    if (resp.ok) {
      const html = await resp.text();
      const match =
        html.match(/<textarea[^>]*id=["']cl1ptextarea["'][^>]*>([\s\S]*?)<\/textarea>/i) ||
        html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i);

      if (match && match[1]) {
        const rawContent = match[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');

        try {
          const parsed = JSON.parse(rawContent);
          const fav = parsed.favorites || parsed;
          const rawSongs = Array.isArray(fav.songs) ? fav.songs : [];
          const songs = rawSongs.map(sanitizeFavoriteSong);
          const playlists = Array.isArray(fav.playlists) ? fav.playlists : [];
          const artists = Array.isArray(fav.artists) ? fav.artists : [];
          const updatedAt = parsed.exportedAt || parsed.updatedAt || 0;
          if (updatedAt) setLastSyncTime(updatedAt);
          return {
            songs,
            playlists,
            artists,
            updatedAt,
          };
        } catch (jsonErr) {
          console.warn('[SyncService] Parse cloud json warning:', jsonErr);
        }
      }
    }
    return null;
  } catch (err) {
    console.warn('[SyncService] Cloud restore warning:', err);
    return null;
  }
}

/**
 * 智能合并本地与云端收藏（并集去重，剥离歌词与失效流地址）
 */
export function mergeFavoritesData(
  local: { songs: Song[]; playlists: FavoritePlaylist[]; artists: FavoriteArtist[] },
  cloud: { songs: Song[]; playlists: FavoritePlaylist[]; artists: FavoriteArtist[] }
) {
  // 1. 合并歌曲 (以 ID 去重并纯净化)
  const songMap = new Map<string, Song>();
  (local.songs || []).forEach(s => songMap.set(s.id, sanitizeFavoriteSong(s)));
  (cloud.songs || []).forEach(s => {
    if (!songMap.has(s.id)) {
      songMap.set(s.id, sanitizeFavoriteSong(s));
    }
  });

  // 2. 合并歌单 (以 ID 去重)
  const playlistMap = new Map<string, FavoritePlaylist>();
  (local.playlists || []).forEach(p => playlistMap.set(p.id, p));
  (cloud.playlists || []).forEach(p => {
    if (!playlistMap.has(p.id)) {
      playlistMap.set(p.id, p);
    }
  });

  // 3. 合并歌手 (以 ID 或 name 去重)
  const artistMap = new Map<string, FavoriteArtist>();
  (local.artists || []).forEach(a => artistMap.set(a.id || a.name, a));
  (cloud.artists || []).forEach(a => {
    const key = a.id || a.name;
    if (!artistMap.has(key)) {
      artistMap.set(key, a);
    }
  });

  return {
    songs: Array.from(songMap.values()),
    playlists: Array.from(playlistMap.values()),
    artists: Array.from(artistMap.values()),
  };
}

/**
 * 导出收藏为轻量 JSON 文件并触发下载（彻底剔除歌词与临时流地址）
 */
export function exportFavoritesToFile(favorites: {
  songs: Song[];
  playlists: FavoritePlaylist[];
  artists: FavoriteArtist[];
}) {
  try {
    const syncCode = getSyncCode();
    const backup: FavoritesBackupData = {
      version: '1.0',
      app: 'MP3Tao',
      syncCode,
      deviceId: getDeviceId(),
      exportedAt: Date.now(),
      favorites: {
        songs: (favorites.songs || []).map(sanitizeFavoriteSong),
        playlists: favorites.playlists || [],
        artists: favorites.artists || [],
      },
    };

    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `MP3Tao_收藏备份_${syncCode}_${dateStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return filename;
  } catch (err: any) {
    console.error('Export failed:', err);
    throw err;
  }
}

/**
 * 从上传的 JSON 文件中解析收藏数据（自动剔除大段歌词）
 */
export async function importFavoritesFromFile(file: File): Promise<{
  songs: Song[];
  playlists: FavoritePlaylist[];
  artists: FavoriteArtist[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error('文件内容为空');
        }
        const data = JSON.parse(text);
        let songs: Song[] = [];
        let playlists: FavoritePlaylist[] = [];
        let artists: FavoriteArtist[] = [];

        if (data.favorites) {
          songs = Array.isArray(data.favorites.songs) ? data.favorites.songs : [];
          playlists = Array.isArray(data.favorites.playlists) ? data.favorites.playlists : [];
          artists = Array.isArray(data.favorites.artists) ? data.favorites.artists : [];
        } else if (Array.isArray(data)) {
          songs = data;
        } else if (Array.isArray(data.songs)) {
          songs = data.songs;
          playlists = data.playlists || [];
          artists = data.artists || [];
        } else {
          throw new Error('无法识别的收藏备份格式');
        }

        resolve({
          songs: songs.map(sanitizeFavoriteSong),
          playlists,
          artists,
        });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}
