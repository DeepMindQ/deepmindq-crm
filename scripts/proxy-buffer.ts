// Simple HTTP reverse proxy with full response buffering
// Buffers entire response before forwarding - avoids streaming crashes

const BACKEND = `http://127.0.0.1:${process.env.BACKEND_PORT || 3789}`;

const server = Bun.serve({
  port: parseInt(process.env.PORT || '3000'),
  hostname: '0.0.0.0',
  async fetch(req) {
    const url = new URL(req.url);
    const backendUrl = `${BACKEND}${url.pathname}${url.search}`;

    try {
      // Build clean headers (filter out hop-by-hop)
      const headers = new Headers();
      for (const [key, value] of req.headers.entries()) {
        if (!['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(key)) {
          headers.set(key, value);
        }
      }

      const resp = await fetch(backendUrl, {
        method: req.method,
        headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.arrayBuffer() : undefined,
      });

      // Buffer the full response
      const body = await resp.arrayBuffer();

      // Build response headers (filter hop-by-hop)
      const respHeaders = new Headers();
      for (const [key, value] of resp.headers.entries()) {
        if (!['connection', 'keep-alive', 'transfer-encoding', 'content-encoding'].includes(key)) {
          respHeaders.set(key, value);
        }
      }

      return new Response(body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      console.error('Proxy error:', err);
      return new Response(JSON.stringify({ error: 'Proxy error', message: String(err) }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }
  },
});

console.log(`Proxy listening on port ${server.port} -> ${BACKEND}`);