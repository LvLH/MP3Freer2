export default async function handler(req, res) {
  // 处理 CORS 预检请求
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-requested-with");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 获取需要代理的目标 URL
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    const { method, body, headers } = req;
    
    // 过滤掉限制性的 headers
    const proxyHeaders = { ...headers };
    delete proxyHeaders.host;
    delete proxyHeaders.connection;
    delete proxyHeaders["accept-encoding"];
    
    // 强制设置网易云所需的 Referer
    if (targetUrl.includes("music.163.com") || targetUrl.includes("126.net")) {
      proxyHeaders["Referer"] = "https://music.163.com";
      proxyHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }

    const options = {
      method,
      headers: proxyHeaders,
    };

    if (method !== "GET" && method !== "HEAD" && body) {
      // Vercel serverless body parsing
      options.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const targetResponse = await fetch(targetUrl, options);
    
    // 转发响应头部
    const responseHeaders = new Headers(targetResponse.headers);
    responseHeaders.forEach((value, key) => {
      // 避免转发 content-encoding 导致解码错误
      if (key.toLowerCase() !== "content-encoding") {
        res.setHeader(key, value);
      }
    });

    const data = await targetResponse.arrayBuffer();
    res.status(targetResponse.status).send(Buffer.from(data));

  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: "Proxy server error", details: error.message });
  }
}
