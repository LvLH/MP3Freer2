/**
 * 桌面歌词外观设置（悬浮窗本地持久化）
 */

export type DesktopLyricAccent = 'purple' | 'gold' | 'mint' | 'rose' | 'white';

export interface DesktopLyricSettings {
  /** 当前行字号 px */
  fontSize: number;
  /** 播放中高亮色 */
  accent: DesktopLyricAccent;
  /** 是否显示上一行（三行模式） */
  showPrev: boolean;
}

export const DESKTOP_LYRIC_SETTINGS_KEY = 'mp3freer_desktop_lyric';

export const ACCENT_OPTIONS: Array<{ id: DesktopLyricAccent; name: string; color: string }> = [
  { id: 'purple', name: '紫', color: '#c084fc' },
  { id: 'gold', name: '金', color: '#fbbf24' },
  { id: 'mint', name: '青', color: '#34d399' },
  { id: 'rose', name: '粉', color: '#fb7185' },
  { id: 'white', name: '白', color: '#ffffff' },
];

export const FONT_SIZE_MIN = 16;
export const FONT_SIZE_MAX = 36;
export const FONT_SIZE_STEP = 2;
export const DEFAULT_DESKTOP_LYRIC_SETTINGS: DesktopLyricSettings = {
  fontSize: 22,
  accent: 'purple',
  showPrev: false,
};

export function loadDesktopLyricSettings(): DesktopLyricSettings {
  try {
    const raw = localStorage.getItem(DESKTOP_LYRIC_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_DESKTOP_LYRIC_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<DesktopLyricSettings>;
    const fontSize = Number(parsed.fontSize);
    const accent = ACCENT_OPTIONS.some(a => a.id === parsed.accent)
      ? (parsed.accent as DesktopLyricAccent)
      : DEFAULT_DESKTOP_LYRIC_SETTINGS.accent;
    return {
      fontSize: Number.isFinite(fontSize)
        ? Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(fontSize)))
        : DEFAULT_DESKTOP_LYRIC_SETTINGS.fontSize,
      accent,
      showPrev: !!parsed.showPrev,
    };
  } catch {
    return { ...DEFAULT_DESKTOP_LYRIC_SETTINGS };
  }
}

export function saveDesktopLyricSettings(settings: DesktopLyricSettings): void {
  localStorage.setItem(DESKTOP_LYRIC_SETTINGS_KEY, JSON.stringify(settings));
}

/** 按字号与是否三行估算悬浮窗高度 */
export function estimateOverlayHeight(settings: DesktopLyricSettings): number {
  const currentBlock = settings.fontSize * 2.6; // 当前行最多约两行换行
  const sideLine = settings.fontSize * 0.72 + 4;
  const sides = settings.showPrev ? sideLine * 2 : sideLine;
  const chrome = 36; // 控制条 + padding
  return Math.round(Math.min(220, Math.max(96, currentBlock + sides + chrome)));
}
