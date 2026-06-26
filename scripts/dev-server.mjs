import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || process.argv[2] || 63901);
const circleOrigin = 'https://api.circle.com';

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function proxyCircle(req, res, parsed) {
  try {
    const pathParam = parsed.searchParams.get('path') || '';
    const upstreamPath = pathParam.startsWith('/') ? pathParam : `/${pathParam}`;
    if (!upstreamPath.startsWith('/v1/stablecoinKits/')) {
      send(res, 400, JSON.stringify({ error: 'Unsupported Circle proxy path' }), { 'content-type': 'application/json' });
      return;
    }
    const target = new URL(upstreamPath, circleOrigin);
    for (const [key, value] of parsed.searchParams.entries()) {
      if (key !== 'path') target.searchParams.append(key, value);
    }
    const headers = { 'content-type': req.headers['content-type'] || 'application/json' };
    for (const h of ['authorization', 'x-appinfo', 'x-request-origin-app', 'x-request-origin-entity-id', 'x-cir-developerentity-environment']) {
      if (req.headers[h]) headers[h] = req.headers[h];
    }
    const method = req.method || 'GET';
    const body = ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : await readBody(req);
    const upstream = await fetch(target, { method, headers, body });
    const data = Buffer.from(await upstream.arrayBuffer());
    send(res, upstream.status, data, { 'content-type': upstream.headers.get('content-type') || 'application/json' });
  } catch (error) {
    send(res, 502, JSON.stringify({ error: error?.message || 'Circle proxy failed' }), { 'content-type': 'application/json' });
  }
}

async function serveStatic(req, res, parsed) {
  let pathname = decodeURIComponent(parsed.pathname);
  const appRoutes = new Set(['/', '/create-invoice', '/pay-invoice', '/seller-console', '/wallet-setup']);
  if (appRoutes.has(pathname)) pathname = '/index.html';
  const full = path.resolve(root, pathname.replace(/^\/+/, ''));
  if (!full.startsWith(root)) {
    send(res, 403, 'Forbidden');
    return;
  }
  try {
    const data = await fs.readFile(full);
    send(res, 200, data, { 'content-type': types.get(path.extname(full).toLowerCase()) || 'application/octet-stream' });
  } catch {
    send(res, 404, 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  if (parsed.pathname === '/api/circle-stablecoin-kits') return proxyCircle(req, res, parsed);
  return serveStatic(req, res, parsed);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Arqis dev server with Circle proxy: http://127.0.0.1:${port}/pay-invoice`);
});
