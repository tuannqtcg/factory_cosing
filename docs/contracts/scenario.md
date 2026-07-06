# Contract: Scenario (src/schemas/scenario.ts) — hợp đồng tổng + Firestore + phân quyền

> Pha 2 — ĐÓNG BĂNG sau khi user duyệt. Sửa cấu trúc field ở đây bắt buộc phải có
> ADR mới (AGENTS.md luật #5). Đây là file GẮN KẾT 4 contract kia
> (`resource.md`, `product.md`, `cost-pool.md`, `pricing-chain.md`) + toàn bộ
> quyết định phân vai (ADR-005, ADR-006) + kiến trúc Firestore (PROJECT_SPEC §3, §5).

## 1. ScenarioInput — pure input, engine `(ScenarioInput) → ScenarioOutput`

```ts
import { z } from 'zod';
import { ResourceSchema } from './resource';
import { ProductSchema } from './product';
import { CostPoolSchema } from './cost-pool';
import {
  CompoundInventorySchema, MetalInsertCatalogSchema,
} from './pricing-chain';

export const ScenarioInputSchema = z.object({
  id: z.string(),
  asOfYear: z.number().int(), // ADR-007 — mốc thời gian đánh giá khấu hao khuôn động
  resources: z.object({
    pipe: ResourceSchema,     // driverType: 'continuous_kg'
    fitting: ResourceSchema,  // driverType: 'machine_hour'
  }),
  products: z.array(ProductSchema).min(1),
  costPool: CostPoolSchema,
  inventory: z.object({
    pipe: CompoundInventorySchema,
    fitting: CompoundInventorySchema,
    metalInsert: MetalInsertCatalogSchema, // ADR-008 — 10 dòng theo (renType, ptSize)
  }),
});
export type ScenarioInput = z.infer<typeof ScenarioInputSchema>;
```

`ScenarioInput` = TOÀN BỘ dữ liệu 1 phiên bản kịch bản (config nhà máy + master
data SKU + tồn kho). Đây là doc DUY NHẤT admin/pricing chỉnh sửa; mọi thứ khác
(giá thành, thang giá, MHR, CVP...) là `ScenarioOutput` TÍNH RA, không lưu tay.

## 2. ScenarioOutput — TÍNH RA, không lưu tay, engine pure function

```ts
import { PriceLadder5TierSchema, SkuPriceChainSchema,
         CompoundPriceLockEvaluationSchema, MetalInsertPriceLockEvaluationSchema } from './pricing-chain';

export const ScenarioOutputSchema = z.object({
  capacity: z.object({
    pipe: z.object({ normalCapacityKgYear: z.number(), batchesPerYear: z.number() }),
    fitting: z.object({ normalMachineHoursUtilized: z.number(), estimatedProductionKgYear: z.number() }),
  }),
  mhrPerMachineHour: z.number(), // ADR-001 + ADR-007 — phụ thuộc asOfYear
  priceLadder: z.object({ pipe: PriceLadder5TierSchema, fitting: PriceLadder5TierSchema }),
  skuPriceChains: z.array(z.object({
    productKey: z.object({ productName: z.string().optional(), sizeLabel: z.string().optional(), dn: z.string().optional() }),
    managementStatus: z.enum(['active', 'pending_mold']), // fitting only; pipe luôn 'active'
    chain: SkuPriceChainSchema,
  })),
  priceLock: z.object({
    pipe: CompoundPriceLockEvaluationSchema,
    fitting: CompoundPriceLockEvaluationSchema,
    metalInsertByCatalogEntry: z.array(z.object({
      renType: z.enum(['trong', 'ngoài']), ptSize: z.string(),
      evaluation: MetalInsertPriceLockEvaluationSchema,
    })),
  }),
  cvp: z.object({
    pipe: z.object({ variableCostPerKg: z.number(), breakEvenKgYear: z.number(), pctOfNormalCapacity: z.number() }),
    fitting: z.object({ breakEvenMachineHours: z.number(), pctUtilized: z.number() }),
  }),
  dualCosting: z.object({
    pipe: z.object({ bookCostPerKg: z.number(), holdingGainLossVnd: z.number(), provisionWarning: z.string().nullable() }),
    fitting: z.object({ bookCostPerKg: z.number(), holdingGainLossVnd: z.number(), provisionWarning: z.string().nullable() }),
    metalInsert: z.array(z.object({
      renType: z.enum(['trong', 'ngoài']), ptSize: z.string(),
      holdingGainLossVnd: z.number(), provisionWarning: z.string().nullable(),
    })),
  }),
});
export type ScenarioOutput = z.infer<typeof ScenarioOutputSchema>;
```

## 3. Plan_SX (T1 — tầng VẬN HÀNH, ADR-005/006, BUSINESS_MODEL.md §6)

```ts
export const PlanInputSchema = z.object({
  scenarioId: z.string(),
  period: z.string(),        // "2026-Q3" — theo kỳ kế hoạch
  pipePlan: z.array(z.object({ dn: z.string(), meters: z.number().nonnegative() })),
  fittingPlan: z.array(z.object({ productName: z.string(), sizeLabel: z.string(), qty: z.number().int().nonnegative() })),
  materialSafetyStockFactor: z.number().min(0), // hệ số dự phòng NVL, BUSINESS_MODEL §6.4
});
export type PlanInput = z.infer<typeof PlanInputSchema>;

export const PlanResultSchema = z.object({
  shiftsNeeded: z.object({
    pipe: z.union([z.literal(1), z.literal(2), z.literal(3), z.object({ status: z.literal('insufficient'), extraMachinesNeeded: z.number().int() })]),
    fitting: z.union([z.literal(1), z.literal(2), z.literal(3), z.object({ status: z.literal('insufficient'), extraMachinesNeeded: z.number().int() })]),
  }),
  moldConstraintWarnings: z.array(z.object({ // ràng buộc khuôn theo size — CHỈ Phụ kiện
    sizeDN: z.number().int(), requiredMachineHours: z.number(), availableMachineHours: z.number(), extraMoldSetsNeeded: z.number().int(),
  })),
  materialRequirement: z.object({
    pipe: z.object({ kgToBuy: z.number(), vndValue: z.number(), usdValueAtRawReplacement: z.number() }), // dùng replacementUsd THÔ, không qua price lock (BUSINESS_MODEL §6.4)
    fitting: z.object({ kgToBuy: z.number(), vndValue: z.number(), usdValueAtRawReplacement: z.number() }),
  }),
  laborToHire: z.object({ pipe: z.number().int().nonnegative(), fitting: z.number().int().nonnegative() }),
  idleCapacityCostPipePerKg: z.number().nullable(), // chỉ Ống — BUSINESS_MODEL §6.6
});
export type PlanResult = z.infer<typeof PlanResultSchema>;
```

`PlanResult` là forward function thuần túy (dạng đóng, không cần solver) — đây
CHÍNH LÀ T1 trong ADR-005 ("kế hoạch có khả thi với nguồn lực hiện có?").

## 4. Inverse Solver (T2/T3 — tầng CHIẾN LƯỢC, ADR-005/006, skill `inverse-solver`)

```ts
export type SolveParams = {
  forwardFn: (input: ScenarioInput) => ScenarioOutput;
  freeVarPath: string;          // vd "resources.fitting.normalUtilizationFactor" — biến hợp lệ v1: xem skill inverse-solver
  targetSelector: (output: ScenarioOutput) => number; // đọc field cần đạt, vd output => output.priceLadder.fitting.breakEvenFullCost
  target: number;
  bounds: [number, number];
  tol: number;
};

export type SolveResult =
  | { feasible: true; value: number; residual: number; iterations: number; forwardOutput: ScenarioOutput }
  | { feasible: false; reason: string; achievableRange: [number, number] };
```

Luật bắt buộc (skill `inverse-solver`, KHÔNG lặp lại ở đây — chỉ trỏ nguồn):
KHÔNG viết công thức ngược tay; luôn forward-verify; biến nguyên (shifts) quét
rời rạc; T2 dùng dạng đóng `Q = (FC+targetProfit)/contributionMargin` vì đó
CHÍNH LÀ forward CVP, không phải ngoại lệ của luật cấm.

```ts
// T2 — dạng đóng, KHÔNG qua solver (đúng skill inverse-solver mục 2)
export const TargetProfitRequestSchema = z.object({
  scenarioId: z.string(), productLine: z.enum(['pipe', 'fitting']), targetProfitVnd: z.number().int(),
});
export const TargetProfitResultSchema = z.object({
  requiredQtyKgOrMachineHours: z.number(), requiredShifts: z.number(), feasibleWithinNormalCapacity: z.boolean(),
});

// T3 — qua solver, kèm giá thâm nhập (penetration price) như 1 trường hợp con
export const TargetPriceRequestSchema = z.object({
  scenarioId: z.string(), productLine: z.enum(['pipe', 'fitting']),
  targetListPriceVnd: z.number().int(), freeVarPath: z.string(),
  isPenetrationPrice: z.boolean(), // true = giá bị ép từ thị trường/đấu thầu (ADR-006), chỉ khác NGUỒN GỐC mục tiêu, dùng chung cơ chế
});
export const TargetPriceResultSchema = z.union([
  z.object({ feasible: z.literal(true), value: z.number(), forwardOutput: ScenarioOutputSchema }),
  z.object({ feasible: z.literal(false), reason: z.string(), achievableRange: z.tuple([z.number(), z.number()]) }),
]);
```

## 5. Firestore doc split + phân quyền theo vai (PROJECT_SPEC §3, §5; ADR-006)

Nguyên tắc bắt buộc: **rules không lọc field trong 1 doc — tách hẳn DOC** cho
mỗi tầng đọc, vì Firestore security rules không thể ẩn field trong cùng 1 doc.

| Collection / doc path | Nội dung | Ghi | Đọc |
|---|---|---|---|
| `scenarios/{id}` | `ScenarioInput` đầy đủ (Resource, Product, CostPool, Inventory) | `admin` toàn bộ; `pricing` các field KHÔNG nằm trong danh sách khóa (`resource.md`/`cost-pool.md` đã liệt kê) | `admin`, `pricing` |
| `scenarios/{id}/outputs/internal` | `ScenarioOutput` đầy đủ — ghi bởi Cloud Function (Admin SDK) sau mỗi lần `scenarios/{id}` đổi, KHÔNG client ghi trực tiếp | Cloud Function only | `admin`, `pricing` |
| `scenarios/{id}/outputs/priceList` | Chỉ `skuPriceChains[].chain` (4 field cuối: vfPrice/tcgPrice/listPrice±VAT) + `priceLadder` — KHÔNG có `materialCostPerUnit`/`breakEvenPerUnit`/tồn kho | Cloud Function only | `admin`, `pricing`, **`sales`** |
| `scenarios/{id}/outputs/plan` | `PlanResult` (T1) — tầng VẬN HÀNH | Cloud Function tính; `production` ghi `PlanInput` ở doc riêng `scenarios/{id}/planInputs/{period}` | `admin`, `pricing`, `production` |
| `scenarios/{id}/outputs/targetCosting` | Kết quả T2/T3 (bao gồm giá thâm nhập) — tầng CHIẾN LƯỢC | Cloud Function tính từ request `pricing`/`admin` | `admin`, `pricing` — **`production` KHÔNG đọc được** (ADR-006) |
| `scenarios/{id}/moldAssets/{moldId}` | 1 `MoldAsset` — tách collection con để audit log riêng khi mua khuôn mới (sự kiện hiếm, cần lịch sử) | `admin` only | `admin`, `pricing` (đọc để biết công suất, không sửa) |

**Vì sao tách `outputs/internal` khỏi `outputs/priceList`**: `sales` cần đọc
bảng giá bán (VF/TCG/list/VAT) để chào giá nhưng KHÔNG BAO GIỜ được thấy
`materialCostPerUnit`/tồn kho/giá vốn (luật bất biến PROJECT_SPEC §5). Nếu gộp
1 doc rồi "lọc field ở rule" — Firestore rules không hỗ trợ lọc field khi trả
document, chỉ có thể cho/từ chối toàn bộ doc — nên bắt buộc tách doc vật lý.

**Vì sao Cloud Function ghi `outputs/*` thay vì client tính**: Engine
(`src/engine`) là pure function KHÔNG I/O, nhưng nếu chạy trong browser của
`sales` thì toàn bộ `ScenarioInput` (gồm giá vốn) phải tải xuống client trước
khi tính — vi phạm "sales không đọc được cost" ngay ở tầng network. Do đó biên
dịch/tính toán chạy phía server (Cloud Function, có Admin SDK đọc
`scenarios/{id}` đầy đủ), rồi ghi kết quả đã tách theo tầng vào các doc con.
`src/engine` vẫn là bộ pure function DÙNG CHUNG — chạy trong Cloud Function
lẫn khi test parity Excel, không phải 2 bản logic khác nhau.

## 6. Bảng phân quyền tổng hợp (4 vai × 6 vùng dữ liệu)

| Vùng dữ liệu | admin | pricing | sales | production |
|---|---|---|---|---|
| `ScenarioInput` — field khóa (resource.md/cost-pool.md) | Đọc+Ghi | Đọc | ✗ | ✗ |
| `ScenarioInput` — field không khóa (markup, currency) | Đọc+Ghi | Đọc+Ghi | ✗ | ✗ |
| `outputs/internal` (giá vốn đầy đủ) | Đọc | Đọc | ✗ | ✗ |
| `outputs/priceList` (giá bán) | Đọc | Đọc | Đọc | ✗ |
| `outputs/plan` (T1 vận hành) | Đọc | Đọc | ✗ | Đọc+Ghi input |
| `outputs/targetCosting` (T2/T3 chiến lược) | Đọc+Ghi request | Đọc+Ghi request | ✗ | ✗ |
| `moldAssets` | Đọc+Ghi | Đọc | ✗ | ✗ |

Khớp đúng prototype Pha 1 hiện tại (`ROLE_DEFS`, `adminOnlyFields`,
`EXCLUDED_SKUS` filter tại UI) — bảng trên là bản CHÍNH THỨC thay thế filter
phía client bằng Firestore rules + tách doc thật ở Pha 3.

## Còn treo sang Pha 3
- Chuẩn hóa `thresholdPct` trong `metal-insert.json` từ số nguyên % → thập phân
  trước khi migrate (xem cảnh báo ở `pricing-chain.md`).
- Viết Cloud Function trigger tính `ScenarioOutput` + ghi 4 doc con — chưa có
  code, đây là hợp đồng/thiết kế Pha 2.
- Custom claim `role` trên Firebase Auth user — cơ chế cấp/thu hồi role chưa
  thiết kế (ngoài phạm vi Pha 2 schema, thuộc security-review Pha 4).
