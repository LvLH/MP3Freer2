import type { Song } from '../types/music';

interface MediaSessionActionHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek?: (time: number) => void;
}

/**
 * 检查当前运行环境是否支持 MediaSession API
 */
export function isMediaSessionSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

/**
 * 更新系统媒体通知元数据（歌名、歌手、专辑、封面）
 * Android / 车机系统接收到此元数据后，会在通知栏、锁屏及车机中控屏展示歌曲信息，
 * 并将当前页面识别为系统级多媒体流，防止进入后台时被 CPU 节流休眠。
 */
export function updateMediaSessionMetadata(song: Song | null): void {
  if (!isMediaSessionSupported()) return;

  if (!song) {
    navigator.mediaSession.metadata = null;
    return;
  }

  const artwork: MediaImage[] = [];
  if (song.pic) {
    artwork.push(
      { src: song.pic, sizes: '96x96', type: 'image/jpeg' },
      { src: song.pic, sizes: '128x128', type: 'image/jpeg' },
      { src: song.pic, sizes: '256x256', type: 'image/jpeg' },
      { src: song.pic, sizes: '512x512', type: 'image/jpeg' }
    );
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name || '未知歌曲',
      artist: song.artist || '未知歌手',
      album: song.album || 'MP3Freer',
      artwork: artwork.length > 0 ? artwork : undefined,
    });
  } catch (err) {
    console.warn('Failed to update MediaSession metadata:', err);
  }
}

/**
 * 更新系统播放状态：'playing' | 'paused' | 'none'
 */
export function updateMediaSessionPlaybackState(isPlaying: boolean): void {
  if (!isMediaSessionSupported()) return;
  try {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  } catch (err) {
    console.warn('Failed to update MediaSession playbackState:', err);
  }
}

/**
 * 更新系统播放进度与时长（供车机/通知栏进度条显示）
 */
export function updateMediaSessionPositionState(state: {
  duration?: number;
  playbackRate?: number;
  position?: number;
}): void {
  if (!isMediaSessionSupported() || !navigator.mediaSession.setPositionState) return;
  try {
    if (state.duration && state.duration > 0 && typeof state.position === 'number') {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0, state.duration),
        playbackRate: state.playbackRate || 1.0,
        position: Math.min(Math.max(0, state.position), state.duration),
      });
    }
  } catch (_e) {
    // 部分车机旧 WebView 可能不支持 setPositionState，静默捕获
  }
}

/**
 * 注册系统级媒体动作响应（车机方向盘实体键、蓝牙耳机按键、系统通知栏）
 */
export function setupMediaSessionHandlers(handlers: MediaSessionActionHandlers): () => void {
  if (!isMediaSessionSupported()) return () => {};

  const actionMap: [MediaSessionAction, MediaSessionActionHandler | null][] = [
    ['play', () => handlers.onPlay()],
    ['pause', () => handlers.onPause()],
    ['previoustrack', () => handlers.onPrev()],
    ['nexttrack', () => handlers.onNext()],
    [
      'seekto',
      (details: MediaSessionActionDetails) => {
        if (details.seekTime !== undefined && handlers.onSeek) {
          handlers.onSeek(details.seekTime);
        }
      },
    ],
  ];

  actionMap.forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (_e) {
      // 部分动作可能在旧版系统不支持，安全降级
    }
  });

  return () => {
    if (!isMediaSessionSupported()) return;
    actionMap.forEach(([action]) => {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch (_e) {}
    });
  };
}
