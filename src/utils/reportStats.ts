import type { HistoryEntry, Song } from '../types/music';

/** 一首歌的默认时长（秒），用于 duration 缺失时估算 */
const DEFAULT_SONG_DURATION_SECS = 210;

export interface ReportStats {
  /** 累计听歌次数 */
  totalPlays: number;
  /** 累计听歌时长（秒） */
  totalDurationSecs: number;
  /** 听过的不同歌曲数 */
  uniqueSongs: number;
  /** 听过的不同歌手数 */
  uniqueArtists: number;
  /** 最爱歌曲 Top10 */
  topSongs: Array<{ song: Song; count: number }>;
  /** 最爱歌手 Top10 */
  topArtists: Array<{ artist: string; count: number }>;
  /** 听歌时段分布（4 段，索引 0=凌晨 0-6, 1=上午 6-12, 2=下午 12-18, 3=晚上 18-24） */
  hourBuckets: [number, number, number, number];
  /** 最近 30 天每日听歌次数，索引 0=29 天前，29=今天 */
  last30Days: number[];
  /** 本周听歌次数 */
  thisWeekPlays: number;
  /** 上周听歌次数 */
  lastWeekPlays: number;
  /** 本周最爱 Top3 */
  thisWeekTop3: Array<{ song: Song; count: number }>;
}

/** 把时间戳映射到 4 段时段索引 */
function bucketOfHour(ts: number): number {
  const h = new Date(ts).getHours();
  if (h < 6) return 0;
  if (h < 12) return 1;
  if (h < 18) return 2;
  return 3;
}

/** 把时间戳映射到 "YYYY-MM-DD" 本地日期键 */
function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 基于 playHistory 计算年报统计数据
 * 纯函数，便于单测
 */
export function computeReportStats(history: HistoryEntry[]): ReportStats {
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  const weekMs = 7 * dayMs;

  const songCount = new Map<string, { song: Song; count: number }>();
  const artistCount = new Map<string, number>();
  const hourBuckets: [number, number, number, number] = [0, 0, 0, 0];
  // 最近 30 天的日期键 → 次数
  const dayMap = new Map<string, number>();
  const thisWeekStart = now - weekMs;
  const lastWeekStart = now - 2 * weekMs;
  let thisWeekPlays = 0;
  let lastWeekPlays = 0;
  const thisWeekSongCount = new Map<string, { song: Song; count: number }>();

  let totalDurationSecs = 0;

  for (const entry of history) {
    const { song, playedAt } = entry;
    const dur = song.duration > 0 ? song.duration : DEFAULT_SONG_DURATION_SECS;
    totalDurationSecs += dur;

    // 歌曲计数
    const existing = songCount.get(song.id);
    if (existing) {
      existing.count++;
    } else {
      songCount.set(song.id, { song, count: 1 });
    }

    // 歌手计数（多歌手拆分）
    const artists = song.artist.split(/[/,&，、]/).map(s => s.trim()).filter(Boolean);
    if (artists.length === 0) artists.push('未知歌手');
    for (const a of artists) {
      artistCount.set(a, (artistCount.get(a) || 0) + 1);
    }

    // 时段
    hourBuckets[bucketOfHour(playedAt)]++;

    // 30 天热力
    const diffDays = Math.floor((now - playedAt) / dayMs);
    if (diffDays >= 0 && diffDays < 30) {
      const key = dayKey(playedAt);
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    }

    // 本周 / 上周
    if (playedAt >= thisWeekStart) {
      thisWeekPlays++;
      const tw = thisWeekSongCount.get(song.id);
      if (tw) tw.count++;
      else thisWeekSongCount.set(song.id, { song, count: 1 });
    } else if (playedAt >= lastWeekStart) {
      lastWeekPlays++;
    }
  }

  // 转换 top 列表
  const topSongs = Array.from(songCount.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const topArtists = Array.from(artistCount.entries())
    .map(([artist, count]) => ({ artist, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const thisWeekTop3 = Array.from(thisWeekSongCount.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // 计算 30 天数组（索引 0=29 天前，29=今天）
  const last30Days: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const ts = now - i * dayMs;
    last30Days.push(dayMap.get(dayKey(ts)) || 0);
  }

  return {
    totalPlays: history.length,
    totalDurationSecs,
    uniqueSongs: songCount.size,
    uniqueArtists: artistCount.size,
    topSongs,
    topArtists,
    hourBuckets,
    last30Days,
    thisWeekPlays,
    lastWeekPlays,
    thisWeekTop3,
  };
}

/** 格式化时长（秒 → "X小时Y分钟"） */
export function formatDuration(secs: number): string {
  if (secs < 60) return `${Math.round(secs)}秒`;
  const minutes = Math.floor(secs / 60);
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return `${hours}小时${remMin}分钟`;
  const days = Math.floor(hours / 24);
  const remHr = hours % 24;
  return `${days}天${remHr}小时`;
}
