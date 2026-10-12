import mongoose from 'mongoose';
import { config } from './config.js';

mongoose.set('strictQuery', true);

export async function connectDb(url = config.mongoUrl) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(url, { serverSelectionTimeoutMS: 5000 });
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
