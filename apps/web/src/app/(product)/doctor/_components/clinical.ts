import { vitalAssessment } from "@/lib/format";
import type { Booking, Patient, ServiceCode } from "@/lib/types";

export const DIAGNOSIS_PICKS = [
  "Normal health check",
  "Stage 1 hypertension",
  "Stage 2 hypertension",
  "Type 2 diabetes, uncontrolled",
  "Prediabetes",
  "Sinus tachycardia",
  "Sinus bradycardia",
  "Suspected arrhythmia, refer cardiology",
] as const;

/** Common Indian generics with a familiar brand, for the medicine datalist. */
export const MEDICINES = [
  "Amlodipine 5 mg (Amlong)",
  "Telmisartan 40 mg (Telma)",
  "Telmisartan 40 mg + Amlodipine 5 mg (Telma-AM)",
  "Losartan 50 mg (Losar)",
  "Metoprolol succinate 25 mg (Met XL)",
  "Metformin 500 mg (Glycomet)",
  "Metformin SR 1000 mg (Glycomet SR)",
  "Glimepiride 1 mg (Amaryl)",
  "Sitagliptin 100 mg (Januvia)",
  "Atorvastatin 10 mg (Atorva)",
  "Rosuvastatin 10 mg (Rosuvas)",
  "Aspirin 75 mg (Ecosprin)",
  "Clopidogrel 75 mg (Clopilet)",
  "Pantoprazole 40 mg (Pan 40)",
  "Paracetamol 650 mg (Dolo 650)",
  "Cetirizine 10 mg (Okacet)",
  "Vitamin D3 60,000 IU (Uprise-D3)",
  "Methylcobalamin 1500 mcg (Nurokind)",
  "Iron + Folic acid (Livogen)",
] as const;

export const FREQUENCIES = [
  { value: "OD", label: "OD", hint: "Once a day" },
  { value: "BD", label: "BD", hint: "Twice a day" },
  { value: "TDS", label: "TDS", hint: "Three times a day" },
  { value: "HS", label: "HS", hint: "At bedtime" },
  { value: "SOS", label: "SOS", hint: "When needed" },
  { value: "Once a week", label: "Weekly", hint: "Once a week" },
] as const;

export const ADVICE_TEMPLATES = [
  "Reduce salt intake to under 5 g a day",
  "30 min brisk walk daily",
  "Recheck BP in 2 weeks",
  "Avoid sugary drinks and refined carbs",
  "Check fasting sugar twice a week",
  "Sleep 7 to 8 hours a night",
  "Avoid smoking and limit alcohol",
  "Stay well hydrated",
] as const;

export const FOLLOW_UP_PICKS = [
  "Review in 2 weeks",
  "Review in 1 month",
  "Review in 3 months",
  "Routine check-up in 6 months",
] as const;

export const SERVICE_LABEL: Record<ServiceCode, string> = {
  BP: "Blood pressure",
  ECG: "ECG",
  SUGAR: "Blood sugar",
  HR: "Heart rate",
  SPO2: "SpO2",
  STETH: "Stethoscope",
  CONSULT: "Doctor consult",
};

export const RELATION_LABEL: Record<Patient["relation"], string> = {
  self: "Self",
  parent: "Parent",
  spouse: "Spouse",
  child: "Child",
  other: "Family",
};

export const GENDER_SHORT: Record<Patient["gender"], string> = {
  male: "M",
  female: "F",
  other: "O",
};

export function genderLabel(g: Patient["gender"]): string {
  return g === "male" ? "Male" : g === "female" ? "Female" : "Other";
}

/** Diagnoses the vitals point to, so the matching quick-pick can be flagged. */
export function suggestedDiagnoses(booking: Booking): Set<string> {
  const out = new Set<string>();
  const v = booking.vitals;
  const hr = booking.ecg?.heartRate ?? v?.heartRate;
  if (v?.bpSystolic && v?.bpDiastolic) {
    if (v.bpSystolic >= 140 || v.bpDiastolic >= 90) out.add("Stage 2 hypertension");
    else if (v.bpSystolic >= 130 || v.bpDiastolic >= 80) out.add("Stage 1 hypertension");
  }
  if (typeof v?.sugar === "number") {
    const a = vitalAssessment("sugar", v.sugar, { sugarType: v.sugarType });
    if (a.level === "high") {
      const severe = v.sugarType === "fasting" ? v.sugar >= 126 : v.sugar >= 200;
      out.add(severe ? "Type 2 diabetes, uncontrolled" : "Prediabetes");
    }
  }
  if (typeof hr === "number") {
    if (hr > 100) out.add("Sinus tachycardia");
    else if (hr < 60) out.add("Sinus bradycardia");
  }
  const rhythm = booking.ecg?.rhythm?.toLowerCase() ?? "";
  if (rhythm && !rhythm.includes("sinus")) out.add("Suspected arrhythmia, refer cardiology");
  if (out.size === 0 && v && (v.bpSystolic || v.heartRate || v.sugar)) out.add("Normal health check");
  return out;
}
