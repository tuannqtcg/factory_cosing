// ADR-033 — Design tokens: NGUỒN CHÂN LÝ DUY NHẤT cho màu/chữ/khoảng cách/bóng của
// app. Mọi màn dùng lại từ đây (qua src/design/primitives.tsx) thay vì gõ tay hex/px
// rải rác → nhất quán, đổi một chỗ đổi cả app, hết "trông như AI làm". Phong cách:
// analytics/fintech cao cấp — nền mát, mực gần đen, hairline border, bóng nhẹ, MỘT
// accent xanh dùng tiết chế; màu semantic (ok/cảnh báo/nguy) chỉ cho DỮ LIỆU.
// Phong cách: TỐI GIẢN ĐEN–TRẮNG (user 2026-07-17). Đen/trắng/xám là chủ đạo;
// accent tương tác = ĐEN (không màu). Màu CHỈ dành cho BIỂU ĐỒ (success/danger…)
// và GHI CHÚ CẦN THIẾT (banner cảnh báo) — không dùng màu cho trang trí UI.
export const color = {
  canvas: '#f6f6f6', // nền trang (xám cực nhạt để thẻ trắng nổi)
  surface: '#ffffff', // mặt thẻ
  surfaceMuted: '#f4f4f4', // ô nền nhạt
  surfaceInk: '#0a0a0a', // thẻ nền đen (điểm nhấn)

  border: '#e6e6e6', // hairline
  borderStrong: '#d4d4d4',

  ink: '#0a0a0a', // chữ chính (đen)
  inkMuted: '#525252', // chữ phụ
  inkFaint: '#a3a3a3', // nhãn mờ
  inkInverse: '#ffffff',

  // "brand" = accent tương tác = ĐEN (active/CTA/segmented) — KHÔNG dùng màu.
  brand: '#0a0a0a',
  brandHover: '#262626',
  brandTint: '#f2f2f2',
  brandInk: '#0a0a0a',

  // Màu CHỈ cho biểu đồ + ghi chú cần thiết:
  success: '#1f9d57', successTint: '#eef8f1', successInk: '#137a41',
  danger: '#dc2f34', dangerTint: '#fdeded', dangerInk: '#b01f24',
  warning: '#b7791f', warningTint: '#fbf4e6', warningInk: '#8a5a12',

  // Sidebar đen tuyền
  sidebar: '#0a0a0a',
  sidebarElevated: '#1c1c1c',
  sidebarBorder: 'rgba(255,255,255,.09)',
  sidebarText: '#a3a3a3',
  sidebarTextActive: '#ffffff',
  sidebarMuted: '#6b6b6b',
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
