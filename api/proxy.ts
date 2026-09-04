export default async function handler(req: any, res: any) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing target url parameter' });
  }

  // 限制仅允许转发合法音乐和 API 请求
  try {
    const targetUrl = new URL(url);
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return res.status(400).json({ error: 'Invalid protocol' });
    }

    // 设置全局跨域响应头
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, User-Agent, Referer'
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    };

    if (targetUrl.hostname.includes('163.com')) {
      headers['Referer'] = 'https://music.163.com/';
    } else {
      headers['Referer'] = `${targetUrl.origin}/`;
    }

    const fetchOptions: any = {
      method: req.method || 'GET',
      headers,
    };

    if (req.method === 'POST' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl.toString(), fetchOptions);
    const contentType = response.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', contentType);

    const buffer = await response.arrayBuffer();
    return res.status(response.status).send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message || 'Proxy request failed' });
  }
}
