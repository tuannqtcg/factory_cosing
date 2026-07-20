# ADR-044 — Corzan chuẩn hóa thủ công (bỏ seed/nút append, nút idempotent + kiểm tra)

- **Ngày**: 2026-07-20
- **Trạng thái**: Chấp nhận (user phiên 2026-07-20)
- **Kế thừa**: ADR-012 (Corzan), ADR-007 (khuôn dùng chung)

## Bối cảnh
Corzan sinh ra bằng NHIỀU đường (nút "Bật dòng Corzan" append + seed script + thêm tay) ở nhiều thời điểm → dữ liệu trùng/loạn (vd nhiều "Corzan compound", "CORZAN 3175"). Phụ kiện Corzan không lên Bảng Giá.

## Quyết định
1. **Bỏ nút "Bật dòng Corzan"** (append → sinh trùng) khỏi Danh Mục.
2. **seed-production + seed-emulator về `buildBaselineScenarioInput`** (chỉ BlazeMaster "số vàng") — re-seed KHÔNG tự bơm Corzan. Corzan = nhập tay 100%.
3. **Nút "♻ Chuẩn hóa Corzan" IDEMPOTENT** (admin): XÓA mọi nguyên liệu + SKU Corzan (nhận diện qua id chuẩn HOẶC tên chứa "corzan") → tạo lại đúng 1 bộ `corzan-pipe`/`corzan-fitting` + mirror toàn bộ SKU từ BlazeMaster (ống ×1,1 đơn trọng; phụ kiện giống hệt → dùng chung khuôn → tự active). Bấm nhiều lần ra 1 kết quả. Có confirm.
4. **Nút "🔎 Kiểm tra dữ liệu bảng giá"**: chạy `calculateScenario` tại chỗ trên form, phân biệt 3 nguyên nhân bảng giá thiếu: (a) dữ liệu lỗi/engine ném → bảng giá không cập nhật; (b) 0 SKU active → thiếu khuôn; (c) có SKU active nhưng bảng giá thật trống → máy chủ chưa tính lại (→ dẫn tới ADR-045).

## Hệ quả
Một nguồn sự thật duy nhất cho Corzan = thao tác tay trong app (chuẩn hóa + Tham Số + Danh Mục). Không auto-generate rải rác.
