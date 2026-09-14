import { Song, FavoritePlaylist, FavoriteArtist } from '../context/PlayerContext';

export interface FavoritesBackupData {
  version: string;
  app: string;
  deviceId: string;
  exportedAt: number;
  favorites: {
    songs: Song[];
    playlists: FavoritePlaylist[];
    artists: FavoriteArtist[];
  };
}

const DEVICE_ID_KEY = 'mp3tao_device_id';
const LAST_SYNC_TIME_KEY = 'mp3tao_last_sync_time';

/**
 * 获取本机的唯一设备识别码
 * 1. 优先读取 Android 原生层注入的 Settings.Secure.ANDROID_ID (同一签名下卸载重装终身不变)
 * 2. 否则读取/生成本地持久化的 UUID
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

/**
 * 静默备份收藏到云端
 */
export async function backupFavoritesToCloud(favorites: {
  songs: Song[];
  playlists: FavoritePlaylist[];
  artists: FavoriteArtist[];
}): Promise<boolean> {
  const deviceId = getDeviceId();
  try {
    // 过滤在线歌曲临时的短期有效流 url，保持数据纯净
    const cleanedSongs = (favorites.songs || []).map(s => ({
      ...s,
      url: s.isLocal ? (s.localPath || s.url) : null,
    }));

    const payload = {
      action: 'backup',
      deviceId,
      favorites: {
        songs: cleanedSongs,
        playlists: favorites.playlists || [],
        artists: favorites.artists || [],
      },
    };

    const resp = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId,
      },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.success) {
        setLastSyncTime(data.updatedAt || Date.now());
        return true;
      }
    }
    return false;
  } catch (err) {
    console.warn('[SyncService] Cloud backup warning:', err);
    return false;
  }
}

/**
 * 从云端拉取恢复收藏数据
 */
export async function restoreFavoritesFromCloud(): Promise<{
  songs: Song[];
  playlists: FavoritePlaylist[];
  artists: FavoriteArtist[];
  updatedAt: number;
} | null> {
  const deviceId = getDeviceId();
  try {
    const resp = await fetch(`/api/sync?action=restore&deviceId=${encodeURIComponent(deviceId)}`, {
      method: 'GET',
      headers: {
        'X-Device-Id': deviceId,
      },
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.success && data.favorites) {
        const fav = data.favorites;
        const songs = Array.isArray(fav.songs) ? fav.songs : [];
        const playlists = Array.isArray(fav.playlists) ? fav.playlists : [];
        const artists = Array.isArray(fav.artists) ? fav.artists : [];
        if (data.updatedAt) {
          setLastSyncTime(data.updatedAt);
        }
        return {
          songs,
          playlists,
          artists,
          updatedAt: data.updatedAt || 0,
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('[SyncService] Cloud restore warning:', err);
    return null;
  }
}

/**
 * 导出收藏为 JSON 文件并触发下载
 */
export function exportFavoritesToFile(favorites: {
  songs: Song[];
  playlists: FavoritePlaylist[];
  artists: FavoriteArtist[];
}) {
  try {
    const backup: FavoritesBackupData = {
      version: '1.0',
      app: 'MP3Tao',
      deviceId: getDeviceId(),
      exportedAt: Date.now(),
      favorites: {
        songs: (favorites.songs || []).map(s => ({
          ...s,
          url: s.isLocal ? (s.localPath || s.url) : null,
        })),
        playlists: favorites.playlists || [],
        artists: favorites.artists || [],
      },
    };

    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `MP3Tao_收藏备份_${dateStr}.json`;

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
 * 从上传的 JSON 文件中解析收藏数据
 */
export async function importFavoritesFromFile(file: File): Promise<{
  songs: Song[];
  playlists: FavoritePlaylist[];
  artists: FavoriteArtist[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error('文件内容为空');
        }
        const data = JSON.parse(text);
        // 支持标准备份结构或纯数组结构
        let songs: Song[] = [];
        let playlists: FavoritePlaylist[] = [];
        let artists: FavoriteArtist[] = [];

        if (data.favorites) {
          songs = Array.isArray(data.favorites.songs) ? data.favorites.songs : [];
          playlists = Array.isArray(data.favorites.playlists) ? data.favorites.playlists : [];
          artists = Array.isArray(data.favorites.artists) ? data.favorites.artists : [];
        } else if (Array.isArray(data)) {
          // 兼容纯歌曲数组导入
          songs = data;
        } else if (Array.isArray(data.songs)) {
          songs = data.songs;
          playlists = data.playlists || [];
          artists = data.artists || [];
        } else {
          throw new Error('无法识别的收藏备份格式');
        }

        resolve({ songs, playlists, artists });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}
