# ADR-005: Hoạch định hai chiều — forward engine + inverse solver
Ngày: 2026-07 | Trạng thái: CHẤP NHẬN

## Bối cảnh — Ý ĐỒ GỐC CỦA ỨNG DỤNG
App không phải "máy tính giá". Nó là công cụ để nhà quản trị HOẠCH ĐỊNH GIÁ và
ĐÁNH GIÁ KẾ HOẠCH GIẢ ĐỊNH dựa trên công suất thực tế / nguồn lực đang có.
Nghĩa là phải chạy được HAI CHIỀU:
- BOTTOM-UP (xuôi): nguồn lực (máy, khuôn, ca, huy động) → công suất → giá thành
  → thang giá → bảng giá. [đã hoàn chỉnh trong Excel v3.4]
- TOP-DOWN (ngược): mục tiêu → yêu cầu vận hành. Ba câu hỏi chuẩn:
  T1. Kế hoạch bán này nguồn lực chịu nổi không? (Plan_SX — đã có, dạng đóng)
  T2. Lợi nhuận mục tiêu P → phải bán bao nhiêu, cần mấy ca?
      Q = (định_phí + P) / lãi_trên_biến_phí  → đối chiếu công suất. (dạng đóng)
  T3. Giá thị trường mục tiêu (đấu với thép/đối thủ) → chi phí mục tiêu
      → biến vận hành nào phải đạt mức nào (huy động? số ca? giá compound đàm phán?).
      KHÔNG có công thức đóng (vd MHR nằm cả tử lẫn mẫu) → cần SOLVER.

## Quyết định
1. Engine chỉ có MỘT bộ logic: pure forward functions (ScenarioInput → ScenarioOutput).
2. Mọi câu hỏi top-down = INVERSE qua numeric solver (bisection) chạy TRÊN CHÍNH
   forward function. CẤM viết công thức ngược bằng tay — hai bộ công thức sẽ lệch nhau.
3. Excel tương đương = Goal Seek thủ công; app tự động hóa → đây là giá trị
   vượt Excel, không phải chép Excel.

## Hệ quả
- Module `src/engine/solver.ts`: solve({ forwardFn, freeVar, target, bounds, tol })
  → { value, residual, iterations } | { infeasible, reason }.
- Giả định đơn điệu trên bounds — solver phải kiểm tra f(lo), f(hi) kẹp target,
  không kẹp → trả "infeasible" kèm khoảng khả thi, KHÔNG trả số bừa.
- Nghiệm thu: round-trip |forward(solve(target)) − target| < tol với fixture v3.4.
