import mongoose from 'mongoose';

/** String id of a ref that may be an ObjectId, a populated doc, a plain object, or null. */
export function idOf(ref) {
  if (!ref) return null;
  if (ref instanceof mongoose.Types.ObjectId) return ref.toString();
  if (typeof ref === 'string') return ref;
  if (ref._id) return ref._id.toString();
  if (ref.id) return String(ref.id);
  return null;
}

export const sameId = (a, b) => {
  const x = idOf(a);
  return x !== null && x === idOf(b);
};

export const isObjectId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v) && /^[a-f0-9]{24}$/i.test(v);
