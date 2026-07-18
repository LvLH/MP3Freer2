import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { exists, readDir, readTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { emit } from '@tauri-apps/api/event';
import md5 from 'js-md5';
import { MusicApiService } from '../services/musicApi';
import { getDefaultSearchSource, getDownloadPath, getPreferredQuality } from '../settings';
import { readAudioMetadata, downloadFile } from '../services/rustBridge';
import { useToast } from './ToastContext';
import { storage, StorageKeys } from '../services/storage';
import { resourceCache } from '../services/cache';
import { playbackActions } from '../services/playbackProgress';
import { usePlaybackProgress } from '../services/playbackProgress';
import { parseLrcWithExtras } from '../utils/lyricParser';
import {
  sanitizeFileName,
  joinPath,
  withoutExtension,
  parseSongName,
  directoryExists,
  isAudioFile,
} from '../utils/songUtils';
import type {
  Song,
  LyricLine,
  FavoritePlaylist,
  FavoriteArtist,
  PlayMode,
  HistoryEntry,
} from '../types/music';
// re-export 类型与解析函数，保持现有 `import { Song } from '../context/PlayerContext'` 兼容
export type { Song, LyricLine, FavoritePlaylist, FavoriteArtist, PlayMode, HistoryEntry };
export { parseLrc, parseLrcWithExtras } from '../utils/lyricParser';

interface PlayerContextType {
  currentSong: Song | null;
  // 注：isPlaying / currentTime / duration 已抽离到独立的 playbackProgress store，
  // 请通过 usePlaybackProgress() 订阅，避免每秒触发全量重渲染。
  isLoading: boolean;
  playlist: Song[];
  playIndex: number;
  playMode: PlayMode;
  volume: number;
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
  /** 当前歌词整体偏移（秒） */
  lyricOffset: number;
  /** 调整歌词偏移，delta 单位秒 */
  adjustLyricOffset: (delta: number) => void;
  /** 重置歌词偏移 */
  resetLyricOffset: () => void;
  /** 是否显示歌词翻译 */
  showTranslation: boolean;
  toggleShowTranslation: () => void;
  /** WebAudio 频谱分析节点 */
  analyser: AnalyserNode | null;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();
  const [playlist, setPlaylist] = useState<Song[]>(() => storage.getJSON<Song[]>(StorageKeys.CURRENT_PLAYLIST, []));
  const [playIndex, setPlayIndex] = useState<number>(() => {
    const saved = storage.getString(StorageKeys.CURRENT_PLAYINDEX);
    return saved ? parseInt(saved, 10) : -1;
  });
  const [localDirectory, setLocalDirectory] = useState<string | null>(() => storage.getString(StorageKeys.LOCAL_DIRECTORY) || null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  // currentTime / duration / isPlaying 已抽离到独立的 playbackProgress store，
  // 避免每秒触发所有消费 usePlayer() 的组件重渲染。
  // isPlayingRef 镜像播放状态，供异步回调（canplay 等）读取最新值，
  // 避免闭包捕获陈旧的 isPlaying（loadSongDetails 的 race 修复）。
  const isPlayingRef = useRef<boolean>(false);
  const [playMode, setPlayMode] = useState<PlayMode>('list-loop');
  const [volume, setVolume] = useState<number>(0.5);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState<number>(-1);
  const [localSongs, setLocalSongs] = useState<Song[]>([]);
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>([]);
  const [favoritePlaylists, setFavoritePlaylists] = useState<FavoritePlaylist[]>(() => storage.getJSON<FavoritePlaylist[]>(StorageKeys.FAVORITE_PLAYLISTS, []));
  const [favoriteArtists, setFavoriteArtists] = useState<FavoriteArtist[]>(() => storage.getJSON<FavoriteArtist[]>(StorageKeys.FAVORITE_ARTISTS, []));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [playHistory, setPlayHistory] = useState<HistoryEntry[]>(() => storage.getJSON<HistoryEntry[]>(StorageKeys.PLAY_HISTORY, []));
  const [lyricOffset, setLyricOffset] = useState<number>(0);
  const [showTranslation, setShowTranslation] = useState<boolean>(() => storage.getString(StorageKeys.SHOW_TRANSLATION) !== 'false');
  // 缓存当前歌曲的结构化歌词数据（原文+翻译+罗马音），供偏移/翻译切换时重建
  const rawLyricDataRef = useRef<{ original: string; translated: string; romanized: string }>({ original: '', translated: '', romanized: '' });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSongRef = useRef<Song | null>(null);
  const playModeRef = useRef<PlayMode>(playMode);
  const playlistRef = useRef<Song[]>(playlist);
  const playSessionIdRef = useRef<number>(0);
  const onCanPlayRef = useRef<any>(null);

  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const initWebAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        const srcNode = ctx.createMediaElementSource(audio);
        sourceNodeRef.current = srcNode;

        const analyserNode = ctx.createAnalyser();
        analyserNode.fftSize = 128; // 使频谱比较平滑
        analyserNode.smoothingTimeConstant = 0.8;

        srcNode.connect(analyserNode);
        analyserNode.connect(ctx.destination);

        setAnalyser(analyserNode);
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(console.warn);
      }
    } catch (err) {
      console.warn("WebAudio 初始化失败", err);
    }
  };

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    storage.setJSON(StorageKeys.CURRENT_PLAYLIST, playlist);
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.volume = volume;

    // 直接用原生 audio 元素播放，不走 WebAudio 图。
    // 之前接 WebAudio（createMediaElementSource）导致一系列 user gesture / suspended 问题，
    // 声音是底线，频谱改为模拟律动（见 SpectrumVisualizer）。

    const onTimeUpdate = () => playbackActions.setCurrentTime(audio.currentTime);
    const onDurationChange = () => {
      if (audio.duration && !Number.isNaN(audio.duration)) {
        playbackActions.setDuration(audio.duration);
      }
    };
    const onEnded = () => handleSongEnded();
    // 让 <audio> 元素本身成为播放状态的真相源：无论谁触发播放（用户手势、自动续播、
    // 程序调用），只要 audio 真的 play/pause 了，就同步 store 与 ref。
    // 之前只靠各调用方手动 setIsPlaying，路径多了容易漏，导致 ref 与实际状态不一致。
    const onPlay = () => {
      isPlayingRef.current = true;
      playbackActions.setIsPlaying(true);
    };
    const onPause = () => {
      // ended 时浏览器会先触发 pause 再触发 ended，这里不阻塞 ended 的自动续播判断
      isPlayingRef.current = false;
      playbackActions.setIsPlaying(false);
    };
    const onError = (e: Event) => {
      console.error('Audio playback error:', e);
      const src = audio.currentSrc || audio.src;
      if (src.startsWith('asset:') || src.includes('asset.localhost')) {
        toast.error(`本地音频加载失败，即将跳过：\n${currentSongRef.current?.localPath || src}`);
      }
      isPlayingRef.current = false;
      playbackActions.setIsPlaying(false);
      setTimeout(() => {
        console.log('Auto-skipping to next song due to error...');
        handleSongEnded();
      }, 2000);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    const savedLocal = storage.getString(StorageKeys.LOCAL_SONGS);
    if (savedLocal) {
      setLocalSongs(storage.getJSON<Song[]>(StorageKeys.LOCAL_SONGS, []));
    }

    const savedFavorites = storage.getString(StorageKeys.FAVORITE_SONGS);
    if (savedFavorites) {
      setFavoriteSongs(storage.getJSON<Song[]>(StorageKeys.FAVORITE_SONGS, []));
    }

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, []);

  // 订阅播放进度 store：把高频更新的 currentTime / isPlaying 拿到本地，
  // 喂给下方"歌词高亮"和"overlay 同步"两个 effect。
  // 这样只有这两个 effect 跟随进度变化，而不会触发整个 Provider value 重建
  // （value 里已不含 currentTime / isPlaying）。
  const { currentTime, isPlaying: isPlayingProgress } = usePlaybackProgress();
  // isPlayingRef 始终镜像最新播放状态，供异步回调读取
  isPlayingRef.current = isPlayingProgress;

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

  // 同步歌词到桌面悬浮窗（lyric-overlay）
  useEffect(() => {
    const prevLine = currentLyricIndex > 0 ? lyrics[currentLyricIndex - 1]?.text || '' : '';
    const currentLine = currentLyricIndex >= 0 ? lyrics[currentLyricIndex]?.text || '' : '';
    const nextLine = currentLyricIndex >= 0 && currentLyricIndex < lyrics.length - 1
      ? lyrics[currentLyricIndex + 1]?.text || ''
      : '';
    const payload = {
      prev: prevLine,
      current: currentLine,
      next: nextLine,
      songName: currentSong?.name || '',
      artist: currentSong?.artist || '',
      isPlaying: isPlayingProgress,
    };
    // emit 失败（浏览器环境/窗口未启动）静默忽略
    emit('overlay-lyric', payload).catch(() => {});
  }, [currentLyricIndex, lyrics, currentSong, isPlayingProgress]);

  useEffect(() => {
    storage.setString(StorageKeys.CURRENT_PLAYINDEX, String(playIndex));
    if (playIndex >= 0 && playIndex < playlist.length) {
      const song = playlist[playIndex];
      setCurrentSong(song);
      void loadSongDetails(song);
    } else {
      setCurrentSong(null);
      setLyrics([]);
      rawLyricDataRef.current = { original: '', translated: '', romanized: '' };
      playbackActions.reset();
    }
  }, [playIndex, playIndex >= 0 && playIndex < playlist.length ? playlist[playIndex].id : undefined]);

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
          toast.error(`本地歌曲文件不存在，无法播放：\n${localPath || song.name}`);
          playUrl = null;
        }
      } else {
        const apiId = song.originalId || song.id;
        const quality = getPreferredQuality();
        if (!playUrl) {
          // 优先查缓存
          playUrl = resourceCache.getUrl(song.source, apiId, quality);
          if (!playUrl) {
            // 按用户偏好音质请求（lossless/hires 时尝试网易官方 enhance 接口）
            playUrl = await MusicApiService.getSongUrl(apiId, song.source, quality);
            if (playUrl) resourceCache.setUrl(song.source, apiId, quality, playUrl);
          }
        }
        if (!lyricText && song.lyric_id) {
          const lrcData = await MusicApiService.getSongLyric(song.lyric_id, song.source);
          lyricText = lrcData.original;
          rawLyricDataRef.current = { original: lrcData.original, translated: lrcData.translated, romanized: lrcData.romanized };
        }
        if (!picUrl && song.pic_id) {
          // 优先查封面缓存
          picUrl = resourceCache.getPic(song.source, song.pic_id);
          if (!picUrl) {
            picUrl = await MusicApiService.getSongPic(song.pic_id, song.source);
            if (picUrl) resourceCache.setPic(song.source, song.pic_id, picUrl);
          }
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
        toast.error(`获取歌曲播放链接失败！即将自动跳过...\n\n歌曲：${song.name}\n该歌曲可能为 VIP 专享或接口无响应，请稍后重试。`);
        isPlayingRef.current = false;
        playbackActions.setIsPlaying(false);
        setTimeout(() => {
          console.log('Auto-skipping to next song due to empty playUrl...');
          handleSongEnded();
        }, 2000);
        return;
      }

      const onCanPlay = () => {
        if (onCanPlayRef.current) {
          audio.removeEventListener('canplay', onCanPlayRef.current.canplay);
          audio.removeEventListener('error', onCanPlayRef.current.error);
          onCanPlayRef.current = null;
        }
        // 若仅是本地已缓存的纯文本歌词，ref 可能空，补一下
        const raw = rawLyricDataRef.current.original ? rawLyricDataRef.current : { original: lyricText, translated: '', romanized: '' };
        setLyrics(parseLrcWithExtras(raw.original, raw.translated, raw.romanized, lyricOffset));
        // 读 ref 而非闭包里的 isPlaying：canplay 可能在用户已切歌/暂停后很久才触发，
        // 闭包值会陈旧。isPlayingRef 始终镜像最新状态（由上方订阅同步）。
        if (isPlayingRef.current) {
          initWebAudio();
          audio.play().catch(err => {
            console.error('Playback start failed:', err);
            isPlayingRef.current = false;
            playbackActions.setIsPlaying(false);
          });
        }
      };

      const onError = (e: Event) => {
        console.error("Audio playback error:", e, audio.error);
        toast.error(`音频流加载失败(Error Code: ${audio.error?.code})，即将自动跳过下一首。`);
        isPlayingRef.current = false;
        playbackActions.setIsPlaying(false);
        setTimeout(() => {
          console.log('Auto-skipping to next song due to error...');
          handleSongEnded();
        }, 2000);
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
      isPlayingRef.current = false;
      playbackActions.setIsPlaying(false);
      toast.error('无法加载该歌曲的播放资源。\n\n建议：如果频繁发生，请尝试在“设置”中配置代理，或者勾选更换其他第三方接口节点。');
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
        isPlayingRef.current = true;
        playbackActions.setIsPlaying(true);
        return nextIdx;
      });
    }
  };

  // 记录播放历史（去重：同一首歌 5 秒内不重复记录）
  const lastRecordedRef = useRef<string>('');
  const lastRecordedTimeRef = useRef<number>(0);

  // 历史持久化防抖：避免每次播放都把整个 history（最多 1000 条完整 Song）
  // 同步 stringify 写入 localStorage，主线程开销大。改为延迟合并写入。
  const persistHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePersistHistory = (entries: HistoryEntry[]) => {
    if (persistHistoryTimerRef.current) clearTimeout(persistHistoryTimerRef.current);
    persistHistoryTimerRef.current = setTimeout(() => {
      storage.setJSON(StorageKeys.PLAY_HISTORY, entries);
    }, 1500);
  };

  const recordPlay = (song: Song) => {
    const now = Date.now();
    // 同一首歌 5 秒内不重复记录
    if (song.id === lastRecordedRef.current && now - lastRecordedTimeRef.current < 5000) return;
    lastRecordedRef.current = song.id;
    lastRecordedTimeRef.current = now;

    setPlayHistory(prev => {
      // 纯追加：不再去重，为了智能歌单能够正确统计播放次数
      const updated = [{ song, playedAt: now }, ...prev].slice(0, 1000);
      schedulePersistHistory(updated); // 防抖合并写入
      return updated;
    });
  };

  // 本周最爱：最近 7 天播放次数 Top 50
  // 用 useMemo 仅在 playHistory 变化时重算，避免每次渲染都遍历全量历史
  const topPlayed = useMemo(() => {
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
  }, [playHistory]);

  const clearPlayHistory = () => {
    if (persistHistoryTimerRef.current) clearTimeout(persistHistoryTimerRef.current);
    setPlayHistory([]);
    storage.remove(StorageKeys.PLAY_HISTORY);
  };

  // 用当前缓存的原始歌词数据 + 给定偏移重建 lyrics
  const rebuildLyrics = (offset: number) => {
    const raw = rawLyricDataRef.current;
    if (!raw.original) return;
    setLyrics(parseLrcWithExtras(raw.original, raw.translated, raw.romanized, offset));
  };

  const adjustLyricOffset = (delta: number) => {
    setLyricOffset(prev => {
      // 限制在 ±10 秒内，步长 0.5 秒对齐
      const next = Math.round((prev + delta) * 2) / 2;
      const clamped = Math.max(-10, Math.min(10, next));
      rebuildLyrics(clamped);
      return clamped;
    });
  };

  const resetLyricOffset = () => {
    setLyricOffset(0);
    rebuildLyrics(0);
  };

  const toggleShowTranslation = () => {
    setShowTranslation(prev => {
      const next = !prev;
      storage.setString(StorageKeys.SHOW_TRANSLATION, String(next));
      return next;
    });
  };

  const playSong = async (song: Song) => {
    recordPlay(song);
    const idx = playlist.findIndex(s => s.id === song.id);
    if (idx >= 0) {
      if (idx === playIndex && currentSong?.id === song.id) {
        isPlayingRef.current = true;
        playbackActions.setIsPlaying(true);
        initWebAudio();
        audioRef.current?.play().catch(console.error);
      } else {
        setPlayIndex(idx);
        isPlayingRef.current = true;
        playbackActions.setIsPlaying(true);
      }
      return;
    }

    const newPlaylist = [...playlist, song];
    setPlaylist(newPlaylist);
    setPlayIndex(newPlaylist.length - 1);
    isPlayingRef.current = true;
    playbackActions.setIsPlaying(true);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    // 读 ref 而非闭包 isPlaying，保证拿到最新状态
    if (isPlayingRef.current) {
      audio.pause();
      isPlayingRef.current = false;
      playbackActions.setIsPlaying(false);
    } else {
      initWebAudio();
      audio.play()
        .then(() => {
          isPlayingRef.current = true;
          playbackActions.setIsPlaying(true);
        })
        .catch(err => console.error('Toggle play failed:', err));
    }
  };

  const nextSong = () => {
    if (playlist.length === 0) return;
    const nextIdx = playMode === 'random'
      ? Math.floor(Math.random() * playlist.length)
      : (playIndex + 1) % playlist.length;

    if (nextIdx === playIndex) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        initWebAudio();
        audioRef.current.play().catch(console.error);
      }
    } else {
      setPlayIndex(nextIdx);
    }
    isPlayingRef.current = true;
    playbackActions.setIsPlaying(true);
  };

  const prevSong = () => {
    if (playlist.length === 0) return;
    const prevIdx = playMode === 'random'
      ? Math.floor(Math.random() * playlist.length)
      : (playIndex - 1 + playlist.length) % playlist.length;

    if (prevIdx === playIndex) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        initWebAudio();
        audioRef.current.play().catch(console.error);
      }
    } else {
      setPlayIndex(prevIdx);
    }
    isPlayingRef.current = true;
    playbackActions.setIsPlaying(true);
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      playbackActions.setCurrentTime(time);
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
        isPlayingRef.current = true;
        playbackActions.setIsPlaying(true);
      }
      return;
    }

    const newPlaylist = [...playlist, song];
    setPlaylist(newPlaylist);
    if (playImmediately) {
      setPlayIndex(newPlaylist.length - 1);
      isPlayingRef.current = true;
      playbackActions.setIsPlaying(true);
    }
  };

  const removeFromPlaylist = (songId: string) => {
    const idx = playlist.findIndex(s => s.id === songId);
    if (idx < 0) return;

    const newPlaylist = playlist.filter(s => s.id !== songId);
    setPlaylist(newPlaylist);

    if (newPlaylist.length === 0) {
      setPlayIndex(-1);
      isPlayingRef.current = false;
      playbackActions.setIsPlaying(false);
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
    isPlayingRef.current = false;
    playbackActions.setIsPlaying(false);
    if (audioRef.current) audioRef.current.src = '';
    playbackActions.reset();
  };

  const playAll = (songs: Song[]) => {
    if (songs.length === 0) return;
    setPlaylist(songs);

    if (playIndex === 0 && playlist[0]?.id === songs[0]?.id) {
      isPlayingRef.current = true;
      playbackActions.setIsPlaying(true);
      initWebAudio();
      audioRef.current?.play().catch(console.error);
    } else {
      setPlayIndex(0);
      isPlayingRef.current = true;
      playbackActions.setIsPlaying(true);
    }
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
      storage.setJSON(StorageKeys.FAVORITE_PLAYLISTS, newFavs);
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
      storage.setJSON(StorageKeys.FAVORITE_ARTISTS, newFavs);
      return newFavs;
    });
  };

  const persistFavorites = (updater: (songs: Song[]) => Song[]) => {
    setFavoriteSongs(prev => {
      const updated = updater(prev);
      storage.setJSON(StorageKeys.FAVORITE_SONGS, updated);
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
        toast.error(`收藏下载目录不存在，请先到设置中重新选择：\n${downloadPath}`);
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
            // 优先查缓存
            songToSave.url = resourceCache.getUrl(song.source, apiId, getPreferredQuality());
            if (!songToSave.url) {
              songToSave.url = await MusicApiService.getSongUrl(apiId, song.source);
              if (songToSave.url) resourceCache.setUrl(song.source, apiId, getPreferredQuality(), songToSave.url);
            }
          }

          if (!songToSave.url) {
            toast.warning(`未能获取歌曲下载地址，已收藏但无法下载：${song.artist} - ${song.name}`);
            return;
          }

          // 走 Rust 后端下载：不阻塞 UI 线程，且带进度回调
          await downloadFile(songToSave.url, filePath, (percent) => {
            console.log(`[下载] ${song.artist} - ${song.name}: ${percent.toFixed(0)}%`);
          });
        }

        let lyricText = songToSave.lyric || '';
        if (!lyricText && songToSave.lyric_id) {
          lyricText = (await MusicApiService.getSongLyric(songToSave.lyric_id, songToSave.source)).original;
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
        toast.error(`已收藏，但下载歌曲失败：${song.artist} - ${song.name}`);
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

      const lyricText = (await MusicApiService.getSongLyric(matched.lyric_id, matched.source)).original;
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
    if (!isAudioFile(name)) return null;

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
        storage.setString(StorageKeys.LOCAL_DIRECTORY, selected);
      }

      setLocalSongs(prev => {
        const existingPaths = new Set(prev.map(s => s.localPath));
        const filteredNew = audioFiles.filter(s => !existingPaths.has(s.localPath));
        const merged = [...prev, ...filteredNew];
        storage.setJSON(StorageKeys.LOCAL_SONGS, merged);
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
      storage.setJSON(StorageKeys.LOCAL_SONGS, audioFiles);
    } catch (err) {
      console.error('Failed to refresh local folder:', err);
    }
  };

  return (
    <PlayerContext.Provider value={{
      currentSong,
      isLoading,
      playlist,
      playIndex,
      playMode,
      volume,
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
      lyricOffset,
      adjustLyricOffset,
      resetLyricOffset,
      showTranslation,
      toggleShowTranslation,
      analyser,
    }}>
      <audio ref={audioRef} crossOrigin="anonymous" style={{ display: 'none' }} />
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
