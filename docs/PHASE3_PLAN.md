# PHASE3_PLAN.md — Lộ trình Pha 3 (Code), chia milestone nhỏ

> Lý do file này tồn tại: Pha 3 (schema + engine + parity test 372 assertion +
> solver) quá lớn cho 1 phiên/1 lượt gọi. User yêu cầu (2026-07-06) chia nhỏ
> thành nhiều phiên để không tốn tool call và dừng được khi gần hết token. MỖI
> milestone dưới đây phải: (1) tự chứa — code xong + `npm test` xanh + commit,
> (2) không phụ thuộc milestone sau, (3) cập nhật bảng trạng thái này trước khi
> dừng, để phiên sau đọc 1 file này là biết chính xác việc tiếp theo, KHÔNG cần
> đọc lại toàn bộ session log.

## Cách phiên mới bắt đầu
1. Đọc bảng trạng thái bên dưới, tìm milestone đầu tiên chưa `[x]`.
2. Đọc đúng file contract liên quan trong `docs/contracts/*.md` + mục
   `BUSINESS_MODEL.md` được trỏ ở cột "Nguồn công thức".
3. Code milestone đó, viết parity test đối chiếu `tests/fixtures/*.json` (số
   vàng), chạy `npm test` + `npm run typecheck` xanh.
4. Commit, cập nhật bảng trạng thái (đổi `[ ]` → `[x]`, ghi ngày), dừng phiên.
   KHÔNG cần làm nhiều milestone trong 1 phiên trừ khi còn dư budget rõ ràng.

## Bảng trạng thái

| # | Milestone | Nguồn công thức | File chính | Trạng thái |
|---|---|---|---|---|
| M1 | Scaffold (package.json/tsconfig/vitest) + `src/schemas/*.ts` (5 file) + smoke test parse fixture thật | `docs/contracts/*.md` | `src/schemas/` | **[x] 2026-07-06** |
| M2 | Engine Ống — công suất + chi phí SX tại CS bình thường | BUSINESS_MODEL §2.1-2.2 | `src/engine/pipe.ts` | [ ] |
| M3 | Engine Phụ kiện — công suất ép phun + MHR (ADR-001) | BUSINESS_MODEL §3.1-3.3 | `src/engine/fitting.ts` | [ ] |
| M4 | Khấu hao khuôn động theo `asOfYear` (ADR-007) — nuôi vào MHR thay `moldSetCostTotal66` | ADR-007, `resource.md` | `src/engine/mold-depreciation.ts` | [ ] |
| M5 | Giá vốn kép (ADR-002) + khóa bảng giá (ADR-004) — cả compound Ống/Phụ kiện | BUSINESS_MODEL §1a, §5; `price-lock-scenarios.json` (5 kịch bản) | `src/engine/dual-costing.ts`, `src/engine/price-lock.ts` | [ ] |
| M6 | Dòng vật liệu ren kim loại (ADR-008) — giá vốn kép + khóa giá riêng + `materialCostPerUnit` mở rộng cho 11 SKU họ ren | ADR-008, `pricing-chain.md` | `src/engine/metal-insert.ts` | [ ] |
| M7 | Thang giá 5 bậc + chuỗi markup SKU (99 dòng: 8 ống + 91 phụ kiện) | BUSINESS_MODEL §2.3, §3.4, §4 | `src/engine/price-ladder.ts` | [ ] |
| M8 | CVP (Ống theo kg, Phụ kiện quy kg theo mix) | BUSINESS_MODEL §2.4, §3.6 | `src/engine/cvp.ts` | [ ] |
| M9 | Plan_SX (T1 — tầng vận hành, dạng đóng, chưa có số vàng thật) | BUSINESS_MODEL §6; `scenario.md` §3 | `src/engine/plan.ts` | [ ] |
| M10 | Inverse solver (T2 dạng đóng CVP, T3 bisection) + forward-verify bắt buộc | ADR-005/006; skill `inverse-solver`; `scenario.md` §4 | `src/engine/solver.ts` | [ ] |
| M11 | Bộ test parity Excel đầy đủ 372 assertion (gom tất cả M2-M9 lại thành 1 suite hoàn chỉnh, đối chiếu skill `excel-parity-testing`) | Toàn bộ `tests/fixtures/*.json` | `tests/parity/` | [ ] |
| M12 | UI thật (React/TS/Tailwind theo prototype đã duyệt) + nối Firestore theo `scenario.md` §5-6 | `prototype/blazemaster-costing-app.dc.html`, `scenario.md` | `src/features/` | [ ] — CHỈ làm khi user xác nhận mở rộng phạm vi (ngoài "chỉ engine") |

## Ghi chú kỹ thuật xuyên suốt (áp dụng mọi milestone)
- Mọi hàm engine PURE — không I/O, không side-effect (PROJECT_SPEC §3).
- Trước khi migrate `tests/fixtures/metal-insert.json` vào M6: chuẩn hóa
  `thresholdPct` từ số nguyên % (5) sang thập phân (0.05) — xem cảnh báo đầu
  `src/schemas/pricing-chain.ts` và test `schemas.test.ts` đã chứng minh field
  gốc bị Zod từ chối nếu không chuẩn hóa (đây là hàng rào an toàn cố ý).
  `MoldAsset.costVnd` LƯU CỨNG giá trị tại thời điểm mua — không tính lại theo
  tỷ giá hiện hành khi `asOfYear` thay đổi (chỉ ảnh hưởng phần khấu hao còn lại,
  không ảnh hưởng giá trị đã ghi sổ tài sản).
- Bậc 2 và bậc 4 thang giá (M7) THAM CHIẾU CHÉO cả 2 dòng SP — đã có 2 lỗi công
  thức thật ở đây trong prototype Pha 1 (xem session log Phiên 5, 2026-07-05),
  viết test riêng cho đúng 2 điểm này trước khi tin kết quả.
- `npm test` phải xanh trước MỌI commit (CLAUDE.md) — không commit dở dang một
  milestone nếu test đỏ; thà dừng ở milestone trước.

## Việc tiếp theo ngay khi phiên sau vào
→ **M2: `src/engine/pipe.ts`** — đọc `docs/BUSINESS_MODEL.md` §2.1-2.2, viết
hàm tính `normalCapacityKgYear`, `batchesPerYear`, `extruderDepreciationPerYear`,
`fullCostPerKg`, `vfPricePerKg`... nhận `ContinuousKgResource` (từ
`src/schemas/resource.ts`) + `CostPool`, trả về khớp TUYỆT ĐỐI
`tests/fixtures/pipe.json.costAtNormalCapacity` (vd `fullCostPerKg =
106204.729733113`).
