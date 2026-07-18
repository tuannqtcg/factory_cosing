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
      'Số hoàn vốn hay lợi nhuận nhìn xấu đi → vào Độ Nhạy xem yếu tố nào đang bào mòn mạnh nhất.',
      'Muốn thử "chạy thêm ca / đổi biên lời thì sao" → mở Trợ Lý CEO.',
    ],
    related: [
      { tab: 'sensitivity', label: 'Độ Nhạy — điều gì bào lợi nhuận mạnh nhất' },
      { tab: 'ceo-planner', label: 'Trợ Lý CEO — thử kịch bản ca/biên lời' },
    ],
  },
  'order-acceptance': {
    question: 'Khách chào một đơn giá X — nhận thì lãi hay lỗ, và nên nhận không?',
    source: [
      'Nhập đơn đúng cách khách đặt: NHIỀU dòng sản phẩm trong một đơn (ống và phụ kiện, BlazeMaster lẫn Corzan), mỗi dòng số mét/cái + giá chào theo mét/cái — máy tự quy về kg bằng đơn trọng danh mục, tính sàn theo đúng nguyên liệu từng dòng.',
      'Kết luận có 2 tầng: từng dòng (dòng nào đang kéo cả đơn xuống thì mặc cả đúng dòng đó) và cả đơn (cộng tổng mọi dòng).',
      'Giá chào của khách được so với 2 mức sàn. Sàn thứ nhất — "sàn tiền tươi": tiền nguyên liệu MUA MỚI theo giá thị trường + chi phí biến đổi. Bán dưới mức này là mất tiền mặt ngay lập tức.',
      'Sàn thứ hai — giá thành đầy đủ (đã gánh cả khấu hao, lương, chi phí chung). Trên mức này là đơn có lãi thật.',
      'Vì sao tính theo giá mua MỚI dù kho còn hàng? Vì nguyên liệu dùng cho đơn này rồi sẽ phải mua bù theo giá hiện tại — giá nhập kho cũ là chuyện đã rồi, lãi/lỗ của kho được tách riêng ở màn Giá Vốn Theo Lô, không được phép làm nhiễu quyết định nhận đơn.',
    ],
    action: [
      'Kết luận CÂN NHẮC → chỉ nhận khi còn công suất trống, và đừng để đơn giá thấp chiếm chỗ đơn giá tốt.',
      'Chỉnh thử ngưỡng khóa giá ở đây chỉ là THỬ — muốn áp dụng chính thức phải sang Tham Số.',
    ],
    related: [
      { tab: 'lot-costing', label: 'Giá Vốn Theo Lô — kho đang lãi/lỗ giữ bao nhiêu' },
      { tab: 'assumptions', label: 'Tham Số — đổi ngưỡng khóa giá chính thức' },
    ],
  },
  'lot-costing': {
    question: 'Các lô nguyên liệu trong kho giá khác nhau — đang lãi hay lỗ giữ kho, và có cần chốt lại giá bán không?',
    source: [
      'Mỗi nguyên liệu một thẻ: các lô đang tồn với giá nhập từng lô → giá bình quân của kho, đặt cạnh giá mua mới hôm nay (giá thị trường).',
      'Kho rẻ hơn thị trường = đang lãi giữ kho; kho đắt hơn = đang lỗ giữ kho, và kế toán buộc phải trích lập dự phòng giảm giá (chuẩn mực VAS-02) ngay cả khi chưa bán.',
      'Giá bán chính thức luôn tính theo giá mua mới, giữ ổn định bằng cơ chế khóa: chỉ khi giá thị trường lệch quá ngưỡng cho phép mới đề nghị chốt lại.',
    ],
    action: [
      'Thấy cảnh báo vượt ngưỡng → bấm nút chuyển sang Bảng Giá để chốt lại giá bán.',
      'Lô hàng mới về hoặc số liệu lô sai → bấm "Cập nhật lô hàng" ngay trên màn này.',
    ],
    related: [
      { tab: 'pricing', label: 'Bảng Giá — chốt lại giá bán' },
      { tab: 'order-acceptance', label: 'Quyết Định Nhận Đơn — đơn đang chào có ổn không' },
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
      'Muốn tăng/giảm mặt bằng giá → sửa "phần lời của nhà máy" (markup VF) ở Tham Số, giá toàn bảng tự tính lại.',
      'Thấy cảnh báo vật liệu lệch ngưỡng đầu trang → sang Giá Vốn Theo Lô xem nên chốt lại không.',
    ],
    related: [
      { tab: 'assumptions', label: 'Tham Số — sửa phần lời (markup VF)' },
      { tab: 'lot-costing', label: 'Giá Vốn Theo Lô — cân nhắc chốt lại giá' },
    ],
  },
  'ceo-planner': {
    question: 'Muốn đạt mức lời mong muốn với kịch bản ca chạy cụ thể — giá bán phải là bao nhiêu, lợi nhuận và thu hồi vốn ra sao?',
    source: [
      'Anh nhập: giá nguyên liệu dự kiến, phần lời mong muốn, số ca chạy. Máy tính chạy NGƯỢC từ mục tiêu về giá bán cần thiết — dùng đúng bộ máy tính giá thành của Tổng Quan, không phải công thức riêng.',
      'Phần tư vấn chữ là gợi ý tham khảo, không thay quyết định của anh.',
    ],
    action: ['Kịch bản nào ưng ý → đối chiếu giá tính ra với Bảng Giá hiện hành trước khi quyết.'],
    related: [
      { tab: 'pricing', label: 'Bảng Giá — giá đang niêm yết' },
      { tab: 'scenario-compare', label: 'So Sánh Kịch Bản — đặt các phương án cạnh nhau' },
    ],
  },
  sensitivity: {
    question: 'Trong các yếu tố ngoài tầm kiểm soát (tỷ giá, giá hạt nhựa, lương, điện…), cái nào bào lợi nhuận mạnh nhất nếu lệch đi?',
    source: [
      'Giữ nguyên giá bán, cho từng yếu tố lệch ±5/10/20% rồi đo lợi nhuận đổi bao nhiêu. Thanh càng dài = rủi ro càng lớn.',
      'Tỷ giá USD và giá hạt nhựa thường đứng đầu vì nguyên liệu định giá bằng USD.',
    ],
    action: [
      'Yếu tố đứng đầu là thứ cần canh và phòng hộ trước tiên (khóa tỷ giá, hợp đồng mua dài hạn…).',
      'Muốn thấy bức tranh đầy đủ khi nhiều yếu tố xấu cùng lúc → dựng kịch bản ở So Sánh Kịch Bản.',
    ],
    related: [{ tab: 'scenario-compare', label: 'So Sánh Kịch Bản — dựng kịch bản xấu/tốt' }],
  },
  'scenario-compare': {
    question: 'Nếu mọi thứ xấu đi / tốt lên cùng lúc thì lợi nhuận năm ra sao — đặt các phương án cạnh nhau?',
    source: ['Mỗi kịch bản là một bộ giả định (tỷ giá, giá nguyên liệu, sản lượng…). Cùng một máy tính giá thành chạy cho từng bộ, kết quả đặt cạnh nhau.'],
    action: ['Kịch bản xấu vẫn sống được → yên tâm mở rộng; kịch bản xấu lỗ nặng → chuẩn bị phương án phòng hộ từ giờ.'],
    related: [{ tab: 'sensitivity', label: 'Độ Nhạy — yếu tố nào đáng đưa vào kịch bản' }],
  },
  'product-mix': {
    question: 'Máy móc và vốn có hạn — nên dồn lực sản xuất dòng nào để tổng lời cao nhất?',
    source: [
      'So các dòng sản phẩm theo tiền lời góp về trên mỗi đơn vị nguồn lực khan hiếm: mỗi kg nguyên liệu, mỗi giờ máy, mỗi đồng vốn.',
      'Có tính đến giá thị trường thực tế từng dòng — dòng biên cao chưa chắc thắng nếu thị trường không mua ở giá đó.',
    ],
    action: ['Kết quả chỉ đổi khi anh nhập giá thị trường thật của từng dòng — số này càng sát, kết luận càng đáng tin.'],
    related: [{ tab: 'order-acceptance', label: 'Quyết Định Nhận Đơn — áp dụng cho một đơn cụ thể' }],
  },
  products: {
    question: 'Danh mục sản phẩm gốc: tên, tiêu chuẩn, kích thước, đơn trọng, và khuôn nào sản xuất SKU nào.',
    source: [
      'Đây là dữ liệu gốc nuôi Bảng Giá: đơn trọng quyết định giá mỗi mét/cái; chu kỳ ép + số lòng khuôn quyết định chi phí giờ máy của phụ kiện.',
      'Phụ kiện chỉ LÊN BẢNG GIÁ khi đã gán khuôn — SKU chưa có khuôn ở trạng thái "chờ khuôn" và tự ẩn. Nhiều SKU dùng chung một khuôn là bình thường (cùng khuôn, khác nguyên liệu compound).',
      'Mỗi cặp (kích cỡ, nguyên liệu) chỉ khai một dòng — hệ thống tự chặn khai trùng.',
      'Chỉ vai Toàn Quyền lưu được thay đổi danh mục; vai Định Giá xem để đối chiếu.',
    ],
    action: [
      'Sản phẩm mới: bấm "+ Thêm" → khai tiêu chuẩn, kích thước, đơn trọng, nguyên liệu → gán khuôn (dùng chung hoặc chờ khuôn mới) → Lưu. Bảng Giá tự tính và hiện SKU mới.',
      'Mua khuôn mới: khai tài sản khuôn ở Cấu Hình Nhà Máy (khấu hao tự vào giá thành).',
    ],
    related: [
      { tab: 'pricing', label: 'Bảng Giá — xem SKU mới sau khi lưu' },
      { tab: 'config', label: 'Cấu Hình Nhà Máy — tài sản khuôn' },
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
