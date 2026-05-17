import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAbbreviatedValue(val: number) {
  const sign = val < 0 ? "-" : "";
  const absoluteVal = Math.abs(val);

  if (absoluteVal >= 1_000_000_000) {
    return sign + (absoluteVal / 1_000_000_000).toFixed(1) + 'B';
  }
  if (absoluteVal >= 1_000_000) {
    return sign + (absoluteVal / 1_000_000).toFixed(1) + 'M';
  }
  if (absoluteVal >= 1_000) {
    return sign + (absoluteVal / 1_000).toFixed(1) + 'k';
  }
  return sign + absoluteVal.toFixed(1);
}
