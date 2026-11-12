/**
 * Indian mobile numbers as people type and paste them: "+91 98450 12345", "098450-12345",
 * "919845012345". Pure and safe on the client; the server keeps its own check in server/validate.ts.
 */

export type PhoneProblem = "empty" | "short" | "long" | "start";

export type PhoneCheck =
  | { ok: true; phone: string }
  | { ok: false; problem: PhoneProblem; message: string };

/** The longest run of digits a field keeps, so an extra digit is shown and explained, not dropped. */
const KEEP = 12;

/**
 * The national digits of whatever was typed or pasted. A country code or a trunk zero is removed
 * only when it is clearly a prefix, so a number that starts with 91 is never cut short while it is
 * being typed. Digits past ten are kept (up to twelve): the check below says what is wrong.
 */
export function phoneDigits(input: string): string {
  const plus = /^\s*\+/.test(input);
  // No mobile number starts with 0, so leading zeros are always a prefix ("0…", "0091…").
  let d = input.replace(/\D/g, "").replace(/^0+/, "");
  if (d.startsWith("91") && (plus || d.length === 12)) d = d.slice(2);
  return d.slice(0, KEEP);
}

/** "98450 12345", grouped as it is typed. */
export function formatPhone(digits: string): string {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

/** Ten digits starting 6 to 9, or the one thing that is wrong, in words that say how to fix it. */
export function checkPhone(digits: string): PhoneCheck {
  if (!digits) return { ok: false, problem: "empty", message: "Enter your mobile number." };
  if (!/^[6-9]/.test(digits)) {
    return {
      ok: false,
      problem: "start",
      message: "Indian mobile numbers start with 6, 7, 8 or 9. Check the first digit.",
    };
  }
  if (digits.length < 10) {
    return {
      ok: false,
      problem: "short",
      message: `Enter all 10 digits. This number has ${digits.length}.`,
    };
  }
  if (digits.length > 10) {
    return {
      ok: false,
      problem: "long",
      message: `That is ${digits.length} digits. A mobile number has 10.`,
    };
  }
  return { ok: true, phone: digits };
}
