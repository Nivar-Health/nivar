import { PROVERBS, STAY_HEALTHY, type Phrase } from "./l10n";

/** Native-reviewed lines only (l10n.ts), alternating languages so every change of script is visible. */
const LINE: readonly Phrase[] = [
  STAY_HEALTHY[0],
  PROVERBS[0],
  STAY_HEALTHY[2],
  PROVERBS[2],
  STAY_HEALTHY[1],
  PROVERBS[1],
  STAY_HEALTHY[3],
];

/**
 * A slow ribbon of "stay healthy" and each language's own saying about health, between the hero and
 * the programmes. Two identical tracks loop seamlessly; the second is hidden from screen readers.
 * It is a .motion-loop, so reduced motion leaves it still.
 */
export function HealthRibbon() {
  return (
    <section aria-label="Stay healthy, in English, Kannada, Hindi and Marathi" className="overflow-hidden bg-primary text-white">
      <div className="ribbon-track motion-loop flex w-max">
        <Track />
        <Track hidden />
      </div>
    </section>
  );
}

function Track({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {LINE.map((p, i) => (
        <li key={i} className="flex items-center">
          <span
            lang={p.lang}
            className="px-7 py-5 text-[1.375rem] font-medium tracking-[-0.01em] whitespace-nowrap sm:px-9 sm:py-6 sm:text-[1.75rem]"
          >
            {p.text}
          </span>
          <Marigold />
        </li>
      ))}
    </ul>
  );
}

/** A small marigold, the flower of Indian welcomes and celebrations. */
function Marigold() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 sm:size-6">
      {Array.from({ length: 8 }, (_, k) => (
        <ellipse key={k} cx="12" cy="6.2" rx="3" ry="5" fill="var(--marigold)" transform={`rotate(${k * 45} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="3.4" fill="#ffd88f" />
    </svg>
  );
}
