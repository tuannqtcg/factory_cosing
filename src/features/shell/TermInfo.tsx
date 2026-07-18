// ADR-035 (mở rộng) — chú giải KHÁI NIỆM GIÁ ngay tại chỗ: bấm ⓘ cạnh con số
// là ra modal giải thích bằng ngôn ngữ kinh doanh (giá đề xuất là gì, sàn nào,
// trần ở đâu). Một bộ định nghĩa duy nhất, dùng chung mọi màn — sửa 1 chỗ,
// cả app nói cùng một thứ tiếng.
import { useState } from 'react';

export type PriceTerm = 'suggested-vf' | 'cash-floor' | 'full-cost' | 'locked-floor' | 'market-ceiling';

const TERM_DEFS: Record<PriceTerm, { title: string; body: string[] }> = {
  'suggested-vf': {
    title: 'Vì sao đề xuất mức giá bán này?',
    body: [
      'Giá VF đề xuất = giá thành đầy đủ (nguyên liệu theo giá mua mới + sản xuất + chi phí chung phân bổ) CỘNG phần lời nhà máy tự đặt (markup VF, chỉnh ở màn Tham Số).',
      'Đây là mức "bán từ đây trở lên thì chắc chắn có lãi" — một cái NEO do chi phí quyết định, KHÔNG phải giá thị trường. Thị trường mua được giá cao hơn thì đó là tiền để trên bàn; thị trường chỉ trả thấp hơn thì phải quay lại xem chi phí hoặc phần lời.',
      'Giá này được giữ ỔN ĐỊNH bằng cơ chế khóa: nguyên liệu trôi trong ngưỡng cho phép thì giá không đổi — khách không bị đổi giá liên tục; vượt ngưỡng mới đề nghị chốt lại.',
    ],
  },
  'cash-floor': {
    title: 'Giá sàn tiền tươi là gì?',
    body: [
      'Là tổng chi phí BIẾN ĐỔI cho một đơn vị: tiền nguyên liệu MUA MỚI theo giá thị trường + điện, nước, bao bì — những khoản chi thêm thật sự khi làm thêm một đơn vị.',
      'Bán DƯỚI mức này là mỗi đơn vị bán ra làm công ty mất tiền mặt ngay lập tức, kể cả khi nhà máy đang rảnh. Đây là ĐÁY TUYỆT ĐỐI của mọi cuộc đàm phán — không có lý do nào biện minh được cho giá dưới sàn này.',
      'Vì sao tính nguyên liệu theo giá mua mới dù kho còn hàng? Vì hàng dùng cho đơn này rồi sẽ phải mua bù theo giá hôm nay — giá nhập kho cũ là chuyện đã rồi.',
    ],
  },
  'full-cost': {
    title: 'Giá thành đầy đủ là gì?',
    body: [
      'Là giá sàn tiền tươi CỘNG phần định phí phân bổ: khấu hao máy móc/khuôn, lương bộ máy, chi phí chung — tính khi nhà máy chạy đủ công suất bình thường.',
      'Bán ĐÚNG mức này là hoà vốn thật sự (mọi chi phí đều được bù). Bán TRÊN mức này mới là có lãi thật.',
      'Vùng giữa sàn tiền tươi và giá thành đầy đủ: mỗi đơn vị bán ra vẫn góp tiền bù định phí — CHỈ đáng nhận khi còn công suất trống, và đừng để đơn vùng này chiếm chỗ đơn giá tốt.',
    ],
  },
  'locked-floor': {
    title: 'Sàn theo giá vốn khóa là gì?',
    body: [
      'Là sàn tiền tươi tính theo giá nguyên liệu ĐÃ CHỐT trong bảng giá (baseline khóa), thay vì giá thị trường hôm nay.',
      'Nó chỉ đúng trong MỘT tình huống: đơn làm hoàn toàn bằng hàng tồn kho sẵn có và không phải mua bù. Với đơn mới thông thường, sàn đúng là sàn theo giá thị trường.',
      'Khoảng chênh giữa hai sàn chính là mức lãi/lỗ giữ kho — xem chi tiết ở màn Giá Vốn Theo Lô.',
    ],
  },
  'market-ceiling': {
    title: 'Giá trần nằm ở đâu?',
    body: [
      'Giá trần KHÔNG nằm trong sổ sách — nó là mức cao nhất thị trường chịu trả, do đối thủ và khách quyết định. App không tự biết con số này; nó chỉ biết khi anh cho nó số.',
      'Hai chỗ để đưa giá thị trường vào: màn Quyết Định Nhận Đơn (giá khách chào chính là một mẩu thông tin thị trường) và màn Tối Ưu Product-mix (ô nhập giá thị trường từng dòng — nhập số thật thì kết luận nên dồn lực vào đâu mới đáng tin).',
      'Nguyên tắc điều hành: giá bán thực tế nằm GIỮA giá thành đầy đủ (sàn có lãi) và giá trần thị trường. Khoảng cách hai mức đó chính là dư địa mặc cả của công ty.',
    ],
  },
};

export default function TermInfo({ term, label }: { term: PriceTerm; label?: string }) {
  const [open, setOpen] = useState(false);
  const def = TERM_DEFS[term];
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={def.title}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#a8003b', fontSize: label ? 11 : 12, fontWeight: 600, textDecoration: label ? 'underline' : 'none', lineHeight: 1 }}
      >
        {label ?? 'ⓘ'}
      </button>
      {open && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 60 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, maxWidth: '92vw', maxHeight: '80vh', overflowY: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,.25)', zIndex: 61, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{def.title}</div>
              <button onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999', flexShrink: 0, lineHeight: 1 }}>✕</button>
            </div>
            {def.body.map((p, i) => (
              <p key={i} style={{ fontSize: 12.5, color: '#404040', lineHeight: 1.6, margin: '0 0 10px' }}>{p}</p>
            ))}
          </div>
        </>
      )}
    </>
  );
}
