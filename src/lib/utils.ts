import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\-\s_]+/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
  }