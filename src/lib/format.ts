// Định dạng số kiểu VN (AGENTS.md luật #4: 1.234.567 đ).
const vnInt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export function fmtVnd(value: number): string {
  return vnInt.format(Math.round(value));
}

export function fmtUsd(value: number, digits = 2): string {
  return value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(value01: number, digits = 1): string {
  return (value01 * 100).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + '%';
}

/** Tỷ đồng gọn cho KPI card (vd 15,97 tỷ đ). */
export function fmtTyVnd(value: number): string {
  return (value / 1e9).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' tỷ đ';
}
