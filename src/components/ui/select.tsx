// shadcn-style Select nhẹ (bọc <select> native, KHÔNG Radix) — đủ cho các ô chọn
// đơn giản (chọn SKU, biến dò...). Nhận children là <option>. Style khớp Input +
// mũi chevron ▾. Ai cần combobox/tìm kiếm nâng cao thì mới cân nhắc bản Radix.
import * as React from 'react';
import { cn } from '@/lib/utils';

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative inline-flex w-full">
      <select
        ref={ref}
        className={cn(
          'h-9 w-full appearance-none rounded-md border border-input bg-card px-3 pr-8 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">▾</span>
    </div>
  ),
);
Select.displayName = 'Select';

export { Select };
