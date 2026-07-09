// Production-grade reverse proxy for DeepMindQ
// Handles Caddy's persistent connections by creating fresh backend connections per request
// Auto-retries if backend is temporarily down (between restarts)

const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '3789');
const FRONTEND_PORT = parseInt(process.env.PORT || '3000');
const BACKEND_HOST = '127.0.0.1';

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 
  'upgrade', 'proxy-connection', 'te', 'trailer'
]);

function filterHeaders(headers: Headers): Headers {
  const h = new Headers();
  for (const [k, v] of headers.entries()) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) {
      h.set(k, v);
    }
  }
  return h;
}

async function proxyRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const backendUrl = `http://${BACKEND_HOST}:${BACKEND_PORT}${url.pathname}${url.search}`;

  const reqHeaders = filterHeaders(req.headers);
  // Never pass accept-encoding to backend (causes bun crashes)
  reqHeaders.delete('accept-encoding');
  // Force Connection: close — bun/Next.js crashes on keep-alive from Caddy
  reqHeaders.set('connection', 'close');

  const resp = await fetch(backendUrl, {
    method: req.method,
    headers: reqHeaders,
    body: req.method !== 'GET' && req.method !== 'HEAD' 
      ? await req.arrayBuffer() 
      : undefined,
  });

  const body = await resp.arrayBuffer();
  const respHeaders = filterHeaders(resp.headers);
  // No content-encoding since we stripped accept-encoding
  respHeaders.delete('content-encoding');

  return new Response(body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: respHeaders,
  });
}

const server = Bun.serve({
  port: FRONTEND_PORT,
  hostname: '0.0.0.0',
  async fetch(req) {
    // Try up to 3 times with 1s delay (backend might be restarting)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await proxyRequest(req);
      } catch (err) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return new Response(
          JSON.stringify({ error: 'Service unavailable', attempt: attempt + 1 }),
          { status: 502, headers: { 'content-type': 'application/json' } }
        );
      }
    }
  },
});

console.log(`DeepMindQ proxy :${FRONTEND_PORT} -> :${BACKEND_PORT}`);