import type { LyricLine } from '../types/music';

/**
 * LRC 歌词解析纯函数集
 * 从 PlayerContext 抽离，无副作用，便于单测
 */

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

/** 把单条 lrc 文本解析为 时间戳->文本 的映射（用于合并翻译） */
export function parseLrcMap(lrcText: string): Map<number, string> {
  const map = new Map<number, string>();
  if (!lrcText) return map;
  const timeReg = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  for (const line of lrcText.split('\n')) {
    const text = line.replace(timeReg, '').trim();
    if (!text) continue;
    let match;
    timeReg.lastIndex = 0;
    while ((match = timeReg.exec(line)) !== null) {
      const min = Number(match[1]);
      const sec = Number(match[2]);
      const ms = match[3] ? Number(match[3]) : 0;
      const msFactor = match[3] && match[3].length === 2 ? 10 : 1;
      map.set(min * 60 + sec + (ms * msFactor) / 1000, text);
    }
  }
  return map;
}

/**
 * 解析主歌词并合并翻译/罗马音。
 * 翻译按时间戳匹配（容差 0.15 秒）。
 * @param offset 整体时间偏移（秒），正值延后，负值提前
 */
export function parseLrcWithExtras(
  original: string,
  translated: string = '',
  romanized: string = '',
  offset: number = 0,
): LyricLine[] {
  const base = parseLrc(original);
  if (base.length === 0) return base;

  const transMap = parseLrcMap(translated);
  const romaMap = parseLrcMap(romanized);

  const findMatch = (map: Map<number, string>, time: number): string | undefined => {
    for (const [t, txt] of map) {
      if (Math.abs(t - time) < 0.15) return txt;
    }
    return undefined;
  };

  return base.map(line => ({
    time: Math.max(0, line.time + offset),
    text: line.text,
    translation: findMatch(transMap, line.time),
    romanization: findMatch(romaMap, line.time),
  }));
}
