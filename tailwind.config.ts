import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// ADR-033 (bổ sung 2026-07-17) — chuyển kênh trình bày sang Tailwind + shadcn/ui.
// NGUỒN CHÂN LÝ màu = CSS variables trong src/index.css (theme đen–trắng); file này
// chỉ ÁNH XẠ biến sang tên tiện ích Tailwind. Đổi màu → sửa index.css, không sửa đây.
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // "faint" = nhãn mờ (inkFaint) — dùng cho eyebrow/ghi chú.
        faint: 'hsl(var(--faint))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Màu DỮ LIỆU (biểu đồ + trạng thái) — KHÔNG dùng trang trí UI.
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          tint: 'hsl(var(--destructive-tint))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          tint: 'hsl(var(--success-tint))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          tint: 'hsl(var(--warning-tint))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 6px)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'Roboto Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        eyebrow: ['10px', { lineHeight: '14px', letterSpacing: '.06em' }],
      },
    },
  },
  plugins: [animate],
} satisfies Config;
