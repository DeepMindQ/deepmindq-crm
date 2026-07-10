const { spawn } = require('child_process');
const fs = require('fs');

// Truncate log on start to prevent unbounded growth
fs.writeFileSync('/tmp/next-server.log', '');

const log = fs.openSync('/tmp/next-server.log', 'a');

function start() {
  const child = spawn('npx', ['next', 'start', '-p', '8080'], {
    cwd: '/home/z/my-project',
    env: { ...process.env, NODE_OPTIONS: '--dns-result-order=ipv4first' },
    stdio: ['ignore', log, log],
    detached: true,
  });
  child.unref();
  console.log('Started server PID:', child.pid);
}

start();