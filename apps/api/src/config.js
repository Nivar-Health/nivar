const env = process.env;

export const config = {
  port: Number(env.PORT) || 4100,
  mongoUrl: env.MONGO_URL || 'mongodb://localhost:27018/nivar',
  jwtSecret: env.JWT_SECRET || 'dev-nivar-secret-change-me',
  jwtExpiresIn: '7d',
  webOrigin: env.WEB_ORIGIN || 'http://localhost:3100',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  demoOtp: '123456',
  timeZone: 'Asia/Kolkata',
  slotCapacity: 3,
  locationPersistIntervalMs: 3000,
};
