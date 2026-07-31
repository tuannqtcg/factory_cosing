// ADR-059 — trang Trợ Giúp: gom giải thích từng màn + toàn bộ thuật ngữ về 1 chỗ,
// ghim cuối sidebar (1 click từ bất kỳ đâu) — thay vì rải rác từng nút ⓘ (TermInfo)
// và ExplainPanel theo từng màn. Thuần tĩnh, không đọc scenario/Firebase.
import { useState } from 'react';

interface Entry {
  id: string;
  title: string;
  question: string;
  body: string[];
  keywords: string;
}

const SCREEN_ENTRIES: Entry[] = [
  {
    id: 'tong-quan',
    title: 'Tổng Quan',
    question: 'Nhà máy đang thế nào, hôm nay có gì cần quyết định?',
    body: [
      'Chỉ xem, không sửa được gì ở đây — mọi số tự tính từ dữ liệu đã lưu (Thiết Lập). Gồm thang giá 5 bậc, hiệu quả theo công suất, kết quả kinh doanh (P&L) cả năm, và so sánh giá vốn Baseline vs Bình quân gia quyền.',
      'Muốn đổi số gốc (nguyên liệu, chi phí, tài sản...) thì qua Thiết Lập — Tổng Quan sẽ tự tính lại theo.',
    ],
    keywords: 'tổng quan dashboard ebit p&l lợi nhuận thang giá công suất',
  },
  {
    id: 'nguyen-lieu',
    title: 'Nguyên Liệu',
    question: 'Nguyên liệu đang tốn bao nhiêu tiền, có cần chốt lại giá bán không?',
    body: [
      'Danh sách các compound (BlazeMaster, Corzan, Ống, Phụ kiện...) — bấm 1 dòng mở panel chi tiết.',
      '3 con số cần phân biệt: Baseline (mốc neo giá bán, admin/pricing tự đặt) · Giá mua mới hôm nay (thị trường hiện hành, dùng để so lệch với Baseline) · Bình quân gia quyền (giá vốn sổ sách thật, tính từ các lô đã nhập — landed cost gồm thuế nhập khẩu + phí hải quan/logistics, có thể khác nhau TỪNG lô nếu xuất xứ khác nhau).',
      'Bấm vào 1 lô trong panel để mở panel con xem/sửa đúng lô đó (số lượng kg, giá USD/kg, thuế/phí riêng). Nút "Chốt baseline = giá hôm nay" xuất hiện ngay trong panel khi nguyên liệu đang MỞ KHÓA.',
      'Thao tác hiếm (thêm nguyên liệu mới, quản lý ren kim loại mua ngoài) nằm ở "Quản lý nâng cao" cuối trang.',
    ],
    keywords: 'giá vốn nguyên liệu lô tồn kho bình quân gia quyền landed cost thuế chốt baseline',
  },
  {
    id: 'bang-gia',
    title: 'Bảng Giá',
    question: 'Đang niêm yết giá bao nhiêu, và nếu tính theo giá vốn thật thì lãi khác bao nhiêu?',
    body: [
      'Giá VF = giá xuất xưởng, tầng giá duy nhất nhà máy tự quyết. Giá TCG và giá niêm yết NPP là suy tiếp tự động theo chính sách phân phối, không chốt tay.',
      '2 cột "Giá VF BQGQ" và "Chênh lệch" trong danh sách so sánh giá đang bán với giá vốn tính theo bình quân gia quyền thực nhập kho — dương nghĩa là còn dư địa biên lợi nhuận, âm nghĩa là giá bán đang thấp hơn giá vốn thực tế.',
      'Bấm 1 dòng SKU để mở panel "Giá này từ đâu ra?" — truy nguyên từng bậc giá (nguyên liệu → chế biến → giá thành đầy đủ → phần lời → giá VF).',
    ],
    keywords: 'bảng giá vf tcg npp phân phối vat bqgq chênh lệch',
  },
  {
    id: 'ke-hoach',
    title: 'Kịch Bản & Hoạch Định',
    question: 'Nếu đổi số ca, đổi giá nguyên liệu, hay giả định thị trường xấu — lợi nhuận thay đổi bao nhiêu?',
    body: [
      '2 tab: "Trợ Lý CEO" (thử kịch bản ca/biên → xem lợi nhuận, có thể "Áp dụng vào thật") và "So Sánh Kịch Bản" (đặt 2 kịch bản cạnh nhau + phân tích độ nhạy tornado).',
      'Đây là vùng THỬ — không lưu tự động (trừ khi bấm "Áp dụng vào thật"). Rời màn hoặc F5 là mất, không đụng dữ liệu gốc.',
    ],
    keywords: 'trợ lý ceo so sánh kịch bản độ nhạy tornado what-if',
  },
  {
    id: 'thiet-lap',
    title: 'Thiết Lập',
    question: 'Sửa dữ liệu gốc ở đâu?',
    body: [
      'Nơi NHẬP LIỆU duy nhất: tài sản cố định, chi phí chế biến, chi phí chung, nguyên liệu (lô + thuế/phí), danh mục sản phẩm (SKU), tham số tài chính, chính sách giá/markup.',
      'Đổi ở đây rồi bấm Lưu → ghi dữ liệu gốc → mọi màn Theo dõi/Thử tính lại theo.',
    ],
    keywords: 'thiết lập dữ liệu tài sản chi phí danh mục sản phẩm markup',
  },
];

const TERM_ENTRIES: Entry[] = [
  {
    id: 'thang-gia',
    title: 'Thang giá 5 bậc',
    question: 'Bán ở mức giá nào thì vẫn an toàn, mức nào là có lãi thật?',
    body: [
      '① Sàn biến phí — ranh đỏ tuyệt đối, bán dưới mức này là mất tiền mặt ngay.',
      '② Hòa vốn tiền mặt — chưa gồm khấu hao, phòng thủ khi thị trường xấu.',
      '③ Giá thành đầy đủ — bù hết mọi chi phí kể cả khấu hao, hòa vốn thật.',
      '④ Hòa vốn toàn DN — gồm cả chi phí ngoài sản xuất + lãi vay.',
      '⑤ Giá mục tiêu (VF) — giá chào chuẩn, đã cộng phần lời nhà máy.',
    ],
    keywords: 'thang giá 5 bậc sàn biến phí hòa vốn tiền mặt giá thành đầy đủ hòa vốn toàn dn giá mục tiêu',
  },
  {
    id: 'baseline',
    title: 'Baseline & cơ chế khóa giá',
    question: 'Vì sao giá bán không nhảy theo từng biến động giá nguyên liệu?',
    body: [
      'Baseline là mốc neo giá nguyên liệu (USD/kg) dùng để tính Giá VF — lệch trong ngưỡng cho phép (vd ±3%) so với giá mua mới hôm nay thì giữ nguyên giá bán (KHÓA); lệch vượt ngưỡng thì hệ thống tự chuyển sang tính theo giá thị trường (MỞ KHÓA) — đây là tín hiệu cần chốt lại giá.',
      'Baseline KHÔNG phải giá vốn thực đã trả — giá vốn thực là bình quân gia quyền (xem màn Nguyên Liệu).',
    ],
    keywords: 'baseline khóa giá ngưỡng mở khóa staleness cảnh báo',
  },
  {
    id: 'glossary',
    title: 'Toàn bộ thuật ngữ',
    question: 'Tra nhanh — mỗi dòng là 1 khái niệm dùng xuyên suốt app.',
    body: [
      'Giá mua mới hôm nay: giá thị trường nếu mua ngay bây giờ. Cập nhật tay khi có báo giá mới.',
      'Bình quân gia quyền: giá vốn sổ sách = trung bình có trọng số các lô đã nhập, theo kg và giá từng lô.',
      'Landed cost: giá vốn đã gồm thuế nhập khẩu + phí hải quan/logistics — có thể khác nhau từng lô nếu xuất xứ khác.',
      'Lãi/lỗ giữ kho: chênh lệch giữa giá mua mới hôm nay và bình quân gia quyền, nhân với tồn kho hiện có.',
      'Đơn giá giờ máy (MHR): chi phí cố định phân bổ theo giờ máy chạy, dùng cho dòng Phụ kiện (ép phun).',
      'Công suất bình thường: mức sản lượng chuẩn theo TT200 dùng làm mẫu số phân bổ định phí.',
      'Trạng thái khóa (KHÓA/MỞ KHÓA): KHÓA = giá bán giữ nguyên theo Baseline. MỞ KHÓA = giá nguyên liệu lệch quá ngưỡng, giá bán đã chuyển sang tính theo giá mua mới hôm nay.',
      'Top-down / giải ngược: nhập lợi nhuận hoặc giá bán MONG MUỐN, app tính ngược ra nguồn lực cần (giá nguyên liệu tối đa, sản lượng cần...).',
      'Khuôn (tài sản): 1 bộ khuôn ép, khấu hao riêng theo năm mua — 1 SKU chưa có khuôn thì tạm ẩn khỏi Bảng Giá.',
      'Ren kim loại mua ngoài: vật tư đồng thau lắp ép vào phụ kiện ren — quản lý tồn kho riêng theo (loại ren, cỡ PT), khác cấp SKU nhựa.',
    ],
    keywords: 'thuật ngữ glossary tất cả',
  },
];

const ALL: Entry[] = [...SCREEN_ENTRIES, ...TERM_ENTRIES];

export default function HelpScreen() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = (e: Entry) => !q || (e.keywords + ' ' + e.title + ' ' + e.body.join(' ')).toLowerCase().includes(q);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#737373', marginBottom: 5 }}>Trợ Giúp</div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.3px' }}>Giải thích màn hình &amp; thuật ngữ</h1>
        <div style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>Gom nội dung giải thích ⓘ và mỗi màn về 1 chỗ — dùng ô tìm bên dưới để tra nhanh.</div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm thuật ngữ hoặc tên màn — ví dụ: baseline, sàn biến phí, giá thành đầy đủ…"
        style={{ width: '100%', padding: '9px 13px', border: '1px solid #d8d8d8', borderRadius: 4, fontSize: 13, outline: 'none', marginBottom: 22, background: '#fff' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 26 }}>
        <div style={{ position: 'sticky', top: 20, alignSelf: 'start' }}>
          {ALL.map((e) => (
            <a
              key={e.id}
              href={`#help-${e.id}`}
              style={{ display: 'block', textDecoration: 'none', color: '#737373', fontSize: 12, padding: '6px 10px', borderRadius: 4, opacity: matches(e) ? 1 : 0.35 }}
            >
              {e.title}
            </a>
          ))}
        </div>

        <div>
          {SCREEN_ENTRIES.filter(matches).length + TERM_ENTRIES.filter(matches).length === 0 && (
            <div style={{ fontSize: 12, color: '#999', padding: '20px 0' }}>Không tìm thấy mục nào khớp "{query}".</div>
          )}
          {ALL.filter(matches).map((e) => (
            <div key={e.id} id={`help-${e.id}`} style={{ background: '#fff', border: '1px solid #d8d8d8', borderRadius: 6, padding: '18px 20px', marginBottom: 14, scrollMarginTop: 20 }}>
              <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{e.title}</h4>
              <div style={{ fontSize: 11.5, color: '#a8003b', fontWeight: 600, marginTop: 3 }}>{e.question}</div>
              {e.body.map((p, i) => (
                <p key={i} style={{ fontSize: 12.5, color: '#404040', lineHeight: 1.6, margin: '10px 0 0' }}>{p}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
