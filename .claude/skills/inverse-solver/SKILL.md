---
name: inverse-solver
description: Thiết kế và test các tính năng top-down (lợi nhuận mục tiêu, target costing theo giá thị trường, goal-seek biến vận hành) cho Costing App — giải ngược bằng bisection trên forward engine, cấm công thức ngược viết tay. Dùng khi làm bất kỳ màn hình/hàm nào đi từ MỤC TIÊU về NGUỒN LỰC.
---

# Skill: Inverse Solver (top-down)

## Luật
1. KHÔNG BAO GIỜ đảo công thức bằng đại số tay. Mọi inverse = bisection trên
   forward function của engine (một nguồn logic duy nhất — ADR-005).
2. Dạng đóng chỉ được dùng cho T2 (Q hòa vốn có mục tiêu):
   Q = (FC + targetProfit) / contributionMargin — vì nó CHÍNH LÀ forward CVP.
3. solve() bắt buộc: kiểm tra target bị kẹp giữa f(lo) và f(hi); không kẹp
   → trả infeasible + khoảng đạt được [f(lo), f(hi)] để UI nói "mục tiêu này
   không khả thi với nguồn lực hiện có, tối đa đạt X".
4. Kết quả solver LUÔN kèm forward-verify: chạy lại chiều xuôi với nghiệm tìm
   được, hiển thị cả bộ output (giá thành, thang giá, số ca...) — người dùng
   duyệt trên kết quả xuôi, không duyệt trên con số solver trơ trọi.
5. Biến giải ngược hợp lệ v1: utilizationFactor, shifts (nguyên, 1–3),
   compoundPriceUsd, markup từng tầng. Biến nguyên → quét rời rạc, không bisection.

## Test bắt buộc
- Round-trip: |forward(solve(t)) − t| < tol, chạy trên fixture v3.4.
- Case chuẩn T3: "giá niêm yết DN50 mục tiêu 260.000đ/m — huy động phụ kiện
  không đổi, hỏi giá compound tối đa được phép" → nghiệm forward-verify khớp.
- Case infeasible: mục tiêu dưới sàn biến phí → phải trả infeasible kèm lý do
  "thủng bậc 1 thang giá", không trả nghiệm.
