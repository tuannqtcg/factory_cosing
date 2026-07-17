// shadcn-style Tabs kiểu GẠCH CHÂN (underline), controlled, KHÔNG Radix — dùng cho
// các màn tự quản nội dung tab bằng điều kiện (Dashboard, Phân Tích Định Giá, WhatIf).
// TabsList = thanh chứa; TabsTrigger = 1 tab (active gạch chân ĐEN).
import * as React from 'react';
import { cn } from '@/lib/utils';

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-1 border-b border-border', className)} {...props} />
  ),
);
TabsList.displayName = 'TabsList';

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, active, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-state={active ? 'active' : 'inactive'}
      className={cn(
        '-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
        active
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    />
  ),
);
TabsTrigger.displayName = 'TabsTrigger';

export { TabsList, TabsTrigger };
