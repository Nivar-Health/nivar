import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { connectDb, disconnectDb } from './db.js';
import { initRealtime, closeRealtime } from './realtime/index.js';
import { config } from './config.js';

export async function startServer({ port = config.port, mongoUrl = config.mongoUrl } = {}) {
  await connectDb(mongoUrl);
  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, resolve);
  });
  return server;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const server = await startServer();
    console.log(`Nivar API listening on http://localhost:${server.address().port}`);
    const shutdown = async (signal) => {
      console.log(`\n${signal} received, shutting down`);
      server.close();
      await closeRealtime();
      await disconnectDb();
      process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    if (err.code === 'EADDRINUSE') console.error(`Port ${config.port} is already in use. Is another API running?`);
    else console.error('Failed to start API:', err.message);
    process.exit(1);
  }
}
