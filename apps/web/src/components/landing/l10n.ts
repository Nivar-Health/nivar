/**
 * Multilingual strings for the landing page.
 * Source: Nivar l10n set, checked by two independent AI-assisted language reviews (October 2026).
 * Have a native speaker of each language read them on the live page before launch.
 * Every string is NFC. Devanagari nukta is base letter + U+093C (never U+0958-U+095F).
 * Do not edit, retype or machine-translate these strings without a new review.
 */
export type LangCode = "en-IN" | "kn" | "hi" | "mr";
export type IndicLang = Exclude<LangCode, "en-IN">;
export type Phrase = { lang: LangCode; text: string };

const nfc = (s: string) => s.normalize("NFC");

/** Language names in their own script, for chips and selects. Rotation order: en, kn, hi, mr. */
export const LANGUAGES = [
  { lang: "en-IN", endonym: "English", english: "English" },
  { lang: "kn", endonym: nfc("ಕನ್ನಡ"), english: "Kannada" },
  { lang: "hi", endonym: nfc("हिंदी"), english: "Hindi" },
  { lang: "mr", endonym: nfc("मराठी"), english: "Marathi" },
] as const satisfies readonly { lang: LangCode; endonym: string; english: string }[];

/**
 * Hero rotator: Nivar's promise to patients and their families, the same meaning in all four.
 * kn "your care, like family's" (ಮನೆಯವರು, the people of the house); hi "care like your own people's"
 * (अपनों, warmer than परिवार); mr "care like family's" (घरचे; no तुमची, which can read as "worry about you").
 * Only the English line carries a full stop.
 */
export const LIKE_FAMILY: readonly Phrase[] = [
  { lang: "en-IN", text: "Cared for like family." },
  { lang: "kn", text: nfc("ಮನೆಯವರಂತೆ ನಿಮ್ಮ ಆರೈಕೆ") },
  { lang: "hi", text: nfc("अपनों जैसी देखभाल") },
  { lang: "mr", text: nfc("घरच्यांसारखी काळजी") },
];

/** Static sign-off on the final CTA. */
export const STAY_HEALTHY: readonly Phrase[] = [
  { lang: "en-IN", text: "Stay healthy" },
  { lang: "kn", text: nfc("ಆರೋಗ್ಯವಾಗಿರಿ") },
  { lang: "hi", text: nfc("स्वस्थ रहिए") },
  { lang: "mr", text: nfc("निरोगी राहा") },
];

/** Static eyebrow of the Everyday care section: each language's own "health is wealth" saying. */
export const PROVERBS: readonly (Phrase & { lang: IndicLang; gloss: string })[] = [
  { lang: "kn", text: nfc("ಆರೋಗ್ಯವೇ ಭಾಗ್ಯ"), gloss: "Health itself is fortune." },
  { lang: "hi", text: nfc("पहला सुख निरोगी काया"), gloss: "The first happiness is a healthy body." },
  { lang: "mr", text: nfc("आरोग्य हीच खरी संपत्ती"), gloss: "Health is the true wealth." },
];
