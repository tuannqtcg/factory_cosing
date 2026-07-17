// shadcn-style Tooltip nhẹ (hover thuần CSS, KHÔNG Radix/JS) — đủ cho chú thích ngắn
// (vd nút "?" giải nghĩa chỉ số). Bong bóng nền ĐEN chữ trắng, hiện khi hover/focus.
import * as React from 'react';
import { cn } from '@/lib/utils';

export function Tooltip({
  content,
  children,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('group relative inline-flex', className)} tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[240px] -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs font-medium leading-snug text-background opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100 group-focus:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
