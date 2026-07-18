import { useSyncExternalStore } from 'react';

/**
 * 播放进度独立 store（currentTime / duration / isPlaying）
 *
 * 这些值在播放期间高频变化（timeupdate 每秒约触发 4 次）。
 * 之前它们放在 PlayerContext 的 value 里，导致每秒触发所有消费 usePlayer()
 * 的组件重渲染（包括歌单列表、搜索结果等长列表）。这里用 useSyncExternalStore
 * 把它们隔离开：只有真正订阅进度/播放状态的组件（PlayerBar、LyricView）才会
 * 在每次变化时重渲染，其余组件不受影响。
 */

export interface PlaybackProgress {
  /** 当前播放位置（秒） */
  currentTime: number;
  /** 总时长（秒） */
  duration: number;
  /** 是否正在播放 */
  isPlaying: boolean;
}

const INITIAL: PlaybackProgress = {
  currentTime: 0,
  duration: 0,
  isPlaying: false,
};

let state: PlaybackProgress = INITIAL;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: Partial<PlaybackProgress>) {
  state = { ...state, ...next };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PlaybackProgress {
  return state;
}

/**
 * 供 PlayerContext 内部调用：批量更新进度（合并一次 emit，避免多次 setter 抖动）
 */
export const playbackActions = {
  setCurrentTime(currentTime: number) {
    if (currentTime === state.currentTime) return;
    setState({ currentTime });
  },
  setDuration(duration: number) {
    if (duration === state.duration) return;
    setState({ duration });
  },
  setIsPlaying(isPlaying: boolean) {
    if (isPlaying === state.isPlaying) return;
    setState({ isPlaying });
  },
  /** 重置回初始（清空播放列表 / 切到无歌曲时） */
  reset() {
    if (state === INITIAL) return;
    state = INITIAL;
    emit();
  },
  /** 直接读取当前快照（非响应式，用于命令式逻辑） */
  snapshot(): PlaybackProgress {
    return state;
  },
};

/**
 * 订阅播放进度/播放状态的 hook。
 * 仅在 currentTime / duration / isPlaying 变化时触发组件重渲染。
 */
export function usePlaybackProgress(): PlaybackProgress {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
