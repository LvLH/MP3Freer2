import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { exists, readDir, readTextFile, writeFile } from '@tauri-apps/plugin-fs';
import md5 from 'js-md5';
import { MusicApiService } from '../services/musicApi';
import { getDefaultSearchSource, getDownloadPath, getPreferredQuality } from '../settings';
import { readAudioMetadata, downloadFile } from '../services/rustBridge';

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

interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  isLoading: boolean;
  playlist: Song[];
  playIndex: number;
  playMode: PlayMode;
  volume: number;
  currentTime: number;
  duration: number;
  lyrics: LyricLine[];
  currentLyricIndex: number;
  localSongs: Song[];
  favoriteSongs: Song[];
  favoritePlaylists: FavoritePlaylist[];
  favoriteArtists: FavoriteArtist[];
  isFavorite: (songId: string) => boolean;
  isFavoritePlaylist: (id: string) => boolean;
  toggleFavoritePlaylist: (playlistInfo: FavoritePlaylist) => void;
  isFavoriteArtist: (id: string) => boolean;
  toggleFavoriteArtist: (artistInfo: FavoriteArtist) => void;
  playSong: (song: Song) => Promise<void>;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seekTo: (time: number) => void;
  setVolumeLevel: (vol: number) => void;
  changePlayMode: () => void;
  addToPlaylist: (song: Song, playImmediately?: boolean) => void;
  removeFromPlaylist: (songId: string) => void;
  clearPlaylist: () => void;
  toggleFavorite: (song: Song) => Promise<void>;
  importLocalDirectory: () => Promise<void>;
  loadLocalSongLyric: (song: Song) => Promise<string>;
  playAll: (songs: Song[]) => void;
  addAllToPlaylist: (songs: Song[]) => void;
  localDirectory: string | null;
  refreshLocalDirectory: () => Promise<void>;
  /** 最近播放记录（最新在前，最多 200 条） */
  playHistory: HistoryEntry[];
  /** 最近 7 天播放次数最多的歌曲（最多 50 首） */
  topPlayed: HistoryEntry[];
  /** 清空播放历史 */
  clearPlayHistory: () => void;
}

export interface HistoryEntry {
  song: Song;
  playedAt: number; // 时间戳 ms
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const LOCAL_SONGS_KEY = 'mp3freer_local_songs';
const FAVORITE_SONGS_KEY = 'mp3freer_favorite_songs';
const PLAY_HISTORY_KEY = 'mp3freer_play_history';

export function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return [];

  const result: LyricLine[] = [];
  const timeReg = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of lrcText.split('\n')) {
    const text = line.replace(timeReg, '').trim();
    if (!text && line.includes(']')) continue;

    let match;
    timeReg.lastIndex = 0;
    while ((match = timeReg.exec(line)) !== null) {
      const min = Number(match[1]);
      const sec = Number(match[2]);
      const ms = match[3] ? Number(match[3]) : 0;
      const msFactor = match[3] && match[3].length === 2 ? 10 : 1;
      result.push({ time: min * 60 + sec + (ms * msFactor) / 1000, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'unknown';
}

function joinPath(dir: string, fileName: string): string {
  const separator = dir.includes('/') ? '/' : '\\';
  return `${dir.replace(/[\\/]$/, '')}${separator}${fileName}`;
}

function withoutExtension(filePath: string): string {
  const slashIdx = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
  const dotIdx = filePath.lastIndexOf('.');
  return dotIdx > slashIdx ? filePath.slice(0, dotIdx) : filePath;
}

function parseSongName(fileName: string) {
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

async function directoryExists(path: string): Promise<boolean> {
  try {
    if (!path || !(await exists(path))) return false;
    await readDir(path);
    return true;
  } catch {
    return false;
  }
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [playlist, setPlaylist] = useState<Song[]>(() => {
    try {
      const saved = localStorage.getItem('mp3freer_current_playlist');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [playIndex, setPlayIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('mp3freer_current_playindex');
      if (saved) return parseInt(saved, 10);
    } catch {}
    return -1;
  });
  const [localDirectory, setLocalDirectory] = useState<string | null>(() => {
    return localStorage.getItem('local_directory_key') || null;
  });
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playMode, setPlayMode] = useState<PlayMode>('list-loop');
  const [volume, setVolume] = useState<number>(0.5);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState<number>(-1);
  const [localSongs, setLocalSongs] = useState<Song[]>([]);
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>([]);
  const [favoritePlaylists, setFavoritePlaylists] = useState<FavoritePlaylist[]>(() => {
    try {
      const saved = localStorage.getItem('mp3freer_favorite_playlists');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [favoriteArtists, setFavoriteArtists] = useState<FavoriteArtist[]>(() => {
    try {
      const saved = localStorage.getItem('mp3freer_favorite_artists');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [playHistory, setPlayHistory] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('mp3freer_play_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSongRef = useRef<Song | null>(null);
  const playModeRef = useRef<PlayMode>(playMode);
  const playlistRef = useRef<Song[]>(playlist);
  const playSessionIdRef = useRef<number>(0);
  const onCanPlayRef = useRef<any>(null);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    localStorage.setItem('mp3freer_current_playlist', JSON.stringify(playlist));
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => {
      if (audio.duration && !Number.isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => handleSongEnded();
    const onError = (e: Event) => {
      console.error('Audio playback error:', e);
      const src = audio.currentSrc || audio.src;
      if (src.startsWith('asset:') || src.includes('asset.localhost')) {
        alert(`本地音频加载失败，请确认文件格式受系统支持，或文件仍在原目录：\n${currentSongRef.current?.localPath || src}`);
      }
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    const savedLocal = localStorage.getItem(LOCAL_SONGS_KEY);
    if (savedLocal) {
      try {
        setLocalSongs(JSON.parse(savedLocal));
      } catch (err) {
        console.error('Failed to parse saved local songs:', err);
      }
    }

    const savedFavorites = localStorage.getItem(FAVORITE_SONGS_KEY);
    if (savedFavorites) {
      try {
        setFavoriteSongs(JSON.parse(savedFavorites));
      } catch (err) {
        console.error('Failed to parse saved favorite songs:', err);
      }
    }

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, []);

  useEffect(() => {
    if (lyrics.length === 0) {
      setCurrentLyricIndex(-1);
      return;
    }

    let activeIndex = -1;
    for (let i = 0; i < lyrics.length; i += 1) {
      if (currentTime >= lyrics[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }
    setCurrentLyricIndex(activeIndex);
  }, [currentTime, lyrics]);

  useEffect(() => {
    localStorage.setItem('mp3freer_current_playindex', String(playIndex));
    if (playIndex >= 0 && playIndex < playlist.length) {
      const song = playlist[playIndex];
      setCurrentSong(song);
      void loadSongDetails(song);
    } else {
      setCurrentSong(null);
      setLyrics([]);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [playIndex]);

  const loadSongDetails = async (song: Song) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (onCanPlayRef.current) {
      audio.removeEventListener('canplay', onCanPlayRef.current.canplay);
      audio.removeEventListener('error', onCanPlayRef.current.error);
      onCanPlayRef.current = null;
    }
    audio.pause();

    playSessionIdRef.current += 1;
    const currentSession = playSessionIdRef.current;

    try {
      setIsLoading(!song.isLocal);
      let playUrl = song.url;
      let lyricText = song.lyric || '';
      let picUrl = song.pic;

      if (song.isLocal) {
        const localPath = song.localPath || song.url || '';
        if (localPath && await exists(localPath)) {
          playUrl = convertFileSrc(localPath);
          const localData = await loadLocalSongData({ ...song, localPath });
          lyricText = localData.lyricText;
          if (!picUrl) picUrl = localData.picUrl;
        } else {
          alert(`本地歌曲文件不存在，无法播放：\n${localPath || song.name}`);
          playUrl = null;
        }
      } else {
        const apiId = song.originalId || song.id;
        if (!playUrl) {
          // 按用户偏好音质请求（lossless/hires 时尝试网易官方 enhance 接口）
          playUrl = await MusicApiService.getSongUrl(apiId, song.source, getPreferredQuality());
        }
        if (!lyricText && song.lyric_id) {
          lyricText = await MusicApiService.getSongLyric(song.lyric_id, song.source);
        }
        if (!picUrl && song.pic_id) {
          picUrl = await MusicApiService.getSongPic(song.pic_id, song.source);
        }
      }

      if (currentSession !== playSessionIdRef.current) {
        return; // 用户已切换到其他歌曲，丢弃本次结果
      }

      const updatedSong = { ...song, url: playUrl, lyric: lyricText, pic: picUrl };
      setPlaylist(prev => {
        const copy = [...prev];
        if (playIndex >= 0 && playIndex < copy.length) copy[playIndex] = updatedSong;
        return copy;
      });

      if (!playUrl) {
        alert(`获取歌曲播放链接失败！\n\n歌曲：${song.name}\n该歌曲可能为 VIP 专享或接口无响应，请稍后重试。`);
        setIsPlaying(false);
        return;
      }

      const onCanPlay = () => {
        if (onCanPlayRef.current) {
          audio.removeEventListener('canplay', onCanPlayRef.current.canplay);
          audio.removeEventListener('error', onCanPlayRef.current.error);
          onCanPlayRef.current = null;
        }
        setLyrics(parseLrc(lyricText));
        if (isPlaying) {
          audio.play().catch(err => {
            console.error('Playback start failed:', err);
            setIsPlaying(false);
          });
        }
      };

      const onError = (e: Event) => {
        console.error("Audio playback error:", e, audio.error);
        alert(`音频流加载失败 (Error Code: ${audio.error?.code})\n\n这通常是因为网络代理规则阻断了音频流媒体，或者平台限制了该来源的直接播放。`);
        setIsPlaying(false);
      };

      if (onCanPlayRef.current) {
        audio.removeEventListener('canplay', onCanPlayRef.current.canplay);
        audio.removeEventListener('error', onCanPlayRef.current.error);
      }
      
      onCanPlayRef.current = { canplay: onCanPlay, error: onError };
      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('error', onError);
      audio.src = playUrl;
      audio.load();
    } catch (err) {
      console.error('Error loading song details:', err);
      setIsPlaying(false);
      alert('无法加载该歌曲的播放资源。\n\n建议：如果频繁发生，请尝试在“设置”中配置代理，或者勾选更换其他第三方接口节点。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSongEnded = () => {
    if (playModeRef.current === 'single-loop') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      }
    } else {
      setPlayIndex(prevIdx => {
        const pl = playlistRef.current;
        if (pl.length === 0) return prevIdx;
        const nextIdx = playModeRef.current === 'random'
          ? Math.floor(Math.random() * pl.length)
          : (prevIdx + 1) % pl.length;
        setIsPlaying(true);
        return nextIdx;
      });
    }
  };

  // 记录播放历史（去重：同一首歌 5 秒内不重复记录）
  const lastRecordedRef = useRef<string>('');
  const lastRecordedTimeRef = useRef<number>(0);

  const recordPlay = (song: Song) => {
    const now = Date.now();
    // 同一首歌 5 秒内不重复记录
    if (song.id === lastRecordedRef.current && now - lastRecordedTimeRef.current < 5000) return;
    lastRecordedRef.current = song.id;
    lastRecordedTimeRef.current = now;

    setPlayHistory(prev => {
      // 去重：移除旧的同 ID 记录，保留最新
      const filtered = prev.filter(e => e.song.id !== song.id);
      const updated = [{ song, playedAt: now }, ...filtered].slice(0, 200);
      localStorage.setItem(PLAY_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // 本周最爱：最近 7 天播放次数 Top 50
  const topPlayed = (() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const recent = playHistory.filter(e => e.playedAt >= weekAgo);
    const countMap = new Map<string, { entry: HistoryEntry; count: number }>();
    for (const entry of recent) {
      const existing = countMap.get(entry.song.id);
      if (existing) {
        existing.count++;
      } else {
        countMap.set(entry.song.id, { entry, count: 1 });
      }
    }
    return Array.from(countMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
      .map(v => v.entry);
  })();

  const clearPlayHistory = () => {
    setPlayHistory([]);
    localStorage.removeItem(PLAY_HISTORY_KEY);
  };

  const playSong = async (song: Song) => {
    recordPlay(song);
    const idx = playlist.findIndex(s => s.id === song.id);
    if (idx >= 0) {
      if (idx === playIndex && currentSong?.id === song.id) {
        setIsPlaying(true);
        setTimeout(() => audioRef.current?.play().catch(console.error), 50);
      } else {
        setPlayIndex(idx);
        setIsPlaying(true);
      }
      return;
    }

    const newPlaylist = [...playlist, song];
    setPlaylist(newPlaylist);
    setPlayIndex(newPlaylist.length - 1);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Toggle play failed:', err));
    }
  };

  const nextSong = () => {
    if (playlist.length === 0) return;
    const nextIdx = playMode === 'random'
      ? Math.floor(Math.random() * playlist.length)
      : (playIndex + 1) % playlist.length;
    setPlayIndex(nextIdx);
    setIsPlaying(true);
  };

  const prevSong = () => {
    if (playlist.length === 0) return;
    const prevIdx = playMode === 'random'
      ? Math.floor(Math.random() * playlist.length)
      : (playIndex - 1 + playlist.length) % playlist.length;
    setPlayIndex(prevIdx);
    setIsPlaying(true);
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolumeLevel = (vol: number) => {
    const safeVol = Math.max(0, Math.min(1, vol));
    setVolume(safeVol);
    if (audioRef.current) audioRef.current.volume = safeVol;
  };

  const changePlayMode = () => {
    setPlayMode(prev => {
      if (prev === 'list-loop') return 'single-loop';
      if (prev === 'single-loop') return 'random';
      return 'list-loop';
    });
  };

  const addToPlaylist = (song: Song, playImmediately = false) => {
    const idx = playlist.findIndex(s => s.id === song.id);
    if (idx >= 0) {
      if (playImmediately) {
        setPlayIndex(idx);
        setIsPlaying(true);
      }
      return;
    }

    const newPlaylist = [...playlist, song];
    setPlaylist(newPlaylist);
    if (playImmediately) {
      setPlayIndex(newPlaylist.length - 1);
      setIsPlaying(true);
    }
  };

  const removeFromPlaylist = (songId: string) => {
    const idx = playlist.findIndex(s => s.id === songId);
    if (idx < 0) return;

    const newPlaylist = playlist.filter(s => s.id !== songId);
    setPlaylist(newPlaylist);

    if (newPlaylist.length === 0) {
      setPlayIndex(-1);
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.src = '';
    } else if (idx === playIndex) {
      setPlayIndex(idx >= newPlaylist.length ? 0 : idx);
    } else if (idx < playIndex) {
      setPlayIndex(playIndex - 1);
    }
  };

  const clearPlaylist = () => {
    setPlaylist([]);
    setPlayIndex(-1);
    setIsPlaying(false);
    if (audioRef.current) audioRef.current.src = '';
  };

  const playAll = (songs: Song[]) => {
    if (songs.length === 0) return;
    setPlaylist(songs);
    setPlayIndex(0);
    setIsPlaying(true);
  };

  const addAllToPlaylist = (songs: Song[]) => {
    if (songs.length === 0) return;
    setPlaylist(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const newSongs = songs.filter(s => !existingIds.has(s.id));
      return [...prev, ...newSongs];
    });
  };

  const isFavorite = (songId: string) => favoriteSongs.some(s => s.id === songId);

  const isFavoritePlaylist = (id: string) => favoritePlaylists.some(p => p.id === id);

  const toggleFavoritePlaylist = (playlistInfo: FavoritePlaylist) => {
    setFavoritePlaylists(prev => {
      const isFav = prev.some(p => p.id === playlistInfo.id);
      const newFavs = isFav ? prev.filter(p => p.id !== playlistInfo.id) : [...prev, playlistInfo];
      localStorage.setItem('mp3freer_favorite_playlists', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const isFavoriteArtist = (id: string) => {
    return favoriteArtists.some(a => a.id === id);
  };

  const toggleFavoriteArtist = (artistInfo: FavoriteArtist) => {
    setFavoriteArtists(prev => {
      const isFav = prev.some(a => a.id === artistInfo.id);
      const newFavs = isFav ? prev.filter(a => a.id !== artistInfo.id) : [...prev, artistInfo];
      localStorage.setItem('mp3freer_favorite_artists', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const persistFavorites = (updater: (songs: Song[]) => Song[]) => {
    setFavoriteSongs(prev => {
      const updated = updater(prev);
      localStorage.setItem(FAVORITE_SONGS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const upsertFavorite = (song: Song) => {
    persistFavorites(prev => {
      const idx = prev.findIndex(item => item.id === song.id);
      if (idx < 0) return [...prev, song];

      const updated = [...prev];
      updated[idx] = song;
      return updated;
    });
  };

  const toggleFavorite = async (song: Song) => {
    const existsInFavorites = favoriteSongs.some(s => s.id === song.id);
    if (existsInFavorites) {
      persistFavorites(prev => prev.filter(s => s.id !== song.id));
      return;
    }

    let songToSave: Song = { ...song, url: song.url || song.localPath || null };
    upsertFavorite(songToSave);

    if (!song.isLocal) {
      const downloadPath = getDownloadPath();
      if (!(await directoryExists(downloadPath))) {
        alert(`收藏下载目录不存在，请先到设置中重新选择：\n${downloadPath}`);
        return;
      }

      try {
        const fileName = sanitizeFileName(`${songToSave.artist} - ${songToSave.name}.mp3`);
        const filePath = joinPath(downloadPath, fileName);
        const lrcFileName = sanitizeFileName(`${songToSave.artist} - ${songToSave.name}.lrc`);
        const lrcPath = joinPath(downloadPath, lrcFileName);

        if (!(await exists(filePath))) {
          if (!songToSave.url) {
            const apiId = song.originalId || song.id;
            songToSave.url = await MusicApiService.getSongUrl(apiId, song.source);
          }

          if (!songToSave.url) {
            alert(`未能获取歌曲下载地址，已收藏但无法下载：${song.artist} - ${song.name}`);
            return;
          }

          // 走 Rust 后端下载：不阻塞 UI 线程，且带进度回调
          await downloadFile(songToSave.url, filePath, (percent) => {
            console.log(`[下载] ${song.artist} - ${song.name}: ${percent.toFixed(0)}%`);
          });
        }

        let lyricText = songToSave.lyric || '';
        if (!lyricText && songToSave.lyric_id) {
          lyricText = await MusicApiService.getSongLyric(songToSave.lyric_id, songToSave.source);
        }
        if (lyricText && !(await exists(lrcPath))) {
          await writeFile(lrcPath, new TextEncoder().encode(lyricText));
        }

        songToSave = {
          ...songToSave,
          id: song.id,
          url: filePath,
          isLocal: true,
          localPath: filePath,
          lyric: lyricText,
        };
        upsertFavorite(songToSave);
      } catch (err) {
        console.error('Failed to download favorite song:', err);
        alert(`已收藏，但下载歌曲失败：${song.artist} - ${song.name}`);
        return;
      }
    }
  };

  const loadLocalSongData = async (song: Song): Promise<{ lyricText: string, picUrl: string | null }> => {
    const localPath = song.localPath || song.url || '';
    if (!song.isLocal || !localPath) return { lyricText: '', picUrl: null };

    const sameNameLrcPath = `${withoutExtension(localPath)}.lrc`;
    let existingLyric = '';
    try {
      const content = await readTextFile(sameNameLrcPath);
      if (content) existingLyric = content;
    } catch {
      // No local lyric yet.
    }

    try {
      const source = getDefaultSearchSource();
      const searchResults = await MusicApiService.searchSongs(`${song.artist} ${song.name}`, source);
      const matched = searchResults.find(s =>
        s.name.toLowerCase().includes(song.name.toLowerCase()) ||
        song.name.toLowerCase().includes(s.name.toLowerCase())
      ) || searchResults[0];

      if (!matched) return { lyricText: existingLyric, picUrl: null };

      let fetchedPic = matched.pic || null;
      if (!fetchedPic && matched.pic_id) {
        fetchedPic = await MusicApiService.getSongPic(matched.pic_id, matched.source) || null;
      }

      if (existingLyric) {
        return { lyricText: existingLyric, picUrl: fetchedPic };
      }

      if (!matched.lyric_id) return { lyricText: '', picUrl: fetchedPic };

      const lyricText = await MusicApiService.getSongLyric(matched.lyric_id, matched.source);
      if (!lyricText) return { lyricText: '', picUrl: fetchedPic };

      await writeFile(sameNameLrcPath, new TextEncoder().encode(lyricText));
      return { lyricText, picUrl: fetchedPic };
    } catch (err) {
      console.warn('Failed to search or save online data for local song:', song.name, err);
      return { lyricText: existingLyric, picUrl: null };
    }
  };

  const loadLocalSongLyric = async (song: Song): Promise<string> => {
    const data = await loadLocalSongData(song);
    return data.lyricText;
  };

  // 公共：从目录条目构建 Song，优先用 Rust 读取真实元数据，失败则 fallback 到文件名解析
  const buildSongFromEntry = async (dir: string, name: string): Promise<Song | null> => {
    const lowerName = name.toLowerCase();
    const isAudio = ['.mp3', '.flac', '.wav', '.ogg', '.m4a'].some(ext => lowerName.endsWith(ext));
    if (!isAudio) return null;

    const localPath = joinPath(dir, name);
    const id = `local_${(md5 as unknown as (value: string) => string)(localPath)}`;

    let songName = '';
    let artist = '';
    let album = '本地导入';
    let duration = 0;

    try {
      const meta = await readAudioMetadata(localPath);
      // 有真实 tag 才覆盖，否则 fallback 到文件名
      songName = meta.title || parseSongName(name).name;
      artist = meta.artist || parseSongName(name).artist;
      if (meta.album) album = meta.album;
      duration = meta.durationSecs || 0;
    } catch {
      const fallback = parseSongName(name);
      songName = fallback.name;
      artist = fallback.artist;
    }

    return {
      id,
      name: songName,
      artist,
      album,
      url: null,
      pic: null,
      duration,
      isLocal: true,
      localPath,
      source: 'local',
    };
  };

  const importLocalDirectory = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: '请选择包含音乐文件的文件夹',
      });

      if (!selected || Array.isArray(selected)) return;

      const entries = await readDir(selected);
      const audioFiles: Song[] = [];

      for (const entry of entries) {
        if (!entry.isFile) continue;
        const song = await buildSongFromEntry(selected, entry.name);
        if (song) audioFiles.push(song);
      }

      if (audioFiles.length > 0 || selected) {
        setLocalDirectory(selected);
        localStorage.setItem('local_directory_key', selected);
      }

      setLocalSongs(prev => {
        const existingPaths = new Set(prev.map(s => s.localPath));
        const filteredNew = audioFiles.filter(s => !existingPaths.has(s.localPath));
        const merged = [...prev, ...filteredNew];
        localStorage.setItem(LOCAL_SONGS_KEY, JSON.stringify(merged));
        return merged;
      });
    } catch (err) {
      console.error('Failed to import local folder:', err);
    }
  };

  const refreshLocalDirectory = async () => {
    if (!localDirectory) return;
    try {
      const entries = await readDir(localDirectory);
      const audioFiles: Song[] = [];

      for (const entry of entries) {
        if (!entry.isFile) continue;
        const song = await buildSongFromEntry(localDirectory, entry.name);
        if (song) audioFiles.push(song);
      }

      setLocalSongs(audioFiles);
      localStorage.setItem(LOCAL_SONGS_KEY, JSON.stringify(audioFiles));
    } catch (err) {
      console.error('Failed to refresh local folder:', err);
    }
  };

  return (
    <PlayerContext.Provider value={{
      currentSong,
      isPlaying,
      isLoading,
      playlist,
      playIndex,
      playMode,
      volume,
      currentTime,
      duration,
      lyrics,
      currentLyricIndex,
      localSongs,
      favoriteSongs,
      isFavorite,
      playSong,
      togglePlay,
      nextSong,
      prevSong,
      seekTo,
      setVolumeLevel,
      changePlayMode,
      addToPlaylist,
      removeFromPlaylist,
      clearPlaylist,
      playAll,
      addAllToPlaylist,
      toggleFavorite,
      importLocalDirectory,
      loadLocalSongLyric,
      localDirectory,
      refreshLocalDirectory,
      favoritePlaylists,
      isFavoritePlaylist,
      toggleFavoritePlaylist,
      favoriteArtists,
      isFavoriteArtist,
      toggleFavoriteArtist,
      playHistory,
      topPlayed,
      clearPlayHistory,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
