/**
 * 音乐领域类型定义
 * 从 PlayerContext 抽离，供 utils/services/hooks 共享，避免循环依赖
 */

export interface Song {
  id: string;
  originalId?: string;
  name: string;
  artist: string;
  album: string;
  url: string | null;
  pic: string | null;
  duration: number;
  isLocal: boolean;
  localPath?: string;
  source: string;
  pic_id?: string;
  lyric_id?: string;
  lyric?: string;
}

export interface LyricLine {
  time: number;
  text: string;
  /** 翻译（如有） */
  translation?: string;
  /** 罗马音/拼音（如有） */
  romanization?: string;
}

export interface FavoritePlaylist {
  id: string;
  name: string;
  coverImgUrl: string;
  trackCount: number;
  source: string;
  creatorName?: string;
}

export interface FavoriteArtist {
  id: string;
  name: string;
  picUrl: string;
  source: string;
}

export type PlayMode = 'list-loop' | 'single-loop' | 'random';

export interface HistoryEntry {
  song: Song;
  playedAt: number; // 时间戳 ms
}
