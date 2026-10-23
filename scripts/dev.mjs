import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electron from 'electron';
const server = await createServer(); await server.listen();
const env = { ...process.env, PAPERDAY_DEV: '1' }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { env, stdio: 'inherit', windowsHide: true });
const close = async () => { child.kill(); await server.close(); };
child.on('exit', async code => { await server.close(); process.exit(code || 0); });
process.on('SIGINT', close); process.on('SIGTERM', close);
