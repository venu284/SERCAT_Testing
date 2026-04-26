import { spawn } from 'node:child_process';

let shuttingDown = false;

const processes = [
  {
    name: 'api',
    command: process.execPath,
    args: ['scripts/local-api-server.js'],
  },
  {
    name: 'vite',
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['vite'],
  },
];

const children = processes.map(({ name, command, args }) => {
  const child = spawn(command, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(`[${name}] ${data}`);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(`[${name}] ${data}`);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const other of children) {
      if (other !== child && !other.killed) other.kill('SIGTERM');
    }
    process.exit(code ?? (signal ? 1 : 0));
  });

  return child;
});

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
