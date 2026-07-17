// shadcn-style Segmented control (button group, KHÔNG cần Radix) — thay primitive
// `Segmented` cũ ở src/design. Active = ĐEN (--primary); phần còn lại trung tính.
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  title?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={cn('inline-flex overflow-hidden rounded-md border border-input bg-card', className)}>
      {options.map((o, i) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            title={o.title}
            onClick={() => onChange(o.id)}
            className={cn(
              'font-semibold transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-1.5 text-xs',
              i > 0 && 'border-l border-border',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
