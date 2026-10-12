import mongoose from 'mongoose';
import { withJson } from './json.js';

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    message: { type: String, default: '' },
  },
  { timestamps: true },
);

export const Lead = mongoose.model('Lead', withJson(leadSchema));
