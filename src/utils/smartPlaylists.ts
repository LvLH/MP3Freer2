import type { HistoryEntry, Song } from '../types/music';

export interface SmartPlaylist {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji 作为图标，避免引入额外依赖
  songs: Song[];
  /** 动态变化的副标题，如"共 N 首 · X 位歌手" */
  subtitle: string;
}

/** 取最近 N 天内播放过的歌曲 */
function recentSongs(history: HistoryEntry[], days: number): HistoryEntry[] {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  return history.filter(e => e.playedAt >= cutoff);
}

/** 按歌曲 id 去重，保留最新 entry（history 最新在前，首次写入后不覆盖） */
function dedupeBySongId(entries: HistoryEntry[]): Map<string, HistoryEntry> {
  const map = new Map<string, HistoryEntry>();
  for (const e of entries) {
    if (!map.has(e.song.id)) map.set(e.song.id, e);
  }
  return map;
}

/** 统计歌手播放次数，返回 Top N 歌手名 */
function topArtists(history: HistoryEntry[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const e of history) {
    const artists = e.song.artist.split(/[/,&，、]/).map(s => s.trim()).filter(Boolean);
    for (const a of artists) {
      counts.set(a, (counts.get(a) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([a]) => a);
}

/** 随机打乱数组（Fisher-Yates） */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 基于用户行为数据生成智能歌单
 * 不依赖音频分析（BPM/能量），纯行为驱动，数据全部来自 playHistory
 */
export function generateSmartPlaylists(
  history: HistoryEntry[],
  localSongs: Song[],
  favoriteSongs: Song[],
): SmartPlaylist[] {
  const playlists: SmartPlaylist[] = [];

  // 1. 本周最爱：最近 7 天播放次数 Top 30
  {
    const recent = recentSongs(history, 7);
    const countMap = new Map<string, { song: Song; count: number }>();
    for (const e of recent) {
      const ex = countMap.get(e.song.id);
      if (ex) ex.count++;
      else countMap.set(e.song.id, { song: e.song, count: 1 });
    }
    const songs = Array.from(countMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 30)
      .map(v => v.song);
    if (songs.length > 0) {
      playlists.push({
        id: 'weekly-top',
        name: '本周最爱',
        description: '最近 7 天循环最多的歌',
        icon: '🔥',
        songs,
        subtitle: `共 ${songs.length} 首`,
      });
    }
  }

  // 2. 深夜电台：晚上 18 点以后播放过的歌曲
  {
    const nightEntries = history.filter(e => {
      const h = new Date(e.playedAt).getHours();
      return h >= 18 || h < 6;
    });
    const map = dedupeBySongId(nightEntries);
    const songs = shuffle(Array.from(map.values()).map(e => e.song)).slice(0, 30);
    if (songs.length >= 3) {
      playlists.push({
        id: 'night-radio',
        name: '深夜电台',
        description: '你在夜晚听过的歌',
        icon: '🌙',
        songs,
        subtitle: `共 ${songs.length} 首 · 适合此刻`,
      });
    }
  }

  // 3. 常听歌手合集：Top 3 歌手的所有歌曲
  {
    const top3 = topArtists(history, 3);
    if (top3.length > 0) {
      // 从 history + favorites + local 里收集这些歌手的歌
      const allSongs = new Map<string, Song>();
      for (const e of history) allSongs.set(e.song.id, e.song);
      for (const s of favoriteSongs) allSongs.set(s.id, s);
      for (const s of localSongs) allSongs.set(s.id, s);

      const songs = Array.from(allSongs.values()).filter(s =>
        top3.some(artist => s.artist.includes(artist))
      ).slice(0, 40);
      if (songs.length >= 3) {
        playlists.push({
          id: 'top-artists',
          name: '常听歌手合集',
          description: top3.join(' / '),
          icon: '🎤',
          songs,
          subtitle: `共 ${songs.length} 首 · ${top3.length} 位歌手`,
        });
      }
    }
  }

  // 4. 久违的歌：30 天前听过但最近 30 天没听过的
  {
    const oldCutoff = Date.now() - 30 * 24 * 3600 * 1000;
    const oldEntries = history.filter(e => e.playedAt < oldCutoff);
    const recentIds = new Set(recentSongs(history, 30).map(e => e.song.id));
    const map = dedupeBySongId(oldEntries);
    const songs = Array.from(map.values())
      .filter(e => !recentIds.has(e.song.id))
      .map(e => e.song)
      .slice(0, 30);
    if (songs.length >= 3) {
      playlists.push({
        id: 'long-time-no-see',
        name: '久违的旋律',
        description: '一个月没听过的老朋友',
        icon: '⏳',
        songs,
        subtitle: `共 ${songs.length} 首 · 重温旧时光`,
      });
    }
  }

  // 5. 收藏精选：从收藏列表随机 30 首
  {
    if (favoriteSongs.length >= 3) {
      const songs = shuffle(favoriteSongs).slice(0, 30);
      playlists.push({
        id: 'fav-shuffle',
        name: '收藏随机听',
        description: '从你的收藏里随机抽',
        icon: '💝',
        songs,
        subtitle: `共 ${songs.length} 首 · 每次都不一样`,
      });
    }
  }

  // 6. 本地宝藏：本地音乐随机 30 首
  {
    if (localSongs.length >= 3) {
      const songs = shuffle(localSongs).slice(0, 30);
      playlists.push({
        id: 'local-shuffle',
        name: '本地宝藏',
        description: '本地音乐随机洗牌',
        icon: '💿',
        songs,
        subtitle: `共 ${songs.length} 首 · 来自你的硬盘`,
      });
    }
  }

  // 7. 晨间能量：上午 6-12 点播放过的快歌（duration 较短的偏向欢快）
  {
    const morningEntries = history.filter(e => {
      const h = new Date(e.playedAt).getHours();
      return h >= 6 && h < 12;
    });
    const map = dedupeBySongId(morningEntries);
    const songs = Array.from(map.values())
      .map(e => e.song)
      .sort((a, b) => (a.duration || 210) - (b.duration || 210)) // 偏短歌
      .slice(0, 25);
    if (songs.length >= 3) {
      playlists.push({
        id: 'morning-energy',
        name: '晨间能量',
        description: '你在上午听过的歌',
        icon: '☀️',
        songs,
        subtitle: `共 ${songs.length} 首 · 开启新的一天`,
      });
    }
  }

  return playlists;
}
