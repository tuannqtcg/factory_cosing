// ADR-035 — nút ⓘ "Giải thích màn này" trên MỌI màn. Nguyên tắc: mọi con số
// đưa cho CEO phải tự giải thích được gốc gác NGAY TẠI CHỖ, bằng ngôn ngữ
// kinh doanh — người xem là CEO, không phải lập trình viên. Nội dung tĩnh,
// đúc từ tài liệu quyết định của dự án; khung cố định 4 mục.
import { useState } from 'react';

export interface ScreenExplain {
  /** Màn này trả lời câu hỏi gì (1 câu). */
  question: string;
  /** Các con số từ đâu ra — nói bằng lời, không ký hiệu. */
  source: string[];
  /** Thấy dấu hiệu gì thì làm gì. */
  action: string[];
  /** Màn liên quan (bấm là chuyển). */
  related: Array<{ tab: string; label: string }>;
}

export const SCREEN_EXPLAINS: Record<string, ScreenExplain> = {
  dashboard: {
    question: 'Nhà máy hôm nay đang thế nào — giá thành, hòa vốn, và bao lâu thu hồi vốn đầu tư?',
    source: [
      'Giá thành mỗi kg: tiền nguyên liệu (theo giá thị trường hiện tại) + tiền sản xuất (lương, điện, nước, khấu hao máy) + chi phí chung phân bổ, tính khi nhà máy chạy đủ số ca bình thường.',
      'Thời gian hoàn vốn: tổng tiền đã bỏ vào máy móc, khuôn, nhà xưởng, vốn lưu động — chia cho tiền lãi cộng khấu hao thu về mỗi năm nếu bán hết công suất ở giá chuẩn.',
      'Mọi con số cập nhật tự động mỗi khi anh sửa tham số hay cấu hình.',
    ],
    action: [
      'Số hoàn vốn hay lợi nhuận nhìn xấu đi → vào Kịch Bản & Hoạch Định xem yếu tố nào đang bào mòn mạnh nhất (tab So Sánh Kịch Bản).',
      'Muốn thử "chạy thêm ca / đổi biên lời thì sao" → mở Kịch Bản & Hoạch Định (tab Trợ Lý CEO).',
    ],
    related: [
      { tab: 'planning:compare', label: 'So Sánh Kịch Bản — điều gì bào lợi nhuận mạnh nhất' },
      { tab: 'planning:ceo', label: 'Trợ Lý CEO — thử kịch bản ca/biên lời' },
    ],
  },
  materials: {
    question: 'Nguyên liệu đang tồn giá khác nhau — đang lãi hay lỗ giữ kho, và có cần chốt lại giá bán không?',
    source: [
      'Mỗi nguyên liệu 1 dòng, bấm mở panel: các lô đang tồn với giá nhập từng lô → giá bình quân gia quyền của kho, đặt cạnh giá mua mới hôm nay (giá thị trường) và baseline (mốc neo giá bán).',
      'Kho rẻ hơn thị trường = đang lãi giữ kho; kho đắt hơn = đang lỗ giữ kho, và kế toán buộc phải trích lập dự phòng giảm giá (chuẩn mực VAS-02) ngay cả khi chưa bán.',
      'Giá bán chính thức tính theo baseline, giữ ổn định bằng cơ chế khóa: chỉ khi giá thị trường lệch quá ngưỡng cho phép mới MỞ KHÓA, đề nghị chốt lại.',
    ],
    action: [
      'Thấy MỞ KHÓA → mở panel nguyên liệu đó, bấm "Chốt baseline = giá hôm nay" ngay trong panel, rồi đối chiếu lại Bảng Giá.',
      'Lô hàng mới về hoặc số liệu lô sai → bấm vào lô trong panel để sửa (panel con), rồi "Lưu thay đổi lô".',
    ],
    related: [
      { tab: 'pricing', label: 'Bảng Giá — chốt lại giá bán' },
    ],
  },
  pricing: {
    question: 'Giá bán từng sản phẩm là bao nhiêu, từ đâu ra con số đó, và giá đưa nhà phân phối là bao nhiêu?',
    source: [
      'Mọi mức giá đều bắt nguồn từ GIÁ VF — giá xuất xưởng của nhà máy. Công thức bằng lời: giá thành đầy đủ của sản phẩm + phần lời của nhà máy = giá VF.',
      'Từ giá VF suy tiếp một chiều: cộng lãi khâu thương mại ra giá TCG, rồi cộng biên của nhà phân phối ra giá niêm yết, cuối cùng cộng VAT. Các tầng sau là phép nhân tự động — muốn đổi giá, đổi ở gốc VF.',
      'Vì sao neo ở VF? Đó là tầng duy nhất nhà máy kiểm soát được; các tầng sau là chính sách phân phối.',
      'Giá VF được giữ ỔN ĐỊNH: giá nguyên liệu thị trường dao động trong ngưỡng cho phép thì giá bán không đổi; vượt ngưỡng mới đề nghị chốt lại — khách hàng không bị đổi giá liên tục.',
      'Hai dạng xem: DANH SÁCH để tra nhanh cả bảng; PHIẾU GIÁ để xem một sản phẩm thật chi tiết — chọn ống size nào ra phiếu size đó, phụ kiện cũng vậy.',
      'Ở dạng danh sách, bấm vào bất kỳ dòng nào để xem đường đi của chính con số giá đó, từng bước một.',
    ],
    action: [
      'Muốn tăng/giảm mặt bằng giá → sửa "phần lời của nhà máy" (markup VF) ở Thiết Lập, giá toàn bảng tự tính lại.',
      'Thấy cảnh báo vật liệu lệch ngưỡng đầu trang → sang Nguyên Liệu xem nên chốt lại không.',
    ],
    related: [
      { tab: 'data-setup', label: 'Thiết Lập — sửa markup VF (mục ⑦ Chính sách giá)' },
      { tab: 'materials', label: 'Nguyên Liệu — cân nhắc chốt lại giá' },
    ],
  },
  planning: {
    question: 'Muốn đạt mức lời mong muốn với kịch bản ca chạy cụ thể — giá bán phải là bao nhiêu? Và nếu các yếu tố ngoài tầm kiểm soát lệch đi thì sao?',
    source: [
      'Tab Trợ Lý CEO: nhập giá nguyên liệu dự kiến, phần lời mong muốn, số ca chạy. Máy tính chạy NGƯỢC từ mục tiêu về giá bán cần thiết — dùng đúng bộ máy tính giá thành của Tổng Quan, không phải công thức riêng.',
      'Tab So Sánh Kịch Bản: đặt 2 bộ giả định (tỷ giá, giá nguyên liệu, sản lượng…) cạnh nhau, gồm cả phân tích độ nhạy (tornado) — yếu tố nào bào lợi nhuận mạnh nhất nếu lệch ±5/10/20%.',
      'Đây là vùng THỬ — không lưu tự động (trừ khi bấm "Áp dụng vào thật" ở Trợ Lý CEO).',
    ],
    action: [
      'Kịch bản nào ưng ý → đối chiếu giá tính ra với Bảng Giá hiện hành trước khi quyết.',
      'Yếu tố đứng đầu tornado là thứ cần canh và phòng hộ trước tiên (khóa tỷ giá, hợp đồng mua dài hạn…).',
    ],
    related: [
      { tab: 'pricing', label: 'Bảng Giá — giá đang niêm yết' },
      { tab: 'materials', label: 'Nguyên Liệu — giá vốn thật để đối chiếu' },
    ],
  },
  assumptions: {
    question: 'Các con số đầu vào theo từng nguyên liệu: giá thị trường, phần lời của nhà máy, ngưỡng khóa giá.',
    source: [
      'Giá tái tạo = giá mua mới hôm nay (USD/kg) — anh cập nhật khi thị trường đổi; đây là gốc của giá thành và mọi mức giá bán.',
      'Markup VF = phần lời của nhà máy cộng trên giá thành đầy đủ — chính là "núm vặn" quyết định mặt bằng Bảng Giá.',
      'Ngưỡng khóa giá = biên độ dao động nguyên liệu cho phép trước khi phải chốt lại giá bán.',
    ],
    action: ['Sửa xong bấm lưu — Tổng Quan, Bảng Giá và mọi màn khác tự tính lại. Mỗi lần đổi ngưỡng/baseline đều được ghi vết lại.'],
    related: [
      { tab: 'pricing', label: 'Bảng Giá — xem hệ quả sau khi sửa' },
      { tab: 'dashboard', label: 'Tổng Quan — KPI tự cập nhật' },
    ],
  },
  config: {
    question: 'Bộ máy sản xuất: máy móc, ca chạy, lương, điện nước, tiền đầu tư — nền của mọi phép tính.',
    source: [
      'Khối Ống và Phụ Kiện tách riêng vì hai công nghệ khác nhau: ống chạy liên tục tính theo kg; phụ kiện ép khuôn tính theo giờ máy.',
      'Các ô có khóa 🔒 là số nền ít khi đổi (đổi là thay đổi lớn về đầu tư/công nghệ) — chỉ tài khoản chủ sửa được.',
    ],
    action: ['Đổi số ca bình thường là cách nhanh nhất thấy tác động của việc tăng/giảm huy động máy — xem lại ở Tổng Quan.'],
    related: [{ tab: 'dashboard', label: 'Tổng Quan — hệ quả sau khi đổi' }],
  },
};

export default function ExplainPanel({ tabId, onNavigate }: { tabId: string; onNavigate: (tab: string) => void }) {
  const [open, setOpen] = useState(false);
  const content = SCREEN_EXPLAINS[tabId];
  if (!content) return null;

  const section = (title: string, body: React.ReactNode) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#999', marginBottom: 6 }}>{title}</div>
      {body}
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Giải thích màn này"
        style={{ position: 'fixed', top: 14, right: 18, zIndex: 40, padding: '7px 14px', background: '#fff', color: '#0a0a0a', border: '1px solid #d8d8d8', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}
      >
        ⓘ Giải thích màn này
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', zIndex: 50 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '90vw', background: '#fff', borderLeft: '1px solid #e5e5e5', boxShadow: '-8px 0 30px rgba(0,0,0,.12)', zIndex: 51, overflowY: 'auto', padding: '22px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{content.question}</div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999', flexShrink: 0, lineHeight: 1 }}>✕</button>
            </div>
            {section('Các con số từ đâu ra', (
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {content.source.map((s, i) => <li key={i} style={{ fontSize: 12, color: '#404040', lineHeight: 1.55, marginBottom: 6 }}>{s}</li>)}
              </ul>
            ))}
            {section('Khi nào cần hành động', (
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {content.action.map((s, i) => <li key={i} style={{ fontSize: 12, color: '#404040', lineHeight: 1.55, marginBottom: 6 }}>{s}</li>)}
              </ul>
            ))}
            {section('Màn liên quan', (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {content.related.map((r) => (
                  <button
                    key={r.tab}
                    onClick={() => { setOpen(false); onNavigate(r.tab); }}
                    style={{ textAlign: 'left', padding: '8px 12px', background: '#f7f7f7', border: '1px solid #e5e5e5', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#0a0a0a', cursor: 'pointer' }}
                  >
                    → {r.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
