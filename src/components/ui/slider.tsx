// shadcn-style Slider nhẹ (bọc <input type="range"> native, KHÔNG Radix) — accent ĐEN.
// onChange trả về SỐ (đã parse) để call-site khỏi tự đọc e.target.value.
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number;
  onValueChange: (v: number) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={cn('h-1.5 w-full cursor-pointer appearance-none accent-foreground', className)}
      {...props}
    />
  ),
);
Slider.displayName = 'Slider';

export { Slider };
