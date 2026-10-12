import mongoose from 'mongoose';
import { withJson } from './json.js';
import { addressSchema } from './address.js';

export const ROLES = ['customer', 'nurse', 'doctor', 'admin'];
export const GENDERS = ['male', 'female', 'other'];

// Fields safe to expose when a user is embedded in another resource (e.g. a booking).
export const PUBLIC_USER_FIELDS =
  'name phone email role avatarUrl specialization qualifications yearsExperience registrationNo gender';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    role: { type: String, enum: ROLES, required: true, index: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, select: false },
    avatarUrl: String,
    gender: { type: String, enum: GENDERS },
    dob: Date,
    addresses: { type: [addressSchema], default: undefined },
    specialization: String,
    qualifications: String,
    yearsExperience: Number,
    registrationNo: String,
    baseLocation: {
      type: new mongoose.Schema({ lat: Number, lng: Number, label: String }, { _id: false }),
      default: undefined,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Unique but sparse: only documents that have the field participate.
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });

export const User = mongoose.model('User', withJson(userSchema));
