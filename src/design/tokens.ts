// ADR-033 — Design tokens: NGUỒN CHÂN LÝ DUY NHẤT cho màu/chữ/khoảng cách/bóng của
// app. Mọi màn dùng lại từ đây (qua src/design/primitives.tsx) thay vì gõ tay hex/px
// rải rác → nhất quán, đổi một chỗ đổi cả app, hết "trông như AI làm". Phong cách:
// analytics/fintech cao cấp — nền mát, mực gần đen, hairline border, bóng nhẹ, MỘT
// accent xanh dùng tiết chế; màu semantic (ok/cảnh báo/nguy) chỉ cho DỮ LIỆU.
export const color = {
  canvas: '#f4f5f7', // nền trang
  surface: '#ffffff', // mặt thẻ
  surfaceMuted: '#f8f9fb', // ô nền nhạt
  surfaceInk: '#0d0f14', // thẻ nền tối (giá chính thức…)

  border: '#e7e9ee', // hairline
  borderStrong: '#d3d7df',

  ink: '#0f1524', // chữ chính (gần đen)
  inkMuted: '#5b6472', // chữ phụ
  inkFaint: '#98a1b0', // nhãn mờ
  inkInverse: '#ffffff',

  brand: '#2f6bff', // accent tương tác/CTA/active — dùng TIẾT CHẾ
  brandHover: '#1f57e6',
  brandTint: '#eef3ff',
  brandInk: '#1b46b8',

  success: '#12915b', successTint: '#e9f7ef', successInk: '#0a6d43',
  danger: '#e5484d', dangerTint: '#fdecec', dangerInk: '#b4232a',
  warning: '#c8790f', warningTint: '#fdf3e4', warningInk: '#95590a',

  // Sidebar tối tinh
  sidebar: '#10131a',
  sidebarElevated: '#161a23',
  sidebarBorder: 'rgba(255,255,255,.07)',
  sidebarText: '#9aa3b2',
  sidebarTextActive: '#ffffff',
  sidebarMuted: '#5a6273',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40 } as const;

export const radius = { sm: 6, md: 9, lg: 14, pill: 999 } as const;

export const shadow = {
  sm: '0 1px 2px rgba(15,21,36,.05)',
  md: '0 1px 2px rgba(15,21,36,.04), 0 4px 12px rgba(15,21,36,.06)',
  lg: '0 2px 4px rgba(15,21,36,.04), 0 12px 32px rgba(15,21,36,.10)',
} as const;

export const font = {
  family: '"Inter", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: '"SF Mono", "Roboto Mono", ui-monospace, monospace',
  size: { eyebrow: 10, xs: 11, sm: 12, base: 13, md: 14, lg: 16, xl: 19, xxl: 24, hero: 28 } as const,
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 } as const,
} as const;

/** Kiểu "eyebrow" (nhãn nhỏ in hoa trên tiêu đề) — dùng chung. */
export const eyebrowStyle = {
  fontSize: font.size.eyebrow,
  letterSpacing: '.13em',
  textTransform: 'uppercase' as const,
  color: color.inkFaint,
  fontWeight: font.weight.semibold,
};

/** Số liệu: canh cột đều (tabular-nums). */
export const tnum = { fontVariantNumeric: 'tabular-nums' as const };

export type SemanticTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
export const toneColor: Record<SemanticTone, { fg: string; tint: string; ink: string }> = {
  neutral: { fg: color.inkMuted, tint: color.surfaceMuted, ink: color.ink },
  brand: { fg: color.brand, tint: color.brandTint, ink: color.brandInk },
  success: { fg: color.success, tint: color.successTint, ink: color.successInk },
  warning: { fg: color.warning, tint: color.warningTint, ink: color.warningInk },
  danger: { fg: color.danger, tint: color.dangerTint, ink: color.dangerInk },
};
