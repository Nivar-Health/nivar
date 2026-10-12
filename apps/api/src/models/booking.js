import mongoose from 'mongoose';
import { withJson } from './json.js';
import { BOOKING_STATUSES } from '../services/booking-status.js';

const { Schema } = mongoose;
const sub = (def) => withJson(new Schema(def, { _id: false }));

export const PAYMENT_METHODS = ['upi', 'card', 'netbanking', 'cash'];
export const RELATIONS = ['self', 'parent', 'spouse', 'child', 'other'];

const addressSnapshot = sub({
  id: String,
  label: String,
  line1: String,
  area: String,
  city: String,
  pincode: String,
  lat: Number,
  lng: Number,
});

const bookingSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patient: sub({
      name: { type: String, required: true },
      age: Number,
      gender: { type: String, enum: ['male', 'female', 'other'] },
      relation: { type: String, enum: RELATIONS, default: 'self' },
    }),
    address: addressSnapshot,
    packageId: { type: Schema.Types.ObjectId, ref: 'Package' },
    serviceCodes: { type: [String], default: [] },
    scheduledDate: { type: String, required: true, index: true },
    slot: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    payment: {
      type: sub({
        status: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
        method: { type: String, enum: PAYMENT_METHODS },
        txnId: String,
        paidAt: Date,
      }),
      default: () => ({ status: 'pending' }),
    },
    status: { type: String, enum: BOOKING_STATUSES, default: 'pending_payment', index: true },
    nurse: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    timeline: {
      type: [sub({ status: String, at: Date, by: String, note: String })],
      default: [],
    },
    nurseLocation: sub({ lat: Number, lng: Number, updatedAt: Date }),
    vitals: sub({
      bpSystolic: Number,
      bpDiastolic: Number,
      sugar: Number,
      sugarType: { type: String, enum: ['fasting', 'random', 'pp'] },
      heartRate: Number,
      spo2: Number,
      temperatureF: Number,
      weightKg: Number,
      recordedAt: Date,
    }),
    ecg: sub({
      samples: [Number],
      sampleRate: Number,
      heartRate: Number,
      rhythm: String,
      interpretation: String,
      capturedAt: Date,
    }),
    stethoscope: sub({
      heartRate: Number,
      findings: String,
      samples: [Number],
      capturedAt: Date,
    }),
    report: sub({
      diagnosis: String,
      summary: String,
      prescription: [
        sub({ medicine: String, dosage: String, frequency: String, duration: String, notes: String }),
      ],
      advice: [String],
      followUp: String,
      publishedAt: Date,
    }),
    rating: sub({ score: { type: Number, min: 1, max: 5 }, comment: String, ratedAt: Date }),
    notes: { type: String, default: '' },
    cancelReason: String,
  },
  { timestamps: true },
);

bookingSchema.index({ scheduledDate: 1, slot: 1 });

export const Booking = mongoose.model('Booking', withJson(bookingSchema));
