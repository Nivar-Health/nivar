// Demo account constants shared by the OTP route, the seed script and the tests.
// No "server-only" import here: the seed script runs under tsx, outside Next.

/** Phones configured as Supabase test numbers (no SMS is sent, OTP is always DEMO_OTP). */
export const DEMO_PHONES: readonly string[] = ["9876543210", "9123400001", "9123400002"];

export const DEMO_OTP = "123456";

/** Password for every seeded staff account. */
export const DEMO_PASSWORD = "nivar123";

export const isDemoPhone = (phone10: string): boolean => DEMO_PHONES.includes(phone10);
