/**
 * Health facts and tips for the landing page (spec 2026-10-17, section 8).
 * Every item passed two independent fact-checks (October 2026). Where the checkers differed, the
 * more conservative wording is used. Scope stays in the visible text. Re-check yearly.
 * Do not place these next to Nivar outcome claims or booking CTAs.
 */
import { MINUTE_SOURCES, type HealthSource } from "./health-sources";

export { MINUTE_SOURCES };
export type { HealthSource };

export type HealthFact = {
  id: string;
  figure: string;
  /** Small text after the figure, e.g. "lower risk". */
  figureSuffix?: string;
  scope: "India" | "Worldwide" | "US" | "Clinical trials";
  text: string;
  icon: "heart" | "gauge" | "drop" | "trend" | "salt" | "screen";
  sources: HealthSource[];
  /** YYYY-MM the source was last checked. */
  checked: string;
  /** Shown in the Small habits facts row (keep exactly four featured). */
  featured: boolean;
};

export type TipCategory = "Checks" | "Heart" | "Food" | "Movement" | "Sleep" | "Sugar" | "Breath";

export type HealthTip = {
  id: string;
  category: TipCategory;
  title: string;
  text: string;
  sources: HealthSource[];
  checked: string;
};

export type ChecklistItem = { id: string; text: string; source: { label: string; url?: string } };

const S = {
  icmrIndiab: {
    label: "ICMR-INDIAB national survey (adults 20+, 2008–2020), Lancet Diabetes & Endocrinology, 2023",
    short: "ICMR-INDIAB, 2023",
    url: "https://doi.org/10.1016/S2213-8587(23)00119-5",
  },
  whoHypertension: {
    label: "WHO, Hypertension fact sheet, 2025",
    short: "WHO, 2025",
    url: "https://www.who.int/news-room/fact-sheets/detail/hypertension",
  },
  whoHypertensionGlobal: {
    label: "WHO, Hypertension fact sheet, 2025 (global, adults 30–79, 2024 estimate)",
    short: "WHO, 2025",
    url: "https://www.who.int/news-room/fact-sheets/detail/hypertension",
  },
  idfIndia: {
    label: "IDF Diabetes Atlas, 11th edition, 2025 (India, adults 20–79, modelled estimate for 2024)",
    url: "https://diabetesatlas.org/data-by-location/country/india/",
  },
  idpp: {
    label: "Indian Diabetes Prevention Programme (IDPP-1), Diabetologia, 2006",
    url: "https://doi.org/10.1007/s00125-005-0097-z",
  },
  ettehad: {
    label: "Ettehad et al., meta-analysis of 123 trials, The Lancet, 2016",
    short: "The Lancet, 2016",
    url: "https://doi.org/10.1016/S0140-6736(15)01225-8",
  },
  cdcAfib: {
    label: "US CDC, About Atrial Fibrillation, 2024",
    url: "https://www.cdc.gov/heart-disease/about/atrial-fibrillation.html",
  },
  nhsAf: MINUTE_SOURCES.nhsAf,
  saltSurvey: {
    label: "ICMR-NCDIR National NCD Monitoring Survey 2017–18, Scientific Reports, 2023",
    url: "https://doi.org/10.1038/s41598-023-42694-x",
  },
  whoSalt: {
    label: "WHO, Sodium reduction fact sheet, 2026",
    short: "WHO, 2026",
    url: "https://www.who.int/news-room/fact-sheets/detail/sodium-reduction",
  },
  fssaiSalt: {
    label: "FSSAI Eat Right India, Reduce salt",
    short: "FSSAI",
    url: "https://eatrightindia.gov.in/reduce-salt.jsp",
  },
  ncdScreening: {
    label: "Ministry of Health & Family Welfare, NP-NCD screening campaign, February 2025 (via All India Radio)",
    url: "https://www.newsonair.gov.in/centre-launches-special-ncd-screening-campaign-for-100-coverage-of-30-age-group/",
  },
  cdcMeasureBp: MINUTE_SOURCES.cdcMeasureBp,
  ahaCrisis: MINUTE_SOURCES.ahaCrisis,
  aha2025: {
    label: "AHA/ACC High Blood Pressure Guideline, 2025",
    short: "AHA/ACC, 2025",
    url: "https://professional.heart.org/en/science-news/2025-high-blood-pressure-guideline/top-things-to-know",
  },
  whoActivity: {
    label: "WHO Guidelines on Physical Activity and Sedentary Behaviour, 2020",
    short: "WHO, 2020",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/",
  },
  ahaLe8: {
    label: "American Heart Association, Life's Essential 8, Circulation, 2022",
    short: "AHA, 2022",
    url: "https://doi.org/10.1161/CIR.0000000000001078",
  },
  medlineGlucose: {
    label: "MedlinePlus (US National Library of Medicine), Blood Glucose Test, 2024",
    short: "MedlinePlus, 2024",
    url: "https://medlineplus.gov/lab-tests/blood-glucose-test/",
  },
  nhsHypo: {
    label: "NHS, Low blood sugar (hypoglycaemia), 2023",
    short: "NHS, 2023",
    url: "https://www.nhs.uk/conditions/low-blood-sugar-hypoglycaemia/",
  },
  medlinePulse: MINUTE_SOURCES.medlinePulse,
  fdaOximeter: {
    label: "US FDA, Pulse Oximeter Basics, 2025",
    short: "US FDA, 2025",
    url: "https://www.fda.gov/consumers/consumer-updates/pulse-oximeter-basics",
  },
  nhsBreathing: MINUTE_SOURCES.nhsBreathing,
  whoQuit: {
    label: "WHO, Health benefits of smoking cessation, 2020",
    short: "WHO, 2020",
    url: "https://www.who.int/news-room/questions-and-answers/item/tobacco-health-benefits-of-smoking-cessation",
  },
  ntqls: { label: "National Tobacco Quit Line Services (MoHFW)", short: "MoHFW quit line", url: "https://ntqls.in/" },
} satisfies Record<string, HealthSource>;

export const HEALTH_FACTS: HealthFact[] = [
  {
    id: "bp-prevalence-india",
    figure: "1 in 3",
    scope: "India",
    text: "About 1 in 3 adults in India has high blood pressure, and most have no symptoms. A quick, painless reading is how you find out.",
    icon: "heart",
    sources: [S.icmrIndiab, S.whoHypertension],
    checked: "2026-10",
    featured: true,
  },
  {
    id: "bp-unaware",
    figure: "44%",
    scope: "Worldwide",
    text: "Worldwide, about 44% of adults with high blood pressure don't know they have it. The only way to find out is to have it measured.",
    icon: "gauge",
    sources: [S.whoHypertensionGlobal],
    checked: "2026-10",
    featured: true,
  },
  {
    id: "diabetes-prediabetes-india",
    figure: "1 in 4",
    scope: "India",
    text: "A national survey found that about 1 in 4 adults in India has diabetes or prediabetes. Blood sugar testing, reviewed by a doctor, is how you find out.",
    icon: "drop",
    sources: [S.icmrIndiab],
    checked: "2026-10",
    featured: true,
  },
  {
    id: "bp-lowering-benefit",
    figure: "20%",
    figureSuffix: "lower risk",
    scope: "Clinical trials",
    text: "In clinical trials, each 10 mmHg drop in the top (systolic) blood pressure number lowered the risk of major heart disease and stroke events by about 20%.",
    icon: "trend",
    sources: [S.ettehad],
    checked: "2026-10",
    featured: true,
  },
  {
    id: "diabetes-undiagnosed-india",
    figure: "4 in 10",
    scope: "India",
    text: "An estimated 4 in 10 adults with diabetes in India have not been diagnosed.",
    icon: "drop",
    sources: [S.idfIndia],
    checked: "2026-10",
    featured: false,
  },
  {
    id: "salt-intake-india",
    figure: "8 g",
    scope: "India",
    text: "In a 2017–18 national survey, adults in India ate an estimated 8 g of salt a day; WHO advises under 5 g. Eating less salt helps lower blood pressure.",
    icon: "salt",
    sources: [S.saltSurvey, S.whoSalt],
    checked: "2026-10",
    featured: false,
  },
  {
    id: "prediabetes-lifestyle-india",
    figure: "28.5%",
    figureSuffix: "lower risk (relative)",
    scope: "India",
    text: "In an Indian trial of adults with impaired glucose tolerance (a type of prediabetes), lifestyle advice lowered the risk of developing diabetes by 28.5% over three years, compared with standard advice.",
    icon: "trend",
    sources: [S.idpp],
    checked: "2026-10",
    featured: false,
  },
  {
    id: "afib-silent",
    figure: "1 in 7",
    scope: "US",
    text: "In the US, AFib, an irregular heartbeat that may cause no symptoms, causes about 1 in 7 strokes. It is sometimes first found at a routine check-up.",
    icon: "heart",
    sources: [S.cdcAfib, S.nhsAf],
    checked: "2026-10",
    featured: false,
  },
  {
    id: "screening-30-plus-india",
    figure: "30+",
    scope: "India",
    text: "Under its national programme for non-communicable diseases, India aims to screen every adult aged 30 and above for high blood pressure and diabetes.",
    icon: "screen",
    sources: [S.ncdScreening],
    checked: "2026-10",
    featured: false,
  },
];

export const HEALTH_TIPS: HealthTip[] = [
  {
    id: "tip-measure-bp",
    category: "Checks",
    title: "Measure blood pressure right",
    text: "Empty your bladder first. Sit with your back supported, feet flat and legs uncrossed, arm resting on a table at chest height, cuff on bare skin. Rest 5 minutes and don't talk during the reading. No food, drinks, smoking or exercise for 30 minutes before.",
    sources: [S.cdcMeasureBp],
    checked: "2026-10",
  },
  {
    id: "tip-know-numbers",
    category: "Heart",
    title: "Know your BP numbers",
    text: "For adults, under 120/80 is considered normal. One high reading isn't a diagnosis: take 2 readings 1–2 minutes apart, note them, and share a pattern of high numbers with a doctor. Higher than 180/120 with chest pain, shortness of breath, back pain, numbness, weakness, a change in vision or difficulty speaking? Call 112 (or 108 for an ambulance) now.",
    sources: [S.aha2025, S.cdcMeasureBp, S.whoHypertension, S.ahaCrisis],
    checked: "2026-10",
  },
  {
    id: "tip-salt",
    category: "Food",
    title: "Keep salt under 5 g a day",
    text: "That's just under a teaspoon, all food included. Go easy on pickles, papads, namkeen and chutneys, and skip extra salt on curd, salad or cut fruit.",
    sources: [S.whoSalt, S.fssaiSalt],
    checked: "2026-10",
  },
  {
    id: "tip-move-150",
    category: "Movement",
    title: "Move 150 minutes a week",
    text: "Aim for at least 150 minutes of moderate activity, like brisk walking, each week. Sitting less helps too, and any movement is better than none. Living with a health condition? Start small, and ask your doctor what suits you.",
    sources: [S.whoActivity],
    checked: "2026-10",
  },
  {
    id: "tip-balance-65",
    category: "Movement",
    title: "Over 65? Add balance work",
    text: "On 3 or more days a week, add activities that build balance and strength. They help you stay steady on your feet and lower the risk of falls. If you live with a health condition or disability, ask a doctor or physiotherapist what's safe for you.",
    sources: [S.whoActivity],
    checked: "2026-10",
  },
  {
    id: "tip-sleep",
    category: "Sleep",
    title: "Give sleep 7 to 9 hours",
    text: "Most adults should aim for 7–9 hours of sleep a night on average. The American Heart Association counts sleep among its eight essentials for a healthy heart.",
    sources: [S.ahaLe8],
    checked: "2026-10",
  },
  {
    id: "tip-fasting-test",
    category: "Sugar",
    title: "Fasting sugar test? Plan ahead",
    text: "Don't eat or drink anything except water for at least 8 hours before. On diabetes medicines or insulin? Ask your doctor how to take them that morning. If you feel shaky, sweaty, dizzy or confused while fasting, have something sugary straight away; the test can wait.",
    sources: [S.medlineGlucose, S.nhsHypo],
    checked: "2026-10",
  },
  {
    id: "tip-pulse",
    category: "Heart",
    title: "Check your pulse",
    text: "Sit and rest for at least 10 minutes, then place two fingers on the inside of your wrist, below the base of your thumb. Count the beats for a full minute (or 30 seconds and double it). A resting adult pulse is usually 60–100. If the rhythm feels irregular, tell a doctor. If it's fast or irregular with chest pain, breathlessness, dizziness or fainting, call 112 (or 108 for an ambulance).",
    sources: [S.medlinePulse, S.nhsAf],
    checked: "2026-10",
  },
  {
    id: "tip-spo2",
    category: "Checks",
    title: "Reading a fingertip oximeter",
    text: "For most healthy people, blood oxygen (SpO₂) reads 95–100%. Keep your hand warm, relaxed and still, below heart level, with no nail polish, and wait for a steady number. Readings can be less accurate on darker skin. If you feel unwell, don't rely on the number alone.",
    sources: [S.fdaOximeter],
    checked: "2026-10",
  },
  {
    id: "tip-breathing",
    category: "Breath",
    title: "Take a 5-minute breathing break",
    text: "Breathe in gently through your nose and out through your mouth, counting 1 to 5 each way, without forcing it. Keep going for at least 5 minutes; it can help you feel calmer.",
    sources: [S.nhsBreathing],
    checked: "2026-10",
  },
  {
    id: "tip-quit-smoking",
    category: "Heart",
    title: "Quitting smoking pays off fast",
    text: "Within 20 minutes of your last cigarette, heart rate and blood pressure drop. After a year, your risk of coronary heart disease is about half a smoker's. Free quitline: 1800-11-2356 (8 am to 8 pm, closed Mondays).",
    sources: [S.whoQuit, S.ntqls],
    checked: "2026-10",
  },
];

/** "Before your nurse arrives". Visit-prep content; Nivar's clinical team signs it off. */
export const VISIT_CHECKLIST: ChecklistItem[] = [
  {
    id: "rest",
    text: "Rest for at least 5 minutes before your blood pressure is taken. Nothing to eat or drink, no smoking and no exercise for 30 minutes before.",
    source: { label: "US CDC", url: S.cdcMeasureBp.url },
  },
  {
    id: "fasting",
    text: "Booked a fasting sugar test? Only water for at least 8 hours before.",
    source: { label: "MedlinePlus", url: S.medlineGlucose.url },
  },
  {
    id: "clothes",
    text: "Wear a loose sleeve and a two-piece outfit, so the nurse can reach your arm for the cuff and your chest for the ECG.",
    source: { label: "Nivar visit tip" },
  },
  {
    id: "papers",
    text: "Keep your medicines and recent reports handy for the doctor's video call.",
    source: { label: "Nivar visit tip" },
  },
];

/**
 * Always visible beside the visit checklist, never inside it (a closed checklist must not hide it). The
 * fasting item in the checklist leaves this sentence out, so an open checklist doesn't repeat it.
 */
export const FASTING_WARNING = {
  text: "Booked a fasting sugar test and on diabetes medicines or insulin? Ask your doctor how to take them that morning.",
  source: { label: "MedlinePlus", url: S.medlineGlucose.url },
} as const;

/**
 * "All sources" on the page: the featured facts, the tips, the checklist and Take a minute, each URL
 * once (the first label seen wins), in that order.
 */
export const ALL_SOURCES: readonly HealthSource[] = (() => {
  const seen = new Map<string, HealthSource>();
  const add = (s: HealthSource) => {
    if (!seen.has(s.url)) seen.set(s.url, s);
  };
  HEALTH_FACTS.filter((f) => f.featured).forEach((f) => f.sources.forEach(add));
  HEALTH_TIPS.forEach((t) => t.sources.forEach(add));
  VISIT_CHECKLIST.forEach(({ source: { label, url } }) => url && add({ label, url }));
  Object.values(MINUTE_SOURCES).forEach(add);
  return [...seen.values()];
})();

export const HEALTH_DISCLAIMER =
  "General health information for adults, not medical advice or a diagnosis. Targets differ in pregnancy and for children. Talk to a qualified doctor about your own readings, medicines and treatment, and don't stop or change a medicine without them.";

export const SOURCES_NOTE =
  "Figures come from published studies and public health bodies, not from Nivar patients or Nivar results.";

/**
 * Emergency safety net, shown once in the Small habits section: plain text, then "Call 112" and
 * "Call 108 (ambulance)" as two tel: buttons (never inline links, which are too small to hit).
 */
export const EMERGENCY_NOTE = {
  lead: "Chest pain, sudden breathlessness, weakness or numbness on one side, trouble speaking, or a fast or irregular heartbeat with dizziness or fainting?",
  tail: "Nivar is not an emergency service.",
} as const;

/** Shown under the sources. Set clinicalReviewer once a Nivar doctor has reviewed this file. */
export const CONTENT_REVIEW = { checked: "October 2026", clinicalReviewer: null as string | null };

/** Index of the tip of the day, by calendar day in India (IST, UTC+5:30). */
export function tipOfTheDayIndex(now: Date, count = HEALTH_TIPS.length): number {
  const istDay = Math.floor((now.getTime() + 5.5 * 60 * 60 * 1000) / 86_400_000);
  return ((istDay % count) + count) % count;
}
