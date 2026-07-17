// shadcn/ui — helper gộp className (clsx) + hợp nhất xung đột Tailwind (tailwind-merge).
// Mọi component trong src/components/ui/ dùng `cn()` để cho phép override class từ ngoài.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
