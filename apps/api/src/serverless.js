// Entrypoint for serverless hosts (Vercel): exports the Express app instead of listening.
//
// The database connection is opened once per instance and every request waits for it.
// Socket.io is not started here: serverless functions have no persistent process, so the
// live features (device streaming, nurse tracking, call signalling) need `src/server.js`
// on a long-running host. REST routes still work and simply skip the realtime broadcasts.
import express from 'express';
import { createApp } from './app.js';
import { connectDb } from './db.js';
import { config } from './config.js';

let ready = null;

const app = express();
app.use(async (_req, res, next) => {
  try {
    ready ??= connectDb(config.mongoUrl);
    await ready;
    next();
  } catch (err) {
    ready = null; // let the next request retry the connection
    res.status(503).json({ error: { message: 'Database is not reachable, please try again', code: 'db_unavailable' } });
    console.error('Database connection failed:', err.message);
  }
});
app.use(createApp());

export default app;
