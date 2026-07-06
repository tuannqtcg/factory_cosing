# Contract: Resource (src/schemas/resource.ts)

> Pha 2 — ĐÓNG BĂNG sau khi user duyệt. Sửa cấu trúc field ở đây bắt buộc phải có
> ADR mới (AGENTS.md luật #5), không sửa tùy tiện khi code Pha 3.
> Nguồn nghiệp vụ: ADR-001 (cost driver), ADR-003 (driver là plugin), ADR-007
> (khấu hao khuôn theo thời điểm mua).
>
> **Sửa 2026-07-06 (Pha 3 M2, khi viết `src/engine/pipe.ts`)**: bổ sung 12 field
> bị SÓT ở bản đóng băng đầu (lương/điện/nước/bao bì — `packagingCostPerKg`,
> `avgSalaryMonthly`, `monthsSalaryPerYear`, `electricityKw(PerMachineHour)`,
> `electricityPricePerKwh`, `waterM3Per(Machine)Hour`, `waterPricePerM3`, và
> `avgProductivityKgPerMachineHour` cho Phụ kiện, `depreciationYears` cho máy ép
> Phụ kiện) — đây là SỬA LỖI THIẾU SÓT khi dịch ADR-001 sang schema (công thức
> chi phí gia công §2.2/§3.3 BUSINESS_MODEL luôn cần các field này). Ghi nhận
> đầy đủ ở ADR-009 (docs/decisions/) — theo code review PR #1, MỌI lần sửa cấu
> trúc field ở đây đều cần ghi vào ADR-009 (hoặc ADR riêng nếu đủ lớn), kể cả
> khi được đánh giá là "chỉ sửa thiếu sót".

## Nguyên tắc

`Resource` là nguồn lực sản xuất (máy + khuôn), tách theo `driverType` —
discriminated union để thêm driver mới (labor_hour, batch — ADR-003) không đụng
vào 2 driver hiện có. Ống dùng `continuous_kg` (đùn liên tục); Phụ kiện dùng
`machine_hour` (ép phun rời rạc theo khuôn).

## Schema

```ts
import { z } from 'zod';

// ── Dùng chung ──────────────────────────────────────────────────────────────
const YieldRate = z.number().min(0).max(1); // tỷ lệ SP đạt chuẩn, vd 0.9

// ── MoldAsset (ADR-007) ─────────────────────────────────────────────────────
// Thay `moldSetCostTotal66` dạng scalar cũ. Mỗi khuôn/lô khuôn mua cùng đợt là
// 1 asset độc lập, khấu hao theo NĂM MUA riêng — cho phép MHR tự đổi khi mua
// thêm khuôn mà không cần sửa công thức.
export const MoldAssetSchema = z.object({
  id: z.string(),
  label: z.string(), // tên khuôn, vd "Cút 90°"
  producesSkus: z.array(z.object({
    productName: z.string(), // khớp Product.productName
    sizeLabel: z.string(),   // khớp Product.sizeLabel
  })).min(1), // 1 khuôn có thể ra NHIỀU SKU (vd 1 khuôn → Nối thẳng + Nắp bịt + 3 Nối giảm)
  cavity: z.number().int().positive(),
  costUsd: z.number().nonnegative(),
  costVnd: z.number().int().nonnegative(), // = costUsd × usdVndRate tại thời điểm mua — LƯU CỨNG, không tính lại theo tỷ giá hiện hành (giá vốn tài sản cố định, không phải giao dịch ngoại tệ đang mở)
  purchaseYear: z.number().int(),
  usefulLifeYears: z.number().int().positive(),
  // ⚠ Sửa 2026-07-06 (code review PR #1): comment cũ ghi "ghi đè nếu có" nhưng
  // src/engine/fitting.ts (M3) CHƯA implement override này — engine hiện dùng
  // thẳng `annualMoldMaintenance` (1 số tổng duy nhất, đúng khớp Excel/BUSINESS_MODEL
  // §3.3, đã verify parity) cho MỌI khuôn, bỏ qua field này hoàn toàn. Lý do
  // CHƯA sửa formula: annualMoldMaintenance là 1 TỔNG duy nhất từ Excel (không
  // decompose theo từng khuôn) — "override" 1 khuôn cụ thể đòi hỏi biết phần
  // tổng đó vốn thuộc về khuôn nào, dữ liệu này KHÔNG có. Cần quyết định nghiệp
  // vụ (annualMoldMaintenance có tính thêm/thay khuôn override hay không) TRƯỚC
  // khi sửa công thức — hiện field này coi như CHƯA CÓ TÁC DỤNG, giữ trong
  // schema để dành chỗ, không xóa.
  maintenancePerYearVnd: z.number().int().nonnegative().optional(),
  source: z.string().optional(), // optional: đường dẫn/tên chứng từ gốc (hợp đồng, PDF) — không bắt buộc cho khuôn nhập tay sau này
});
export type MoldAsset = z.infer<typeof MoldAssetSchema>;

// KHÔNG có trường hợp "SKU chưa có khuôn nhưng vẫn có MoldAsset với cost=null".
// Quy ước: SKU không xuất hiện trong `producesSkus` của bất kỳ MoldAsset nào
// → `managementStatus = 'pending_mold'` (xem product.md) — KHÔNG model bằng
// field rỗng trên MoldAsset (tránh 2 cách biểu diễn cùng 1 sự thật).

// ── Resource: continuous_kg (Ống) ────────────────────────────────────────────
export const ContinuousKgResourceSchema = z.object({
  driverType: z.literal('continuous_kg'),
  maxCapacityKgPerHour: z.number().positive(),      // extruderMaxCapacityKgPerHour
  actualCapacityKgPerHour: z.number().positive(),   // extruderActualCapacityKgPerHour — admin-only ở UI hiện tại
  continuousRunDaysPerBatch: z.number().int().positive(),
  maintenanceDaysPerBatch: z.number().int().nonnegative(),
  operatingDaysPerYear: z.number().int().positive(),
  hoursPerShift: z.number().positive(),
  normalShifts: z.number().int().min(1).max(3),
  yieldRate: YieldRate,
  packagingCostPerKg: z.number().int().nonnegative(),
  extruderPriceEach: z.number().int().nonnegative(), // machinePrice — admin-only
  extruderCount: z.number().int().positive(),        // machineCount — admin-only
  moldPullerCutterCost: z.number().int().nonnegative(), // toolingMold — admin-only; 1 hằng số duy nhất (không time-phased như MoldAsset — ống không thay khuôn theo SKU)
  depreciationYears: z.number().int().positive(),
  annualMaintenance: z.number().int().nonnegative(),
  peoplePerShift: z.number().int().nonnegative(),
  avgSalaryMonthly: z.number().int().nonnegative(),
  monthsSalaryPerYear: z.number().positive(),
  electricityKw: z.number().positive(),
  electricityPricePerKwh: z.number().int().nonnegative(),
  waterM3PerHour: z.number().nonnegative(),
  waterPricePerM3: z.number().int().nonnegative(),
});
export type ContinuousKgResource = z.infer<typeof ContinuousKgResourceSchema>;

// ── Resource: machine_hour (Phụ kiện) ────────────────────────────────────────
export const MachineHourResourceSchema = z.object({
  driverType: z.literal('machine_hour'),
  machineTypes: z.array(z.object({
    id: z.string(),           // "A" | "B" — khớp machineTypeAPrice/BPrice cũ
    priceVnd: z.number().int().nonnegative(), // admin-only ở UI
    count: z.number().int().positive(),       // admin-only ở UI
  })).min(1),
  moldAssets: z.array(MoldAssetSchema), // THAY moldSetCostTotal66 — xem ADR-007
  continuousRunDaysPerBatch: z.number().int().positive(),
  maintenanceDaysPerBatch: z.number().int().nonnegative(),
  operatingDaysPerYear: z.number().int().positive(),
  hoursPerShift: z.number().positive(),
  normalShifts: z.number().int().min(1).max(3),
  normalUtilizationFactor: z.number().min(0).max(1), // hệ số huy động, vd 0.6
  yieldRate: YieldRate,
  packagingCostPerKg: z.number().int().nonnegative(),
  avgProductivityKgPerMachineHour: z.number().positive(), // quy đổi giờ máy → kg tại công suất tham chiếu
  depreciationYears: z.number().int().positive(), // khấu hao MÁY ép — tách khỏi MoldAsset.usefulLifeYears (khấu hao KHUÔN, ADR-007)
  annualMoldMaintenance: z.number().int().nonnegative(), // mức chung — MoldAsset.maintenancePerYearVnd ghi đè nếu có
  peoplePerShift: z.number().int().nonnegative(),
  avgSalaryMonthly: z.number().int().nonnegative(),
  monthsSalaryPerYear: z.number().positive(),
  electricityKwPerMachineHour: z.number().positive(),
  electricityPricePerKwh: z.number().int().nonnegative(),
  waterM3PerMachineHour: z.number().nonnegative(),
  waterPricePerM3: z.number().int().nonnegative(),
});
export type MachineHourResource = z.infer<typeof MachineHourResourceSchema>;

export const ResourceSchema = z.discriminatedUnion('driverType', [
  ContinuousKgResourceSchema,
  MachineHourResourceSchema,
]);
export type Resource = z.infer<typeof ResourceSchema>;
```

## Output tính ra (KHÔNG lưu, thuộc ScenarioOutput — xem scenario.md)
- `machineMoldDepreciationPerYear` (ADR-007): `Σ asset.costVnd / asset.usefulLifeYears`
  cho mọi asset còn trong thời gian khấu hao tại `asOfYear` (asset hết khấu hao →
  đóng góp 0, KHÔNG loại khỏi tổng — vẫn dùng sản xuất).
- `mhrPerMachineHour` (ADR-001): tổng chi phí gia công năm ÷ giờ máy huy động —
  phụ thuộc `machineMoldDepreciationPerYear` nên tự đổi theo `asOfYear`.
- Với `continuous_kg`: `extruderDepreciationPerYear = extruderPriceEach × extruderCount / depreciationYears` (không time-phased — 1 lần đầu tư, không có khái niệm mua thêm theo SKU).

## Khóa tham số theo vai (đối chiếu prototype)
Các field sau chỉ `admin` được ghi (Firestore rule field-level, không phải chỉ
ẩn UI như prototype Pha 1 hiện tại):
`actualCapacityKgPerHour`, `extruderPriceEach`, `extruderCount`, `moldPullerCutterCost`,
`yieldRate` (cả 2 driver), `machineTypes[].priceVnd`, `machineTypes[].count`,
`moldAssets` (thêm/sửa khuôn — sự kiện hiếm, luôn admin).
Xem phân quyền đầy đủ ở `scenario.md`.
