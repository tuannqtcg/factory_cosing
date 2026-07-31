// ADR-059 — panel bên phải dùng CHUNG cho mọi màn "danh sách + xem/sửa chi tiết"
// (Nguyên Liệu, Bảng Giá): trượt vào từ phải, backdrop mờ nền nhưng KHÔNG rời
// trang (giữ ngữ cảnh danh sách phía sau). Hỗ trợ lồng tối đa 2 cấp — cấp 2
// (level=2) hẹp hơn, z-index cao hơn, có nút "← Quay lại" thay vì tự đóng cả 2.
// Thuần trình bày: không Firebase/API, không state ngoài open/onClose — màn cha
// tự quản lý phím Esc (ưu tiên đóng cấp lồng sâu nhất trước) để tránh 2 panel
// cùng lắng nghe keydown giẫm lên nhau.
export default function SlideOverPanel({
  open,
  onClose,
  onBack,
  title,
  level = 1,
  width,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Có nghĩa panel này lồng bên trong 1 panel khác — hiện nút "← Quay lại" thay vì icon X đóng hết. */
  onBack?: () => void;
  title: React.ReactNode;
  level?: 1 | 2;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {level === 1 && (
        <div
          onClick={onClose}
          aria-hidden="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(10,10,10,.32)',
            opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
            transition: 'opacity .2s ease', zIndex: 60,
          }}
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, height: '100vh',
          width: width ?? (level === 2 ? 380 : 440), maxWidth: '92vw',
          background: '#fff', borderLeft: '1px solid #e5e0d0',
          boxShadow: '-14px 0 32px rgba(20,16,10,.16)',
          transform: open ? 'translateX(0)' : 'translateX(105%)',
          transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
          zIndex: level === 2 ? 62 : 61,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid #f0ece0', flexShrink: 0 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', padding: 0, marginBottom: 8, fontSize: 11.5, fontWeight: 700, color: '#a8003b', cursor: 'pointer' }}
            >
              ← Quay lại
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3 }}>{title}</div>
            <button
              onClick={onClose}
              aria-label="Đóng"
              style={{ background: 'none', border: 'none', fontSize: 17, color: '#737373', cursor: 'pointer', padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </>
  );
}

/** Ô số nhỏ dùng trong panel (đối xứng .panel-stat của mockup Pha 1). */
export function PanelStat({ label, value, color }: { label: React.ReactNode; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: '#faf9f4', border: '1px solid #ece8dc', borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: '#737373', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{value}</div>
    </div>
  );
}
