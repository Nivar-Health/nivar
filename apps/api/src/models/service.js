import mongoose from 'mongoose';
import { withJson } from './json.js';

export const SERVICE_CODES = ['BP', 'ECG', 'SUGAR', 'HR', 'SPO2', 'STETH', 'CONSULT'];

const serviceSchema = new mongoose.Schema(
  {
    code: { type: String, enum: SERVICE_CODES, required: true, unique: true },
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    durationMin: { type: Number, default: 5 },
    requiresDevice: { type: String, enum: ['ecg', 'stethoscope', null], default: null },
    icon: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Service = mongoose.model('Service', withJson(serviceSchema));
