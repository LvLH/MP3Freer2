import type { VercelRequest, VercelResponse } from '@vercel/node';

// 全局内存备份缓存（Serverless 实例生命周期内极速命中）
const memoryStore = new Map<string, { data: any; updatedAt: number }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. 设置跨域 CORS 请求头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-Id, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query.action as string) || (req.body?.action as string) || 'restore';
  const deviceId = (req.query.deviceId as string) || (req.body?.deviceId as string) || (req.headers['x-device-id'] as string);

  if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length < 4) {
    return res.status(400).json({
      success: false,
      code: 400,
      message: 'Invalid or missing deviceId',
    });
  }

  const cleanDeviceId = deviceId.trim();

  // 2. 备份数据 (POST / Backup)
  if (req.method === 'POST' || action === 'backup') {
    try {
      const { favorites, songs, playlists, artists } = req.body || {};
      const payload = favorites || { songs: songs || [], playlists: playlists || [], artists: artists || [] };
      const now = Date.now();

      // 存入内存
      memoryStore.set(cleanDeviceId, { data: payload, updatedAt: now });

      // 若配置了 KV / Redis / Upstash 环境变量，支持持久化存储
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

      if (redisUrl && redisToken) {
        try {
          await fetch(`${redisUrl}/set/mp3tao_fav_${encodeURIComponent(cleanDeviceId)}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${redisToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(JSON.stringify({ data: payload, updatedAt: now })),
          });
        } catch (kvErr) {
          console.warn('[Sync API] KV storage save warning:', kvErr);
        }
      }

      return res.status(200).json({
        success: true,
        code: 200,
        message: 'Backup synced successfully',
        updatedAt: now,
        count: Array.isArray(payload.songs) ? payload.songs.length : 0,
      });
    } catch (err: any) {
      console.error('[Sync API] Backup error:', err);
      return res.status(500).json({ success: false, code: 500, message: err.message || 'Backup failed' });
    }
  }

  // 3. 拉取恢复 (GET / Restore)
  if (req.method === 'GET' || action === 'restore') {
    try {
      // 优先从 KV / Upstash 拉取
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

      if (redisUrl && redisToken) {
        try {
          const kvResp = await fetch(`${redisUrl}/get/mp3tao_fav_${encodeURIComponent(cleanDeviceId)}`, {
            headers: { Authorization: `Bearer ${redisToken}` },
          });
          if (kvResp.ok) {
            const kvData = await kvResp.json();
            if (kvData && kvData.result) {
              const parsed = typeof kvData.result === 'string' ? JSON.parse(kvData.result) : kvData.result;
              return res.status(200).json({
                success: true,
                code: 200,
                from: 'cloud_kv',
                updatedAt: parsed.updatedAt || Date.now(),
                favorites: parsed.data || parsed,
              });
            }
          }
        } catch (kvErr) {
          console.warn('[Sync API] KV fetch failed, fallback to memory:', kvErr);
        }
      }

      // 回退从内存缓存拉取
      const memRecord = memoryStore.get(cleanDeviceId);
      if (memRecord) {
        return res.status(200).json({
          success: true,
          code: 200,
          from: 'memory',
          updatedAt: memRecord.updatedAt,
          favorites: memRecord.data,
        });
      }

      return res.status(200).json({
        success: true,
        code: 200,
        from: 'empty',
        updatedAt: 0,
        favorites: { songs: [], playlists: [], artists: [] },
        message: 'No cloud backup found for this device',
      });
    } catch (err: any) {
      console.error('[Sync API] Restore error:', err);
      return res.status(500).json({ success: false, code: 500, message: err.message || 'Restore failed' });
    }
  }

  return res.status(405).json({ success: false, code: 405, message: 'Method Not Allowed' });
}
