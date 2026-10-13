// Static seed data: catalog, staff, customers, clinical templates and leads.
import type { Gender, PrescriptionItem, Role, ServiceCode } from "../../src/lib/types";
import { AREAS, type AreaName } from "./areas";

export interface SeedService {
  code: ServiceCode;
  name: string;
  shortName: string;
  price: number;
  durationMin: number;
  requiresDevice: "ecg" | "stethoscope" | null;
  icon: string;
  description: string;
  sortOrder: number;
}

export const SERVICES: SeedService[] = (
  [
    { code: "BP", name: "Blood Pressure", shortName: "BP", price: 199, durationMin: 5, requiresDevice: null, icon: "gauge", description: "Digital blood pressure measurement, two readings averaged, by a certified nurse." },
    { code: "ECG", name: "Smart ECG", shortName: "ECG", price: 799, durationMin: 15, requiresDevice: "ecg", icon: "activity", description: "Resting ECG on a smart device, streamed live to your Nivar doctor for review." },
    { code: "SUGAR", name: "Blood Sugar", shortName: "Sugar", price: 149, durationMin: 5, requiresDevice: null, icon: "droplet", description: "Glucometer test (fasting, random or post-meal) with instant result." },
    { code: "HR", name: "Heart Rate", shortName: "HR", price: 99, durationMin: 2, requiresDevice: null, icon: "heart-pulse", description: "Resting heart rate and rhythm check." },
    { code: "SPO2", name: "Oxygen Saturation", shortName: "SpO2", price: 99, durationMin: 2, requiresDevice: null, icon: "wind", description: "Pulse oximetry to measure blood oxygen levels." },
    { code: "STETH", name: "Smart Stethoscope", shortName: "Steth", price: 399, durationMin: 10, requiresDevice: "stethoscope", icon: "stethoscope", description: "Digital auscultation of heart and lungs, heard live by the doctor." },
    { code: "CONSULT", name: "Doctor Video Consult", shortName: "Consult", price: 499, durationMin: 15, requiresDevice: null, icon: "video", description: "Video consultation with a full-time Nivar doctor, with a written report and prescription." },
  ] as const
).map((s, i) => ({ ...s, sortOrder: i + 1 }));

export interface SeedPackage {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  serviceCodes: ServiceCode[];
  price: number;
  mrp: number;
  popular: boolean;
  sortOrder: number;
}

export const PACKAGES: SeedPackage[] = [
  { slug: "essential-vitals", name: "Essential Vitals", tagline: "The quick monthly check", description: "Blood pressure, blood sugar, heart rate and oxygen saturation, recorded at home by a certified Nivar nurse.", serviceCodes: ["BP", "SUGAR", "HR", "SPO2"], price: 449, mrp: 546, popular: false, sortOrder: 1 },
  { slug: "heart-check", name: "Heart Check", tagline: "ECG and stethoscope, reviewed live by a cardiologist", description: "Smart ECG and digital stethoscope streamed live to a Nivar doctor, plus BP, heart rate and a video consult with a written report.", serviceCodes: ["BP", "ECG", "STETH", "HR", "CONSULT"], price: 1499, mrp: 2195, popular: true, sortOrder: 2 },
  { slug: "complete-home-checkup", name: "Complete Home Check-up", tagline: "Everything, in one visit", description: "All vitals, smart ECG, digital stethoscope and a doctor video consult with a full report and prescription.", serviceCodes: ["BP", "ECG", "SUGAR", "HR", "SPO2", "STETH", "CONSULT"], price: 1899, mrp: 2643, popular: false, sortOrder: 3 },
  { slug: "diabetes-care", name: "Diabetes Care", tagline: "Sugar, BP and a doctor who follows up", description: "Blood sugar, blood pressure and heart rate, with a doctor consult to review medication and diet.", serviceCodes: ["SUGAR", "BP", "HR", "CONSULT"], price: 899, mrp: 946, popular: false, sortOrder: 4 },
];

export interface SeedStaff {
  name: string;
  email: string;
  phone: string;
  gender: Gender;
  specialization?: string;
  qualifications?: string;
  yearsExperience?: number;
  registrationNo?: string;
  baseLocation?: { lat: number; lng: number; label: string };
}

export const ADMIN: SeedStaff & { role: Role } = { name: "Aditi Sharma", email: "admin@nivar.health", role: "admin", phone: "9000000001", gender: "female" };

export const DOCTORS: SeedStaff[] = [
  { name: "Dr. Ananya Rao", email: "ananya@nivar.health", phone: "9000000011", gender: "female", specialization: "Cardiologist", qualifications: "MBBS, MD (Medicine), DM (Cardiology)", yearsExperience: 14, registrationNo: "KMC 58213" },
  { name: "Dr. Vikram Shetty", email: "vikram@nivar.health", phone: "9000000012", gender: "male", specialization: "General Physician", qualifications: "MBBS, MD (General Medicine)", yearsExperience: 9, registrationNo: "KMC 71946" },
];

const hub = (area: AreaName, label: string) => ({ lat: AREAS[area].lat, lng: AREAS[area].lng, label });
export const NURSES: SeedStaff[] = [
  { name: "Priya Nair", email: "priya@nivar.health", phone: "9000000021", gender: "female", qualifications: "B.Sc Nursing, BLS certified", yearsExperience: 7, baseLocation: { lat: 12.9634, lng: 77.6375, label: "Nivar Hub, Indiranagar" } },
  { name: "Kavya Reddy", email: "kavya@nivar.health", phone: "9000000022", gender: "female", qualifications: "GNM, BLS certified", yearsExperience: 5, baseLocation: hub("HSR Layout", "Nivar Hub, HSR Layout") },
  { name: "Meera Joseph", email: "meera@nivar.health", phone: "9000000023", gender: "female", qualifications: "B.Sc Nursing, ACLS certified", yearsExperience: 9, baseLocation: hub("Koramangala", "Nivar Hub, Koramangala") },
];

export interface SeedAddress {
  label: string;
  line1: string;
  area: string;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
}

export interface SeedCustomer {
  name: string;
  phone: string;
  gender: Gender;
  dob: string;
  addresses: SeedAddress[];
}

const addr = (label: string, line1: string, area: AreaName, dLat = 0, dLng = 0): SeedAddress => ({
  label,
  line1,
  area,
  city: "Bangalore",
  pincode: AREAS[area].pincode,
  lat: Math.round((AREAS[area].lat + dLat) * 1e6) / 1e6,
  lng: Math.round((AREAS[area].lng + dLng) * 1e6) / 1e6,
});

export const RAHUL: SeedCustomer = {
  name: "Rahul Mehta",
  phone: "9876543210",
  gender: "male",
  dob: "1984-06-14",
  addresses: [
    // On 100 Feet Road, Indiranagar (HAL 2nd Stage)
    { label: "Home", line1: "Flat 402, Sai Sannidhi Apartments, 100 Feet Road, HAL 2nd Stage", area: "Indiranagar", city: "Bangalore", pincode: "560038", lat: 12.9784, lng: 77.6408 },
  ],
};

export const CUSTOMERS: SeedCustomer[] = [
  { name: "Sneha Iyer", phone: "9845012345", gender: "female", dob: "1990-02-11", addresses: [addr("Home", "#14, 5th Cross, 6th Block", "Koramangala", 0.002, -0.004)] },
  { name: "Arjun Kapoor", phone: "9900123456", gender: "male", dob: "1979-09-23", addresses: [addr("Home", "Villa 23, Prestige Ozone, Whitefield Main Road", "Whitefield", 0.004, 0.003)] },
  { name: "Lakshmi Narayanan", phone: "9886054321", gender: "female", dob: "1958-12-02", addresses: [addr("Home", "#212, 11th Main, 4th Block", "Jayanagar", -0.001, 0.002), addr("Son's place", "#45, 24th Main, 2nd Phase", "JP Nagar", 0.003, -0.002)] },
  { name: "Farhan Sheikh", phone: "9741298765", gender: "male", dob: "1987-04-30", addresses: [addr("Home", "#8, 27th Main, Sector 2", "HSR Layout", 0.003, -0.002), addr("Office", "3rd Floor, Embassy Tech Square", "Bellandur", 0.002, 0.004)] },
  { name: "Deepa Menon", phone: "9632587410", gender: "female", dob: "1965-07-19", addresses: [addr("Home", "#33, 15th Cross, Sampige Road", "Malleshwaram", -0.002, 0.001)] },
  { name: "Rohan Gupta", phone: "9535678901", gender: "male", dob: "1993-11-05", addresses: [addr("Home", "B-1104, Purva Fountain Square, Marathahalli-Sarjapur Road", "Bellandur", -0.003, 0.002), addr("Parents' home", "#19, 16th Main, 2nd Stage", "BTM Layout", 0.001, 0.002), addr("Studio", "#7, Kodigehalli Main Road", "Hebbal", -0.004, 0.003)] },
];

export const SYMPTOM_NOTES: string[] = [
  "",
  "",
  "Occasional headaches in the evening.",
  "Feeling tired lately, want a general check.",
  "Annual check-up. Father has a history of heart disease.",
  "Mild chest discomfort after climbing stairs, please check ECG.",
  "Diabetic for 3 years, on Metformin. Need a review.",
  "Palpitations on and off for a week.",
  "Please ring the bell twice, elderly patient.",
  "BP was high at the pharmacy last week.",
];

export interface ReportTemplate {
  diagnosis: string;
  summary: string;
  prescription: PrescriptionItem[];
  advice: string[];
  followUp: string;
}

export type ClinicalProfile = "normal" | "hypertension" | "diabetes" | "tachycardia";

/** Report templates keyed by clinical profile. */
export const REPORTS: Record<ClinicalProfile, ReportTemplate[]> = {
  normal: [
    {
      diagnosis: "Routine health check: all parameters within normal limits",
      summary: "Vitals are within normal range. ECG shows normal sinus rhythm with no ST-T changes. Heart sounds S1 S2 normal, no murmurs. No acute concerns.",
      prescription: [{ medicine: "Vitamin D3 60,000 IU (Uprise-D3)", dosage: "1 sachet", frequency: "Once a week", duration: "8 weeks", notes: "Take with milk after a meal" }],
      advice: ["Continue regular physical activity, at least 150 minutes a week", "Keep salt and sugar intake moderate", "Repeat this check-up in 6 months"],
      followUp: "Routine review in 6 months",
    },
    {
      diagnosis: "Healthy adult, no abnormality detected",
      summary: "Blood pressure, sugar and oxygen saturation are normal. Resting heart rate is healthy. No clinical findings of concern.",
      prescription: [],
      advice: ["Stay hydrated, 2.5 to 3 litres of water a day", "Sleep 7 to 8 hours", "Annual lipid profile and HbA1c recommended"],
      followUp: "Annual check-up",
    },
  ],
  hypertension: [
    {
      diagnosis: "Stage 1 hypertension",
      summary: "Blood pressure is elevated on two readings. ECG shows normal sinus rhythm without signs of left ventricular strain. Heart sounds normal. Starting low-dose therapy with lifestyle changes.",
      prescription: [{ medicine: "Telmisartan 40 mg (Telma 40)", dosage: "1 tablet", frequency: "Once daily, morning", duration: "30 days", notes: "Do not skip doses" }],
      advice: ["Limit salt to under 5 g a day; avoid pickles, papad and packaged snacks", "30 minutes of brisk walking at least 5 days a week", "Log home BP twice a day and share at follow-up", "Get a lipid profile, serum creatinine and electrolytes done"],
      followUp: "Review in 4 weeks with home BP log",
    },
    {
      diagnosis: "Hypertension with dyslipidaemia risk",
      summary: "Raised blood pressure. Family history of coronary artery disease. ECG normal. Recommend antihypertensive and statin pending lipid profile.",
      prescription: [
        { medicine: "Amlodipine 5 mg (Amlong 5)", dosage: "1 tablet", frequency: "Once daily", duration: "30 days", notes: "May cause mild ankle swelling" },
        { medicine: "Atorvastatin 10 mg (Atorva 10)", dosage: "1 tablet", frequency: "Once daily at bedtime", duration: "30 days", notes: "" },
      ],
      advice: ["DASH-style diet: more vegetables, fruits, dals; less fried food", "Quit smoking if applicable", "Fasting lipid profile within 1 week"],
      followUp: "Teleconsult in 2 weeks with lipid report",
    },
  ],
  diabetes: [
    {
      diagnosis: "Type 2 diabetes mellitus, suboptimal control",
      summary: "Blood sugar is above target. BP and heart rate are acceptable. No acute complications. Optimising medication and diet.",
      prescription: [
        { medicine: "Metformin 500 mg (Glycomet 500)", dosage: "1 tablet", frequency: "Twice daily after meals", duration: "30 days", notes: "Take with food to avoid stomach upset" },
        { medicine: "Glimepiride 1 mg (Amaryl 1)", dosage: "1 tablet", frequency: "Once daily before breakfast", duration: "30 days", notes: "Watch for low sugar: sweating, shakiness" },
      ],
      advice: ["HbA1c, kidney function and urine microalbumin tests", "Replace white rice with millets or brown rice; avoid sweets and fruit juices", "Walk 15 minutes after each major meal", "Check feet daily for cuts or blisters"],
      followUp: "Review in 4 weeks with HbA1c report",
    },
    {
      diagnosis: "Impaired fasting glucose (prediabetes)",
      summary: "Fasting sugar is in the prediabetic range. Other vitals normal. Lifestyle modification is the first step.",
      prescription: [],
      advice: ["HbA1c test to confirm", "Reduce refined carbohydrates and sugary drinks", "Aim to lose 5 to 7 percent body weight over 6 months", "At least 150 minutes of exercise a week"],
      followUp: "Repeat fasting sugar and HbA1c in 3 months",
    },
  ],
  tachycardia: [
    {
      diagnosis: "Sinus tachycardia, likely due to dehydration and stress",
      summary: "Heart rate is mildly elevated with a regular sinus rhythm on ECG. No murmurs. SpO2 normal. Likely situational; no structural concern on examination.",
      prescription: [{ medicine: "ORS (Electral) sachet", dosage: "1 sachet in 1 litre water", frequency: "Sip through the day", duration: "3 days", notes: "" }],
      advice: ["Increase fluid intake", "Limit tea and coffee to 2 cups a day", "Try 10 minutes of slow breathing before bed", "If palpitations persist, get a thyroid profile (TSH)"],
      followUp: "Review in 2 weeks if symptoms continue",
    },
  ],
};

export const RATING_COMMENTS: Record<number, string[]> = {
  5: ["Very professional nurse, and the doctor explained everything patiently.", "Super convenient for my parents. Report came within the hour.", "Priya was gentle and on time. Loved the live ECG on the doctor screen!", "Excellent service, will book again.", ""],
  4: ["Good experience, nurse arrived 10 minutes late but was very thorough.", "Doctor was helpful. App could show more updates.", ""],
  3: ["Okay experience, had to wait for the doctor to join."],
};

export const LEADS = [
  { name: "Karthik Subramanian", phone: "9845098450", city: "Bangalore", message: "Need monthly BP and sugar checks for my father in Basavanagudi." },
  { name: "Nisha Agarwal", phone: "9811122233", city: "Bangalore", message: "Do you offer corporate health camps for 40 employees?" },
  { name: "Suresh Pillai", phone: "9447012345", city: "Kochi", message: "When are you launching in Kochi?" },
  { name: "Ayesha Khan", phone: "9886677889", city: "Bangalore", message: "" },
  { name: "Manoj Hegde", phone: "9620011223", city: "Mysuru", message: "Interested in elderly care subscription." },
];
