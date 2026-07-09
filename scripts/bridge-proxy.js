const http = require('http');
const UPSTREAM_PORT = 8080;
const PORT = 3001;
const server = http.createServer((clientReq, clientRes) => {
  const options = {
    hostname: 'localhost',
    port: UPSTREAM_PORT,
    path: clientReq.url,
    method: clientReq.method,
    headers: { ...clientReq.headers, host: 'localhost:' + UPSTREAM_PORT },
  };
  const proxyReq = http.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes);
  });
  proxyReq.on('error', (err) => {
    if (!clientRes.headersSent) clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
    clientRes.end('Bad Gateway');
  });
  clientReq.pipe(proxyReq);
});
server.listen(PORT, () => console.log('[bridge] :'+PORT+' -> :'+UPSTREAM_PORT));