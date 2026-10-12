// Shared toJSON/toObject behaviour: expose `id`, hide `_id`, `__v`, `passwordHash`.
function transform(_doc, ret) {
  if (ret._id !== undefined) {
    ret.id = String(ret._id);
    delete ret._id;
  }
  delete ret.__v;
  delete ret.passwordHash;
  return ret;
}

export function withJson(schema) {
  const opts = { versionKey: false, virtuals: false, transform };
  schema.set('toJSON', opts);
  schema.set('toObject', opts);
  return schema;
}
