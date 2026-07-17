// ADR-033 — Primitive dùng chung, dựng TỪ tokens. Mọi màn ghép từ đây → đồng bộ tức
// thì, nâng "gu" một lần cho tất cả. Vẫn inline-style (không đổi kiến trúc) nhưng giá
// trị lấy từ src/design/tokens.ts, không gõ tay.
import type { CSSProperties, ReactNode } from 'react';
import { color, space, radius, shadow, font, eyebrowStyle, tnum, toneColor, type SemanticTone } from './tokens.js';

export function Screen({ children, maxWidth = 1040 }: { children: ReactNode; maxWidth?: number }) {
  return <div style={{ padding: `${space[8]}px ${space[8] + 4}px`, maxWidth, margin: '0 auto' }}>{children}</div>;
}

export function PageHeader({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: space[4], marginBottom: space[5] }}>
      <div>
        {eyebrow && <div style={eyebrowStyle}>{eyebrow}</div>}
        <h1 style={{ margin: '5px 0 0', fontSize: font.size.xxl, fontWeight: font.weight.bold, letterSpacing: '-.02em', color: color.ink }}>{title}</h1>
        {subtitle && <p style={{ margin: '6px 0 0', fontSize: font.size.sm, color: color.inkMuted, lineHeight: 1.5, maxWidth: 720 }}>{subtitle}</p>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

export function Card({ children, style, inverse, pad = space[5] }: { children: ReactNode; style?: CSSProperties; inverse?: boolean; pad?: number }) {
  return (
    <div
      style={{
        background: inverse ? color.surfaceInk : color.surface,
        color: inverse ? color.inkInverse : color.ink,
        border: inverse ? 'none' : `1px solid ${color.border}`,
        borderRadius: radius.lg,
        boxShadow: inverse ? shadow.md : shadow.sm,
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div style={{ ...eyebrowStyle, color: color.inkMuted, marginBottom: space[3] }}>{children}</div>;
}

export function Stat({ label, value, sub, tone = 'neutral', size = 'md', valueColor }: { label: string; value: ReactNode; sub?: ReactNode; tone?: SemanticTone; size?: 'md' | 'lg'; valueColor?: string }) {
  return (
    <div>
      <div style={{ ...eyebrowStyle, letterSpacing: '.06em', color: color.inkFaint }}>{label}</div>
      <div style={{ fontSize: size === 'lg' ? font.size.xl : font.size.lg, fontWeight: font.weight.bold, ...tnum, color: valueColor ?? (tone === 'neutral' ? color.ink : toneColor[tone].fg), marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: font.size.xs, color: color.inkFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: SemanticTone }) {
  const c = toneColor[tone];
  return (
    <span style={{ display: 'inline-block', fontSize: font.size.eyebrow, fontWeight: font.weight.bold, letterSpacing: '.04em', textTransform: 'uppercase', color: c.ink, background: c.tint, border: `1px solid ${c.fg}33`, padding: '2px 8px', borderRadius: radius.pill }}>{children}</span>
  );
}

export function Banner({ tone = 'brand', children, action }: { tone?: SemanticTone; children: ReactNode; action?: ReactNode }) {
  const c = toneColor[tone];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space[4], flexWrap: 'wrap', padding: `${space[3]}px ${space[4]}px`, borderRadius: radius.md, border: `1px solid ${c.fg}40`, background: c.tint, color: c.ink }}>
      <div style={{ flex: 1, minWidth: 260, fontSize: font.size.sm, fontWeight: font.weight.medium, lineHeight: 1.5 }}>{children}</div>
      {action}
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', size = 'md' }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'dark'; size?: 'sm' | 'md' }) {
  const base: CSSProperties = {
    fontSize: size === 'sm' ? font.size.xs : font.size.sm,
    fontWeight: font.weight.semibold,
    padding: size === 'sm' ? '5px 10px' : '8px 14px',
    borderRadius: radius.sm,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'background .12s',
  };
  const styles: Record<string, CSSProperties> = {
    primary: { ...base, background: color.brand, color: '#fff' },
    dark: { ...base, background: color.ink, color: '#fff' },
    ghost: { ...base, background: color.surface, color: color.inkMuted, borderColor: color.borderStrong },
  };
  return <button onClick={onClick} style={styles[variant]}>{children}</button>;
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: { options: { id: T; label: string; title?: string }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div style={{ display: 'inline-flex', border: `1px solid ${color.borderStrong}`, borderRadius: radius.sm, overflow: 'hidden', background: color.surface }}>
      {options.map((o, i) => {
        const active = o.id === value;
        return (
          <div key={o.id} onClick={() => onChange(o.id)} title={o.title}
            style={{ padding: size === 'sm' ? '5px 11px' : '7px 15px', cursor: 'pointer', fontSize: font.size.xs, fontWeight: font.weight.semibold, background: active ? color.brand : 'transparent', color: active ? '#fff' : color.inkMuted, borderLeft: i ? `1px solid ${color.border}` : 'none' }}>
            {o.label}
          </div>
        );
      })}
    </div>
  );
}

export function NumberField({ value, onChange, width = 110, placeholder, suffix }: { value: number | ''; onChange: (v: number | '') => void; width?: number; placeholder?: string; suffix?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input type="number" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value) || 0)}
        style={{ width, padding: '6px 9px', fontSize: font.size.sm, fontWeight: font.weight.semibold, textAlign: 'right', border: `1px solid ${color.borderStrong}`, borderRadius: radius.sm, outline: 'none', color: color.ink, ...tnum }} />
      {suffix && <span style={{ fontSize: font.size.xs, color: color.inkFaint }}>{suffix}</span>}
    </span>
  );
}

/** Bảng gọn: header + hàng, dùng grid template chung. */
export function TableRow({ cols, cells, header, style }: { cols: string; cells: ReactNode[]; header?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: space[2], padding: `${header ? 9 : 8}px ${space[4]}px`, borderBottom: `1px solid ${header ? color.border : color.surfaceMuted}`, background: header ? color.surfaceMuted : 'transparent', alignItems: 'center', ...style }}>
      {cells.map((c, i) => (
        <div key={i} style={header ? { ...eyebrowStyle, letterSpacing: '.05em', color: color.inkMuted } : {}}>{c}</div>
      ))}
    </div>
  );
}

export { color as tk, space as sp, radius as rd, font as ft, shadow as sh, tnum, toneColor };
