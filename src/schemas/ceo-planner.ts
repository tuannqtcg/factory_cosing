// Pha 2 (ADR-021) — hợp đồng dữ liệu màn "Trợ Lý CEO" (CEO Planner).
// Đóng băng theo prototype đã duyệt Pha 1 (prototype/ceo-planner.html, brief
// 2026-07-15). Màn hỏi→trả lời 3 bước: (1) CEO nhập giá compound + margin mong
// muốn + kịch bản ca chạy; (2) engine trả giá bán VF, thang giá 5 bậc, hiệu quả
// cả năm; (3) callable adviseScenario (ADR-022) tư vấn.
//
// Luật schema-design: Zod trước, type suy ra bằng z.infer; tiền VNĐ number
// nguyên; USD ≤4 số lẻ. KHÔNG optional tràn lan — mỗi optional có ghi chú.
import { z } from 'zod';

/**
 * Cách hiểu margin của CEO (brief mục 1 — chốt qua 7 vòng duyệt):
 * - markup_on_cost: giá bán = giá thành × (1 + m) — MẶC ĐỊNH, khớp Excel v3.4 (25%/40%).
 * - margin_on_price: giá bán = giá thành ÷ (1 − m) — lãi gộp đúng m% trên giá bán.
 */
export const MarginModeSchema = z.enum(['markup_on_cost', 'margin_on_price']);
export type MarginMode = z.infer<typeof MarginModeSchema>;

/** Input chung 1 line (ống hoặc phụ kiện) do CEO nhập ở Bước 1. */
const CeoLineInputBase = z.object({
  // ADR-012: nguyên liệu định danh bằng materialId (KHÔNG dùng enum thương hiệu).
  // UI ràng buộc chọn "1 nơi cho cả 2 line" (brief mục 7) nhưng request vẫn ghi
  // rõ materialId từng line để trung thực với ScenarioInput.materials[].
  materialId: z.string().min(1),
  // Giá compound CIF trước thuế nhập khẩu (USD/kg). CEO nhập kịch bản mua hàng.
  compoundPriceUsdPerKg: z.number().positive(),
  // Markup HOẶC margin theo marginMode (0,25 = 25%). margin_on_price phải <0,95.
  desiredMargin: z.number().min(0).lt(0.95),
  // Số ca chạy/ngày (1–3) — kịch bản huy động công suất.
  normalShifts: z.number().int().min(1).max(3),
});

/** Ống — đùn liên tục, không có huy động giờ máy riêng. */
export const CeoPipeInputSchema = CeoLineInputBase;
export type CeoPipeInput = z.infer<typeof CeoPipeInputSchema>;

/** Phụ kiện — ép phun, thêm % huy động giờ máy ép (0,6 / 0,85…). */
export const CeoFittingInputSchema = CeoLineInputBase.extend({
  machineHourUtilization: z.number().gt(0).max(1),
});
export type CeoFittingInput = z.infer<typeof CeoFittingInputSchema>;

// ADR-042 — thương hiệu THỨ HAI chạy ĐỒNG THỜI trên CÙNG dây chuyền (BM + Corzan
// dùng chung máy đùn/máy ép). KHÔNG có số ca/huy động riêng: dùng chung của line.
// Công suất DÒNG là "cái bánh" chia theo %, KHÔNG nhân đôi.
const CeoSecondBrandInputSchema = z.object({
  materialId: z.string().min(1),
  compoundPriceUsdPerKg: z.number().positive(),
  desiredMargin: z.number().min(0).lt(0.95),
});
export type CeoSecondBrandInput = z.infer<typeof CeoSecondBrandInputSchema>;

export const CeoPlannerRequestSchema = z.object({
  scenarioId: z.string().min(1),
  marginMode: MarginModeSchema,
  fxRateUsdVnd: z.number().positive(),
  // ADR-021 mục "thuê mặt bằng": tiền thuê mặt bằng/năm CEO nhập, THAY phần
  // costPool.sharedFixedCosts.annualLandRent khi engine tính cho màn này (mô
  // hình ĐI THUÊ, đổi được từng năm). Baseline scenario KHÔNG đổi → parity giữ.
  annualPremiseLeaseVnd: z.number().int().nonnegative(),
  pipe: CeoPipeInputSchema,
  fitting: CeoFittingInputSchema,
  // ADR-042 — CHẾ ĐỘ 2 THƯƠNG HIỆU (optional; vắng = chạy 1 loại, parity giữ).
  // *Second có mặt ⇒ chia công suất DÒNG: thương hiệu chính giữ allocation…Pct%,
  // phần còn lại cho thương hiệu thứ hai. Tổng luôn = 100% công suất dòng (2 loại
  // dùng CHUNG máy, không cộng dồn vượt trần).
  pipeSecond: CeoSecondBrandInputSchema.optional(),
  fittingSecond: CeoSecondBrandInputSchema.optional(),
  allocationPipePrimaryPct: z.number().min(0).max(100).optional(),
  allocationFittingPrimaryPct: z.number().min(0).max(100).optional(),
});
export type CeoPlannerRequest = z.infer<typeof CeoPlannerRequestSchema>;

/**
 * Thang giá 5 bậc theo đúng thứ tự price-ladder.ts (bậc 1→5). Đơn vị đ/kg.
 * Quy ước bậc GIỮ NGUYÊN engine hiện có (bậc 2 chưa gồm khấu hao; bậc 4 phân bổ
 * chi phí ngoài SX theo tỷ trọng doanh thu tại giá VF).
 */
export const CeoLadderSchema = z.object({
  variableCostFloor: z.number(), // 1 · sàn biến phí (ranh đỏ)
  cashBreakEven: z.number(), // 2 · hòa vốn tiền mặt (chưa gồm khấu hao)
  fullCost: z.number(), // 3 · giá thành đầy đủ (giá vốn)
  enterpriseBreakEven: z.number(), // 4 · hòa vốn toàn doanh nghiệp
  targetVf: z.number(), // 5 · giá mục tiêu markup chuẩn VF
});
export type CeoLadder = z.infer<typeof CeoLadderSchema>;

/** Kết quả 1 line ở Bước 2 (đúng lineCard prototype). Đơn vị đ/kg trừ khi ghi khác. */
export const CeoLineResultSchema = z.object({
  line: z.enum(['pipe', 'fitting']),
  materialId: z.string(),
  materialName: z.string(),
  sellingPriceVndPerKg: z.number(), // giá bán VF đề xuất = giá thành + markup
  fullCostVndPerKg: z.number(), // giá thành đầy đủ (giá vốn)
  materialCostVndPerKg: z.number(),
  processingCostVndPerKg: z.number(),
  packagingCostVndPerKg: z.number(),
  marginOnPricePct: z.number(), // lãi gộp trên giá bán
  // Chi phí 1 giờ máy ép — CHỈ phụ kiện (ống không có), nên optional có lý do.
  machineHourCostVnd: z.number().optional(),
  ladder: CeoLadderSchema,
  annualProductionKg: z.number(), // sản lượng cả năm tại kịch bản ca
  annualMachineHours: z.number(),
  breakEvenPctOfCapacity: z.number(), // % công suất hòa vốn tại giá này
  annualGrossProfitVnd: z.number(),
  compoundNeedKgPerYear: z.number(), // nhu cầu compound (đã tính hao hụt)
});
export type CeoLineResult = z.infer<typeof CeoLineResultSchema>;

/** Hiệu quả toàn nhà máy cả năm (khối summary tối màu prototype). Đơn vị VNĐ. */
export const CeoFactorySummarySchema = z.object({
  revenueVfVnd: z.number(),
  grossProfitVnd: z.number(), // doanh thu − giá thành sản xuất
  preTaxProfitVnd: z.number(), // lợi nhuận trước thuế (đã trừ vận hành + lãi vay)
  corporateIncomeTaxVnd: z.number(), // thuế TNDN — ƯỚC TÍNH minh họa (brief mục 9)
  netProfitVnd: z.number(),
  preTaxProfitMarginPct: z.number(),
  cashPerYearVnd: z.number(), // dòng tiền = LN trước thuế + khấu hao cộng lại
  // null = dòng tiền ≤ 0 nên không hồi vốn (tránh Infinity không tuần tự hóa được JSON).
  paybackYears: z.number().nullable(),
  totalInvestedVnd: z.number(),
});
export type CeoFactorySummary = z.infer<typeof CeoFactorySummarySchema>;

/** 1 dòng bảng giá ống theo DN (đ/m) — "mang đi đàm phán". */
export const CeoDnPriceRowSchema = z.object({
  dn: z.string(),
  unitWeightKgPerM: z.number(),
  fullCostVndPerM: z.number(),
  sellingPriceVndPerM: z.number(),
});
export type CeoDnPriceRow = z.infer<typeof CeoDnPriceRowSchema>;

/** 1 dòng bảng giá phụ kiện theo cái (đ/cái) — 83 SKU có khuôn (ADR-007/008). */
export const CeoFittingSkuPriceRowSchema = z.object({
  productName: z.string(),
  sizeLabel: z.string(),
  schedule: z.string(),
  unitWeightKg: z.number(),
  metalInsertVndPerPiece: z.number(), // ren kim loại (ADR-008); 0 nếu không có
  fullCostVndPerPiece: z.number(),
  sellingPriceVndPerPiece: z.number(),
});
export type CeoFittingSkuPriceRow = z.infer<typeof CeoFittingSkuPriceRowSchema>;

/** Kết quả đầy đủ Bước 2 (echo request để đối xứng outputs/targetCosting ADR-013). */
export const CeoPlannerResultSchema = z.object({
  request: CeoPlannerRequestSchema,
  pipe: CeoLineResultSchema,
  fitting: CeoLineResultSchema,
  // ADR-042 — thương hiệu thứ hai trên cùng dòng (chỉ có khi chạy 2 loại).
  // annualProductionKg của từng thương hiệu = phần công suất DÒNG được phân bổ.
  pipeSecond: CeoLineResultSchema.optional(),
  fittingSecond: CeoLineResultSchema.optional(),
  summary: CeoFactorySummarySchema,
  pipeDnPrices: z.array(CeoDnPriceRowSchema),
  fittingSkuPrices: z.array(CeoFittingSkuPriceRowSchema),
});
export type CeoPlannerResult = z.infer<typeof CeoPlannerResultSchema>;

// ── AI tư vấn (ADR-022) — callable adviseScenario ────────────────────────────
/**
 * Request tư vấn: CHỈ gửi số liệu OUTPUT đã tính (CeoPlannerResult), KHÔNG gửi
 * ScenarioInput thô — giữ ranh giới dữ liệu (security-review). Server tự đọc
 * scenario nếu cần bối cảnh thêm bằng Admin SDK.
 */
export const CeoAdviceRequestSchema = z.object({
  scenarioId: z.string().min(1),
  plannerResult: CeoPlannerResultSchema,
});
export type CeoAdviceRequest = z.infer<typeof CeoAdviceRequestSchema>;

export const CeoAdviceItemSchema = z.object({
  // Chủ đề nhận định: sàn giá / rủi ro nguyên liệu / tồn kho / thu hồi vốn / bức tranh năm…
  topic: z.string(),
  message: z.string(),
});
export type CeoAdviceItem = z.infer<typeof CeoAdviceItemSchema>;

export const CeoAdviceResultSchema = z.object({
  // Model tạo nhận định (id Claude) — ghi để audit; 'mock' ở bản rule-based.
  generatedByModel: z.string(),
  items: z.array(CeoAdviceItemSchema),
  disclaimer: z.string().optional(), // câu miễn trừ (vd thuế TNDN là ước tính)
});
export type CeoAdviceResult = z.infer<typeof CeoAdviceResultSchema>;
