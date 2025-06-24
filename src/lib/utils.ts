import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a URL-safe Base64 string to a standard Base64 string.
 * Standard Base64 uses '+' and '/', and may require padding '='.
 * URL-safe Base64 replaces '+' with '-', '/' with '_', and often omits padding.
 * @param urlSafeBase64 The URL-safe Base64 encoded string.
 * @returns The standard Base64 encoded string.
 */
export function convertUrlSafeBase64ToStandard(urlSafeBase64: string): string {
  if (!urlSafeBase64) {
    return "";
  }
  // Replace URL-safe characters with standard Base64 characters
  let standardBase64 = urlSafeBase64.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if necessary
  switch (standardBase64.length % 4) {
    case 0: // No padding needed
      break;
    case 2: // Two padding characters needed
      standardBase64 += '==';
      break;
    case 3: // One padding character needed
      standardBase64 += '=';
      break;
    default:
      // This case (length % 4 === 1) usually indicates an invalid Base64 string,
      // but we'll let the browser's Base64 decoder handle potential errors.
      console.warn('Attempting to pad Base64 string with length % 4 === 1. This might indicate an issue.');
      // No padding added for this case.
  }
  return standardBase64;
}
