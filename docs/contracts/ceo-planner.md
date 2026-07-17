# Contract — Trợ Lý CEO (CEO Planner) + AI tư vấn

Trạng thái: ĐÓNG BĂNG (Pha 2, 2026-07-16 — ADR-021, ADR-022). Sửa phải có ADR mới.
Schema nguồn: `src/schemas/ceo-planner.ts`. Prototype đã duyệt: `prototype/ceo-planner.html`.

## 1. Màn hình & luồng
Màn tầng chiến lược trong view CEO (ADR-020). 3 bước dọc:
1. **Nhập** — `CeoPlannerRequest`: dòng nguyên liệu (materialId, đồng bộ 2 line ở
   UI), giá compound USD/kg, margin mong muốn + `marginMode`, số ca, % huy động
   giờ máy (phụ kiện), tỷ giá, thuê mặt bằng/năm.
2. **Trả lời** — `CeoPlannerResult`: giá bán VF từng line + thang giá 5 bậc +
   hiệu quả cả năm + bảng giá DN (ống) + 83 SKU (phụ kiện).
3. **AI tư vấn** — callable `adviseScenario` (`CeoAdviceRequest` → `CeoAdviceResult`).

## 2. Endpoints
| Chức năng | Kiểu | Nơi tính | Ghi chú |
|---|---|---|---|
| Tính planner (Bước 2) | Engine pure client-side | `src/engine/ceo-planner.ts` (Pha 3) | admin/pricing đọc trọn ScenarioInput → chạy tại client, KHÔNG callable (ADR-021 §4) |
| AI tư vấn (Bước 3) | HTTPS Callable `adviseScenario` | `functions/src/index.ts` (Pha 3) | gọi Claude API server-side, key qua Secret (ADR-022) |

KHÔNG có doc Firestore mới cho kết quả planner (tính tại client, không ghi ra).
Chỉ `adviseScenario` ghi `scenarios/{id}/adviceAudit/{autoId}` (dấu vết, không nội dung).

## 3. Schema (tóm tắt — nguồn chân lý là file .ts)
- `CeoPlannerRequestSchema` { scenarioId, marginMode, fxRateUsdVnd,
  annualPremiseLeaseVnd, pipe: CeoPipeInput, fitting: CeoFittingInput }
- `CeoPipeInput` { materialId, compoundPriceUsdPerKg, desiredMargin<0.95, normalShifts 1–3 }
- `CeoFittingInput` = CeoPipeInput + { machineHourUtilization (0,1] }
- `CeoPlannerResultSchema` { request, pipe, fitting: CeoLineResult, summary:
  CeoFactorySummary, pipeDnPrices[], fittingSkuPrices[] }
- `CeoLineResult` { line, materialId/Name, sellingPriceVndPerKg, fullCostVndPerKg,
  material/processing/packaging perKg, marginOnPricePct, machineHourCostVnd?,
  ladder: CeoLadder(5 bậc), annualProductionKg, annualMachineHours,
  breakEvenPctOfCapacity, annualGrossProfitVnd, compoundNeedKgPerYear }
- `CeoFactorySummary` { revenueVfVnd, grossProfitVnd, preTaxProfitVnd,
  corporateIncomeTaxVnd, netProfitVnd, preTaxProfitMarginPct, cashPerYearVnd,
  paybackYears(nullable), totalInvestedVnd }
- `CeoAdviceRequestSchema` { scenarioId, plannerResult } → chỉ gửi OUTPUT đã tính.
- `CeoAdviceResultSchema` { generatedByModel, items[{topic,message}], disclaimer? }

## 4. Phân quyền theo vai
| Vai | Planner (xem/chạy) | adviseScenario |
|---|---|---|
| admin | ✅ | ✅ |
| pricing | ✅ | ✅ |
| sales | ❌ (dữ liệu giá thành/đầu tư — ADR-006) | ❌ |
| production | ❌ | ❌ |

Sau ADR-020 (một view CEO = vai admin), thực tế người dùng vào là admin → thấy đủ.
Backend vẫn kiểm role ở callable (không tin client).

## 5. Ràng buộc khi code (Pha 3/4)
- Thay MỌI công thức nhúng prototype bằng `src/engine/*` — cấm chép tay (brief).
- `annualPremiseLeaseVnd` thay `annualLandRent` khi tính, KHÔNG sửa baseline (ADR-021 §3).
- Thang giá đúng `price-ladder.ts`; quét bậc ca giữ phân bổ chi phí chung tại công
  suất chuẩn (khớp `capacityTiers`/`mhrByCapacityTier`).
- Parity Pha 4 (preset "Chuẩn Excel v3.4", thuê 525 triệu): ống 132.898,6 · phụ
  kiện 252.845,8 đ/kg · LN trước thuế 16,37 tỷ · payback 0,816 năm.
- Thuế TNDN **20% — user xác nhận 2026-07-16** (giải tỏa treo brief mục 9); đọc từ 1 hằng số có tên rõ.
