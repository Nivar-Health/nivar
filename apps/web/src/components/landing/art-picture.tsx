import type { JSX } from "react";
import { getImageProps } from "next/image";

/** One art-directed file: `media` in range syntax, e.g. "(width < 40rem)"; `sizes` keeps (min-width: …px). */
export type ArtSource = { media: string; src: string; sizes: string };

/**
 * A different file per width (art direction, spec §1.12), each with its own srcset from the image
 * optimiser. Fill layout: the parent sets the box (position and size), the <img> covers it. The browser
 * fetches one candidate only: the first <source> whose media matches, else the fallback. Lazy, except
 * the hero (`eager`), which is the LCP and must never wait.
 */
export function ArtPicture({
  alt,
  sources,
  fallback,
  eager = false,
  imgClassName,
}: {
  alt: string;
  sources: readonly ArtSource[];
  /** The <img>, for every other width. */
  fallback: { src: string; sizes: string };
  /** Hero only: loading="eager" and fetchPriority="high". */
  eager?: boolean;
  /** Fit and position, e.g. "object-cover object-[50%_40%] sm:object-[50%_30%]". */
  imgClassName?: string;
}): JSX.Element {
  const common = { alt, fill: true, ...(eager ? ({ loading: "eager", fetchPriority: "high" } as const) : {}) };
  const { props: img } = getImageProps({ ...common, ...fallback, className: imgClassName });
  return (
    <picture className="contents">
      {sources.map(({ media, src, sizes }) => (
        <source key={media} media={media} srcSet={getImageProps({ ...common, src, sizes }).props.srcSet} sizes={sizes} />
      ))}
      <img {...img} alt={alt} />
    </picture>
  );
}
