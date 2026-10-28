import { API_ORIGIN } from "@/lib/api";
import type { Catalog, Package, Service } from "@/lib/types";

/**
 * Snapshot of the seeded catalogue, shown only when the API cannot be reached
 * so the landing page never renders an empty pricing section.
 */
const FALLBACK_SERVICES: Service[] = [
  { code: "BP", name: "Blood Pressure", shortName: "BP", description: "Digital blood pressure measurement, two readings averaged, by a registered nurse.", price: 199, durationMin: 5, requiresDevice: null, icon: "gauge" },
  { code: "ECG", name: "Smart ECG", shortName: "ECG", description: "Resting ECG on a smart device, streamed live to your Nivar doctor for review.", price: 799, durationMin: 15, requiresDevice: "ecg", icon: "activity" },
  { code: "SUGAR", name: "Blood Sugar", shortName: "Sugar", description: "Glucometer test (fasting, random or post-meal) with instant result.", price: 149, durationMin: 5, requiresDevice: null, icon: "droplet" },
  { code: "HR", name: "Heart Rate", shortName: "HR", description: "Resting heart rate and rhythm check.", price: 99, durationMin: 2, requiresDevice: null, icon: "heart-pulse" },
  { code: "SPO2", name: "Oxygen Saturation", shortName: "SpO2", description: "Pulse oximetry to measure blood oxygen levels.", price: 99, durationMin: 2, requiresDevice: null, icon: "wind" },
  { code: "STETH", name: "Smart Stethoscope", shortName: "Steth", description: "Heart and lung sounds through a digital stethoscope, heard live by the doctor.", price: 399, durationMin: 10, requiresDevice: "stethoscope", icon: "stethoscope" },
  { code: "CONSULT", name: "Doctor Video Consult", shortName: "Consult", description: "Video consultation with a Nivar doctor, with a written report and prescription.", price: 499, durationMin: 15, requiresDevice: null, icon: "video" },
];

const pkg = (p: Omit<Package, "id" | "isActive">): Package => ({ ...p, id: p.slug, isActive: true });

const FALLBACK_PACKAGES: Package[] = [
  pkg({ slug: "essential-vitals", name: "Essential Vitals", tagline: "The quick monthly check", description: "Blood pressure, blood sugar, heart rate and oxygen saturation, recorded at home by a registered Nivar nurse.", serviceCodes: ["BP", "SUGAR", "HR", "SPO2"], price: 449, mrp: 546, popular: false, sortOrder: 1 }),
  pkg({ slug: "heart-check", name: "Heart Check", tagline: "ECG and stethoscope, reviewed live by a doctor", description: "Smart ECG and digital stethoscope streamed live to a Nivar doctor, plus BP, heart rate and a video consult with a written report.", serviceCodes: ["BP", "ECG", "STETH", "HR", "CONSULT"], price: 1499, mrp: 2195, popular: true, sortOrder: 2 }),
  pkg({ slug: "complete-home-checkup", name: "Complete Home Check-up", tagline: "Everything, in one visit", description: "All vitals, smart ECG, digital stethoscope and a doctor video consult with a full report and prescription.", serviceCodes: ["BP", "ECG", "SUGAR", "HR", "SPO2", "STETH", "CONSULT"], price: 1899, mrp: 2643, popular: false, sortOrder: 3 }),
  pkg({ slug: "diabetes-care", name: "Diabetes Care", tagline: "Sugar, BP and a doctor who follows up", description: "Blood sugar, blood pressure and heart rate, with a doctor consult to review medication and diet.", serviceCodes: ["SUGAR", "BP", "HR", "CONSULT"], price: 899, mrp: 946, popular: false, sortOrder: 4 }),
];

export type LandingCatalog = Catalog & { live: boolean };

/**
 * Live catalogue from the API (so admin price edits show up immediately),
 * with a short timeout and a static fallback if the API is down.
 */
export async function getCatalog(): Promise<LandingCatalog> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/catalog`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const data = (await res.json()) as Partial<Catalog>;
    const services = Array.isArray(data.services) ? data.services : [];
    const packages = Array.isArray(data.packages) ? data.packages.filter((p) => p.isActive !== false) : [];
    if (packages.length === 0 && services.length === 0) throw new Error("empty catalog");
    return {
      services: services.length ? services : FALLBACK_SERVICES,
      packages: [...packages].sort((a, b) => a.sortOrder - b.sortOrder),
      live: true,
    };
  } catch {
    return { services: FALLBACK_SERVICES, packages: FALLBACK_PACKAGES, live: false };
  }
}
