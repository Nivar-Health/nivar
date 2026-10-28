export type HealthSource = {
  label: string;
  url: string;
  /** The tip and fact cards' label ("WHO, 2025"). "All sources", the Share text and Take a minute keep `label`. */
  short?: string;
};

/**
 * The sources behind Take a minute (take-a-minute/tools), also listed under "All sources" on the page.
 * Kept out of health-content.ts so the lazy Take a minute chunk doesn't carry every fact and tip
 * (that module builds them at load, so bundlers can't drop them).
 * The AHA/ACC 2025 guideline page covers neither resting nor readings, so Rest cites the CDC and the
 * AHA crisis page instead (re-checked 21 Oct 2026).
 */
export const MINUTE_SOURCES = {
  nhsBreathing: {
    label: "NHS, Breathing exercises for stress, 2026",
    short: "NHS, 2026",
    url: "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/",
  },
  cdcMeasureBp: {
    label: "US CDC, Measuring Your Blood Pressure, 2026",
    short: "US CDC, 2026",
    url: "https://www.cdc.gov/high-blood-pressure/measure/index.html",
  },
  ahaCrisis: {
    label: "American Heart Association, When to call 911 about high blood pressure, 2025",
    short: "AHA, 2025",
    url: "https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/when-to-call-911-for-high-blood-pressure",
  },
  medlinePulse: {
    label: "MedlinePlus, Pulse, 2025",
    short: "MedlinePlus, 2025",
    url: "https://medlineplus.gov/ency/article/003399.htm",
  },
  nhsAf: {
    label: "NHS, Atrial fibrillation, 2025",
    short: "NHS, 2025",
    url: "https://www.nhs.uk/conditions/atrial-fibrillation/",
  },
  aaoEyeStrain: {
    label: "American Academy of Ophthalmology, Eye Strain and Sleepy Eyes, 2023",
    url: "https://www.aao.org/eye-health/diseases/what-is-eye-strain",
  },
} as const satisfies Record<string, HealthSource>;
