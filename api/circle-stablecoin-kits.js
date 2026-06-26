const CIRCLE_ORIGIN = 'https://api.circle.com';

export default async function handler(req, res) {
  try {
    const rawPath = String(req.query.path || '');
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    if (!path.startsWith('/v1/stablecoinKits/')) {
      res.status(400).json({ error: 'Unsupported Circle proxy path' });
      return;
    }

    const target = new URL(path, CIRCLE_ORIGIN);
    for (const [key, value] of Object.entries(req.query || {})) {
      if (key === 'path') continue;
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) target.searchParams.append(key, String(item));
    }

    const headers = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;
    if (req.headers['x-appinfo']) headers['X-Appinfo'] = req.headers['x-appinfo'];
    if (req.headers['x-request-origin-app']) headers['X-Request-Origin-App'] = req.headers['x-request-origin-app'];
    if (req.headers['x-request-origin-entity-id']) headers['X-Request-Origin-Entity-Id'] = req.headers['x-request-origin-entity-id'];
    if (req.headers['x-cir-developerentity-environment']) headers['X-Cir-Developerentity-Environment'] = req.headers['x-cir-developerentity-environment'];

    const method = req.method || 'GET';
    const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());
    const body = hasBody ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})) : undefined;
    const upstream = await fetch(target, { method, headers, body });
    const text = await upstream.text();
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('content-type', contentType);
    res.send(text);
  } catch (error) {
    res.status(502).json({ error: error && error.message ? error.message : 'Circle proxy failed' });
  }
}
