import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = mongoose.model('Counter', counterSchema);

/** Atomically returns the next value (1, 2, 3, ...) of a named sequence. */
export async function nextSeq(name) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc.seq;
}

/** NV-1001, NV-1002, ... */
export async function nextBookingCode() {
  return `NV-${1000 + (await nextSeq('booking'))}`;
}
