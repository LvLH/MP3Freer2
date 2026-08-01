/**
 * 在线资源 TTL 缓存层
 * 缓存 getSongUrl 结果（网易 URL 一般 1-2 小时有效）和封面 URL
 * 第三方接口失败时回退到缓存（即使已过期），提升切歌顺滑度
 */

interface CacheEntry<T> {
  value: T;
  expireAt: number; // 时间戳 ms，0 表示永久
}

/** 默认 URL 缓存 TTL：30 分钟（网易 URL 实际有效期更长，保守取 30min） */
const DEFAULT_URL_TTL_MS = 30 * 60 * 1000;

const urlCache = new Map<string, CacheEntry<string>>();
const picCache = new Map<string, CacheEntry<string>>();

function makeUrlKey(source: string, songId: string, quality: string): string {
  return `${source}:${songId}:${quality}`;
}

function makePicKey(source: string, picId: string): string {
  return `${source}:${picId}`;
}

export const resourceCache = {
  /** 读取缓存的播放 URL。allowExpired=true 时即使过期也返回（用于回退） */
  getUrl(source: string, songId: string, quality: string, allowExpired = false): string | null {
    const entry = urlCache.get(makeUrlKey(source, songId, quality));
    if (!entry) return null;
    // expireAt=0 表示永久（与 getPic 一致）；>0 时才做 TTL 判断
    if (!allowExpired && entry.expireAt > 0 && Date.now() > entry.expireAt) return null;
    return entry.value;
  },

  /** 写入播放 URL 缓存 */
  setUrl(source: string, songId: string, quality: string, url: string, ttlMs: number = DEFAULT_URL_TTL_MS): void {
    if (!url) return;
    urlCache.set(makeUrlKey(source, songId, quality), {
      value: url,
      expireAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
    });
  },

  /** 失效单首歌曲 URL 缓存（音质切换时调用） */
  invalidateUrl(source: string, songId: string): void {
    const prefix = `${source}:${songId}:`;
    for (const key of urlCache.keys()) {
      if (key.startsWith(prefix)) urlCache.delete(key);
    }
  },

  /** 读取缓存的封面 URL */
  getPic(source: string, picId: string, allowExpired = false): string | null {
    const entry = picCache.get(makePicKey(source, picId));
    if (!entry) return null;
    if (!allowExpired && entry.expireAt > 0 && Date.now() > entry.expireAt) return null;
    return entry.value;
  },

  /** 写入封面缓存。ttlMs=0 表示永久 */
  setPic(source: string, picId: string, url: string, ttlMs: number = 0): void {
    if (!url) return;
    picCache.set(makePicKey(source, picId), {
      value: url,
      expireAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
    });
  },

  /** 清空所有缓存 */
  clear(): void {
    urlCache.clear();
    picCache.clear();
  },
};
