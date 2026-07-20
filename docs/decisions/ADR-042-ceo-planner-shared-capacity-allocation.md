# ADR-042 — CEO Planner: chạy 2 thương hiệu đồng thời, phân bổ công suất CHUNG máy

- **Ngày**: 2026-07-20
- **Trạng thái**: Chấp nhận (user chỉ ra lỗi mô hình phiên 2026-07-20)
- **Kế thừa**: ADR-021 (CEO Planner), ADR-012 (multi-material)

## Bối cảnh
Mô hình cũ giả định cả nhà máy chạy 1 thương hiệu ở max công suất → không diễn tả được BlazeMaster + Corzan chạy CÙNG LÚC (dùng chung 1 máy đùn, 2 máy ép, ngày ≤3 ca). Nếu cộng dồn 2 loại ở full → vượt trần vật lý (double-count).

## Quyết định
1. **Chế độ 1 — phân bổ công suất cố định**: chọn "1 loại (full máy)" hoặc "2 loại (chung máy)". Khi 2 loại: công suất DÒNG là "cái bánh" chia theo % (tổng = 100%, KHÔNG cộng dồn). Thương hiệu thứ hai (`pipeSecond`/`fittingSecond` trong CeoPlannerRequest, optional) + `allocation{Pipe,Fitting}PrimaryPct`.
2. **Chứng minh parity-safe**: vì định phí đã nằm trong giá thành/kg và tổng sản lượng 2 thương hiệu = đúng công suất dòng, phép cộng lãi gộp TỰ ĐÚNG định phí (không nhân đôi/bỏ sót). Vắng thương hiệu thứ hai ⇒ chạy 1 loại ⇒ giữ nguyên số vàng.
3. **Nút "Gợi ý tối ưu"**: dồn 100% về compound có biên đóng góp/kg (giá bán − sàn biến phí) cao hơn (nghiệm góc với công suất fungible).
4. Test `ceo-planner-allocation`: bảo toàn công suất, alloc 100% = chạy 1 loại, tuyến tính theo phân bổ.

## Còn treo
Chế độ 2 (mục tiêu sản lượng → cần thêm máy + CAPEX + payback) — phiên sau. Kèm vá `calculatePipeCapacity` nhân `extruderCount`.
