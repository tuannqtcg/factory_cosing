// shadcn/ui — Badge (style new-york). Mặc định trung tính (xám). Variant semantic
// (success/warning/destructive) CHỈ để gắn nhãn TRẠNG THÁI DỮ LIỆU (cao/thấp nhất…).
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-eyebrow font-bold uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-muted text-muted-foreground',
        outline: 'border-input text-muted-foreground',
        success: 'border-success/25 bg-success-tint text-success',
        warning: 'border-warning/25 bg-warning-tint text-warning',
        destructive: 'border-destructive/25 bg-destructive-tint text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
