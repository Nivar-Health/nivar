/** Accessible names for the 112 and 108 links inside an emergency sentence, the same wherever it appears. */
export const EMERGENCY_TEL_LABEL = {
  "112": "Call 112, emergency",
  "108": "Call 108, ambulance",
} as const;

export type EmergencyNumber = keyof typeof EMERGENCY_TEL_LABEL;

export const isEmergencyNumber = (s: string): s is EmergencyNumber => Object.hasOwn(EMERGENCY_TEL_LABEL, s);
