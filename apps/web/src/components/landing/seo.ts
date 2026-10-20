import type { Metadata } from "next";

/** The share preview for every public page: the nurse and patient from the hero, cropped to 1200 x 630. */
const SHARE_IMAGE = {
  url: "/img/og-home.jpg",
  width: 1200,
  height: 630,
  alt: "A Nivar nurse placing a smart ECG patch on a woman at home",
};

/**
 * Title, description, canonical link and the WhatsApp / LinkedIn / X previews for one public page.
 * Paths are resolved against metadataBase (app/layout.tsx), so previews never point at localhost.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  /** Use the title as is, without the " | Nivar Health" suffix (the home page). */
  absoluteTitle?: boolean;
}): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "Nivar Health",
      locale: "en_IN",
      url: path,
      title,
      description,
      images: [SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE.url] },
  };
}
