/**
 * MP3Tao Cloudflare Worker 永久云同步中继服务
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    // CORS 跨域响应头
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Device-Id, X-Sync-Code",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 处理 /api/sync 或 /sync/:code
    if (url.pathname === "/api/sync" || url.pathname.startsWith("/sync/")) {
      let syncCode = url.searchParams.get("syncCode") || url.searchParams.get("code");
      if (!syncCode && url.pathname.startsWith("/sync/")) {
        syncCode = decodeURIComponent(url.pathname.replace("/sync/", "")).trim();
      }

      // 1. GET 请求：拉取收藏数据
      if (request.method === "GET") {
        if (!syncCode) {
          return new Response(JSON.stringify({ success: false, message: "缺少同步暗号 (syncCode)" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json;charset=utf-8" },
          });
        }

        if (!env.MP3TAO_KV) {
          return new Response(JSON.stringify({ success: false, message: "KV 数据库未绑定，请在 Worker 设置中绑定名为 MP3TAO_KV 的 KV 命名空间" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json;charset=utf-8" },
          });
        }

        const cleanKey = "sync:" + syncCode.toUpperCase().trim();
        const dataStr = await env.MP3TAO_KV.get(cleanKey);

        if (!dataStr) {
          return new Response(JSON.stringify({ success: false, message: "暗号【" + syncCode + "】云端暂无数据" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json;charset=utf-8" },
          });
        }

        // 浏览器直接打开时，美化排版呈现
        if (request.headers.get("accept")?.includes("text/html")) {
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>MP3Tao - ' + syncCode + '</title><style>body{background:#121214;color:#e2e8f0;font-family:monospace;padding:20px;line-height:1.5;}pre{background:#1e1e24;padding:16px;border-radius:8px;border:1px solid #333;overflow:auto;}</style></head><body><h2>MP3Tao 收藏云端备份（暗号：' + syncCode + '）</h2><pre>' + dataStr + '</pre></body></html>',
            { headers: { ...corsHeaders, "Content-Type": "text/html;charset=utf-8" } }
          );
        }

        return new Response(dataStr, {
          headers: { ...corsHeaders, "Content-Type": "application/json;charset=utf-8" },
        });
      }

      // 2. POST 请求：永久存储数据到 KV
      if (request.method === "POST") {
        if (!env.MP3TAO_KV) {
          return new Response(JSON.stringify({ success: false, message: "KV 数据库未绑定，请在 Worker 设置中绑定名为 MP3TAO_KV 的 KV 命名空间" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json;charset=utf-8" },
          });
        }

        try {
          const body = await request.json();
          const targetCode = body.syncCode || syncCode;
          if (!targetCode) {
            return new Response(JSON.stringify({ success: false, message: "缺少同步暗号 (syncCode)" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json;charset=utf-8" },
            });
          }

          const cleanKey = "sync:" + targetCode.toUpperCase().trim();
          const payload = {
            success: true,
            version: body.version || "1.0",
            app: "MP3Tao",
            syncCode: targetCode,
            deviceId: body.deviceId || "unknown",
            updatedAt: Date.now(),
            favorites: body.favorites || { songs: [], playlists: [], artists: [] },
          };

          // 写入 KV 数据库（无 TTL，永久持久化保存）
          await env.MP3TAO_KV.put(cleanKey, JSON.stringify(payload));

          return new Response(JSON.stringify({ success: true, updatedAt: payload.updatedAt }), {
            headers: { ...corsHeaders, "Content-Type": "application/json;charset=utf-8" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, message: err.message || "解析数据失败" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json;charset=utf-8" },
          });
        }
      }
    }

    // 根路径：显示服务状态与 KV 绑定检测
    const kvStatus = env.MP3TAO_KV ? "已绑定 ✅" : "未绑定 ❌ 请在 Worker 设置中绑定 KV 命名空间";
    return new Response(
      JSON.stringify({
        status: "ok",
        service: "MP3Tao Cloudflare Sync Relay",
        version: "1.1",
        kvBinding: kvStatus,
        tips: "多端输入相同暗号，实现秒级永久云同步",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json;charset=utf-8" } }
    );
  },
};
