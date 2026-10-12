import mongoose from 'mongoose';
import { withJson } from './json.js';

export const addressSchema = withJson(
  new mongoose.Schema({
    label: { type: String, default: 'Home', trim: true },
    line1: { type: String, required: true, trim: true },
    area: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: 'Bangalore' },
    pincode: { type: String, trim: true, default: '' },
    lat: Number,
    lng: Number,
  }),
);
