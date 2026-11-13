import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      // Every size token in globals.css, so cn() never mistakes one for a colour and drops it.
      text: ["h1", "h2", "h3", "h4", "cta", "lede", "body", "small", "note", "caption", "rotator"],
      ease: ["calm", "standard", "exit", "breath"],
      shadow: ["soft", "lift", "glass"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
