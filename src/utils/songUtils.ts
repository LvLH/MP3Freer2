import { exists, readDir } from '@tauri-apps/plugin-fs';
import type { HistoryEntry, Song } from '../types/music';
import type { OnlineSong } from '../services/musicApi';

/**
 * 文件名/路径与歌曲身份相关的纯工具函数
 */

/** 在线歌曲统一转为播放器 Song（所有入口必须走这里，避免 id 不一致） */
export function toPlayerSong(onlineSong: OnlineSong): Song {
  return {
    id: `online_${onlineSong.source}_${onlineSong.id}`,
    originalId: onlineSong.id,
    name: onlineSong.name,
    artist: onlineSong.artist,
    album: onlineSong.album,
    url: null, // 在线流地址易过期，播放时动态解析，不写入 Song
    pic: onlineSong.pic || null,
    duration: onlineSong.duration || 0,
    isLocal: false,
    source: onlineSong.source,
    pic_id: onlineSong.pic_id,
    lyric_id: onlineSong.lyric_id,
  };
}

/** 解析在线歌曲的平台原始 ID（用于 API 请求） */
export function resolveOnlineApiId(song: Song): string {
  if (song.originalId) return song.originalId;
  const prefix = `online_${song.source}_`;
  if (song.id.startsWith(prefix)) return song.id.slice(prefix.length);
  return song.id;
}

/**
 * 规范化歌曲身份，剥离易过期的在线流地址与大段歌词文本（歌词播放时动态拉取或读本地 .lrc，不入库）。
 * 用于从 localStorage 恢复旧数据（曾用原始平台 id、写入了 CDN url 或包含庞大歌词文本）。
 */
export function normalizePersistedSong(song: Song): Song {
  const { lyric, ...rest } = song;
  if (song.isLocal) {
    return {
      ...rest,
      url: song.localPath || song.url || null,
    };
  }

  const originalId = resolveOnlineApiId(song);
  const canonicalId = `online_${song.source}_${originalId}`;
  return {
    ...rest,
    id: canonicalId,
    originalId,
    url: null,
  };
}

export function normalizePersistedSongs(songs: Song[]): Song[] {
  return songs.map(normalizePersistedSong);
}

export function normalizePersistedHistory(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.map(entry => ({
    ...entry,
    song: normalizePersistedSong(entry.song),
  }));
}

/** 持久化前剥离在线流 URL 与歌词文本，避免占用大量存储空间与复用失效链接 */
export function stripEphemeralStreamUrl(song: Song): Song {
  const { lyric, ...rest } = song;
  if (song.isLocal) {
    return { ...rest, url: song.localPath || song.url || null };
  }
  return { ...rest, url: null };
}

export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'unknown';
}

export function joinPath(dir: string, fileName: string): string {
  const separator = dir.includes('/') ? '/' : '\\';
  return `${dir.replace(/[\\/]$/, '')}${separator}${fileName}`;
}

export function withoutExtension(filePath: string): string {
  const slashIdx = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
  const dotIdx = filePath.lastIndexOf('.');
  return dotIdx > slashIdx ? filePath.slice(0, dotIdx) : filePath;
}

export function parseSongName(fileName: string): { artist: string; name: string } {
  const extIdx = fileName.lastIndexOf('.');
  const nameWithoutExt = extIdx > 0 ? fileName.substring(0, extIdx) : fileName;
  const dashMatch = nameWithoutExt.match(/^(.*?)\s*-\s*(.*?)$/);

  if (dashMatch?.[1] && dashMatch?.[2]) {
    return {
      artist: dashMatch[1].trim() || '未知歌手',
      name: dashMatch[2].trim() || nameWithoutExt,
    };
  }

  return {
    artist: '未知歌手',
    name: nameWithoutExt.trim() || fileName,
  };
}

/** 检查目录是否存在且可读 */
export async function directoryExists(path: string): Promise<boolean> {
  try {
    if (!path || !(await exists(path))) return false;
    await readDir(path);
    return true;
  } catch {
    return false;
  }
}

/** 支持的音频扩展名 */
export const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a'];

export function isAudioFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return AUDIO_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}
