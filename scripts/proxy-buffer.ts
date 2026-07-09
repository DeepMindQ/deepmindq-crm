// Simple HTTP/1.1 reverse proxy buffer
// Listens on port 3000, forwards to Next.js on port 3789
// This works around Caddy <-> Bun HTTP/2 compatibility issues

const TARGET = `http://127.0.0.1:${process.env.BACKEND_PORT || 3789}`;

const server = Bun.serve({
  port: parseInt(process.env.PORT || '3000'),
  hostname: '0.0.0.0',
  async fetch(req) {
    const url = new URL(req.url);
    url.protocol = 'http';
    url.hostname = '127.0.0.1';
    url.port = process.env.BACKEND_PORT || '3789';
    
    try {
      const resp = await fetch(url.toString(), {
        method: req.method,
        headers: req.headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      });
      
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy error', message: String(err) }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }
  },
});

console.log(`Proxy buffer listening on port ${server.port} -> ${TARGET}`);