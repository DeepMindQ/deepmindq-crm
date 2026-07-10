const http = require('http');
const UPSTREAM = 9090;
const server = http.createServer((req, res) => {
  const opts = {
    hostname: 'localhost', port: UPSTREAM, path: req.url, method: req.method,
    headers: { ...req.headers, host: 'localhost:' + UPSTREAM },
  };
  const proxy = http.request(opts, (pRes) => { res.writeHead(pRes.statusCode, pRes.headers); pRes.pipe(res); });
  proxy.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(proxy);
});
server.listen(3789, () => console.log('[bridge] :3789 -> :9090'));
