import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["h1", "h2", "h3", "h4", "cta", "lede", "body", "small", "caption", "stat", "rotator"],
      ease: ["calm", "standard", "exit", "breath"],
      shadow: ["soft", "lift", "glass"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
