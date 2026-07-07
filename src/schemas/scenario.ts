// Nguồn nghiệp vụ: docs/contracts/scenario.md — ADR-005, ADR-006, ADR-007.
// ĐÓNG BĂNG cùng docs/contracts/*.md — sửa cấu trúc field phải có ADR mới.
import { z } from 'zod';
import { ResourceSchema } from './resource.js';
import { ProductSchema } from './product.js';
import { CostPoolSchema } from './cost-pool.js';
import { MaterialSchema } from './material.js';
import {
  CompoundPriceLockEvaluationSchema,
  MetalInsertCatalogSchema,
  MetalInsertPriceLockEvaluationSchema,
  PriceLadder5TierSchema,
  SkuPriceChainSchema,
} from './pricing-chain.js';

// ── ScenarioInput — pure input, engine (ScenarioInput) → ScenarioOutput ─────
// Sửa 2026-07-07 (ADR-012, contract material.md): thêm `materials[]`; BỎ
// `inventory.pipe|fitting` (tồn kho compound nằm TRONG từng Material);
// `inventory.metalInsert` giữ nguyên (ADR-008 độc lập với Material).
export const ScenarioInputSchema = z
  .object({
    id: z.string(),
    asOfYear: z.number().int(), // ADR-007 — mốc thời gian đánh giá khấu hao khuôn động
    resources: z.object({
      pipe: ResourceSchema, // driverType: 'continuous_kg'
      fitting: ResourceSchema, // driverType: 'machine_hour'
    }),
    materials: z.array(MaterialSchema).min(1), // ADR-012 — thứ tự có ý nghĩa: material ĐẦU TIÊN mà mỗi dòng SX dùng = material THAM CHIẾU của dòng đó (xem scenario engine)
    products: z.array(ProductSchema).min(1),
    costPool: CostPoolSchema,
    inventory: z.object({
      metalInsert: MetalInsertCatalogSchema, // ADR-008 — theo (renType, ptSize)
    }),
  })
  .superRefine((input, ctx) => {
    // materialId của mọi product phải tồn tại trong materials[] (contract material.md)
    const ids = new Set(input.materials.map((m) => m.id));
    input.products.forEach((p, i) => {
      if (!ids.has(p.materialId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['products', i, 'materialId'],
          message: `materialId "${p.materialId}" không có trong materials[]`,
        });
      }
    });
  });
export type ScenarioInput = z.infer<typeof ScenarioInputSchema>;

// ── ScenarioOutput — TÍNH RA, không lưu tay ─────────────────────────────────
// Sửa 2026-07-07 (ADR-012): các nhóm theo dòng SX cố định (`pipe|fitting`) đổi
// thành theo CẶP (line, materialId) hoặc theo materialId — mỗi nguyên liệu có
// khóa giá/kho/thang giá riêng. `capacity` + `mhrPerMachineHour` giữ nguyên
// (chung line, chung MHR — ADR-012 #3). CVP giữ đúng bộ field cũ từng line
// (code review PR #1), chỉ thêm khóa line/materialId.
const PipeCvpOutputSchema = z.object({
  line: z.literal('pipe'),
  materialId: z.string(),
  variableCostPerKg: z.number(),
  contributionMarginPerKg: z.number(),
  fixedCostPerYear: z.number(),
  breakEvenKgYear: z.number(),
  pctOfNormalCapacity: z.number(),
});
const FittingCvpOutputSchema = z.object({
  line: z.literal('fitting'),
  materialId: z.string(),
  variableCostPerKg: z.number(),
  contributionMarginPerKg: z.number(),
  fixedCostPerYear: z.number(),
  breakEvenKgYear: z.number(),
  breakEvenMachineHours: z.number(),
  pctOfUtilizedHours: z.number(),
});

export const ScenarioOutputSchema = z.object({
  capacity: z.object({
    pipe: z.object({ normalCapacityKgYear: z.number(), batchesPerYear: z.number() }),
    fitting: z.object({ normalMachineHoursUtilized: z.number(), estimatedProductionKgYear: z.number() }),
  }),
  mhrPerMachineHour: z.number(), // material-independent (ADR-012 #3) — tính tại material tham chiếu của line fitting
  priceLadder: z.object({
    byLineMaterial: z.array(
      z.object({
        line: z.enum(['pipe', 'fitting']),
        materialId: z.string(),
        ladder: PriceLadder5TierSchema,
      }),
    ),
  }),
  skuPriceChains: z.array(
    z.object({
      productKey: z.object({
        productName: z.string().optional(),
        sizeLabel: z.string().optional(),
        dn: z.string().optional(),
        materialId: z.string(), // ADR-012 — (productName,sizeLabel) có thể trùng giữa BlazeMaster/Corzan (cùng khuôn, khác compound)
      }),
      managementStatus: z.enum(['active', 'pending_mold']),
      chain: SkuPriceChainSchema,
    }),
  ),
  priceLock: z.object({
    byMaterial: z.array(
      z.object({ materialId: z.string(), evaluation: CompoundPriceLockEvaluationSchema }),
    ),
    metalInsertByCatalogEntry: z.array(
      z.object({
        renType: z.enum(['trong', 'ngoài']),
        ptSize: z.string(),
        evaluation: MetalInsertPriceLockEvaluationSchema,
      }),
    ),
  }),
  cvp: z.object({
    byLineMaterial: z.array(z.discriminatedUnion('line', [PipeCvpOutputSchema, FittingCvpOutputSchema])),
  }),
  dualCosting: z.object({
    // Entry theo CẶP (line, materialId) vì bookCostPerKg cần chi phí gia công
    // của line; holdingGainLossVnd thuộc MATERIAL (tồn kho không tách line) —
    // nếu 1 material dùng cho cả 2 line, giá trị holdingGainLoss lặp lại ở 2
    // entry (đọc theo materialId, đừng cộng dồn qua line).
    byMaterial: z.array(
      z.object({
        materialId: z.string(),
        line: z.enum(['pipe', 'fitting']),
        bookCostPerKg: z.number(),
        holdingGainLossVnd: z.number(),
        provisionWarning: z.string().nullable(),
      }),
    ),
    metalInsert: z.array(
      z.object({
        renType: z.enum(['trong', 'ngoài']),
        ptSize: z.string(),
        holdingGainLossVnd: z.number(),
        provisionWarning: z.string().nullable(),
      }),
    ),
  }),
});
export type ScenarioOutput = z.infer<typeof ScenarioOutputSchema>;

// ── Plan_SX (T1 — tầng VẬN HÀNH, ADR-005/006) ───────────────────────────────
const InsufficientCapacity = z.object({
  status: z.literal('insufficient'),
  extraMachinesNeeded: z.number().int(),
});
const ShiftsNeeded = z.union([z.literal(1), z.literal(2), z.literal(3), InsufficientCapacity]);

export const PlanInputSchema = z.object({
  scenarioId: z.string(),
  period: z.string(),
  // Sửa 2026-07-06 (Pha 3 M9, khi viết src/engine/plan.ts) — bổ sung 2 field bị
  // SÓT ở bản đóng băng đầu: BUSINESS_MODEL §6.2/§6.5 luôn cần "hệ số kỳ" và
  // "nhân công hiện có" để đánh giá ca máy/nhân công cần tuyển. KHÔNG suy ra
  // được từ chuỗi `period` (vd "2026-Q3") một cách an toàn — phải là input rõ
  // ràng. Ghi nhận đầy đủ ở ADR-009 (docs/decisions/).
  periodMonths: z.number().positive(),
  currentLaborHeadcount: z.object({
    pipe: z.number().int().nonnegative(),
    fitting: z.number().int().nonnegative(),
  }),
  // Sửa 2026-07-07 (ADR-012): thêm `materialId` optional — (dn) và (productName,
  // sizeLabel) KHÔNG còn là khóa duy nhất khi BlazeMaster/Corzan trùng tên/size
  // (cùng khuôn, khác compound). Bỏ trống = khớp SP ĐẦU TIÊN trùng khóa theo thứ
  // tự products[] (sau migration = BlazeMaster) — giữ tương thích plan cũ.
  pipePlan: z.array(
    z.object({ dn: z.string(), meters: z.number().nonnegative(), materialId: z.string().optional() }),
  ),
  fittingPlan: z.array(
    z.object({
      productName: z.string(),
      sizeLabel: z.string(),
      qty: z.number().int().nonnegative(),
      materialId: z.string().optional(),
    }),
  ),
  materialSafetyStockFactor: z.number().min(0),
});
export type PlanInput = z.infer<typeof PlanInputSchema>;

export const PlanResultSchema = z.object({
  shiftsNeeded: z.object({ pipe: ShiftsNeeded, fitting: ShiftsNeeded }),
  moldConstraintWarnings: z.array(
    z.object({
      sizeDN: z.number().int(),
      requiredMachineHours: z.number(),
      availableMachineHours: z.number(),
      extraMoldSetsNeeded: z.number().int(),
    }),
  ),
  // Sửa 2026-07-07 (ADR-012): tách theo materialId thay vì pipe|fitting cố định
  // — kế hoạch mua NVL/ngoại tệ (LC) đặt theo NGUYÊN LIỆU; vẫn dùng replacement
  // THÔ từng material, không qua khóa giá (ADR-004 §1a).
  materialRequirement: z.array(
    z.object({
      materialId: z.string(),
      kgToBuy: z.number(),
      vndValue: z.number(),
      usdValueAtRawReplacement: z.number(),
    }),
  ),
  laborToHire: z.object({ pipe: z.number().int().nonnegative(), fitting: z.number().int().nonnegative() }),
  idleCapacityCostPipePerKg: z.number().nullable(),
});
export type PlanResult = z.infer<typeof PlanResultSchema>;

// ── Inverse solver (T2/T3 — tầng CHIẾN LƯỢC, ADR-005/006) ───────────────────
// Bổ sung `baseInput` 2026-07-06 (Pha 3 M10, src/engine/solver.ts) — thiếu sót
// ở bản đóng băng: forwardFn nhận (input: ScenarioInput) nhưng không có input
// gốc nào để solve() clone rồi set giá trị dò vào theo freeVarPath. Xem
// ADR-009 (bảng bổ sung field, dòng #4).
export type SolveParams = {
  baseInput: ScenarioInput;
  forwardFn: (input: ScenarioInput) => ScenarioOutput;
  freeVarPath: string;
  targetSelector: (output: ScenarioOutput) => number;
  target: number;
  bounds: [number, number];
  tol: number;
};

export type SolveResult =
  | { feasible: true; value: number; residual: number; iterations: number; forwardOutput: ScenarioOutput }
  | { feasible: false; reason: string; achievableRange: [number, number] };

// T2 — dạng đóng (Q = (FC+targetProfit)/contributionMargin CHÍNH LÀ forward CVP,
// không phải ngoại lệ của luật cấm công thức ngược — skill inverse-solver mục 2).
export const TargetProfitRequestSchema = z.object({
  scenarioId: z.string(),
  productLine: z.enum(['pipe', 'fitting']),
  targetProfitVnd: z.number().int(),
});
export type TargetProfitRequest = z.infer<typeof TargetProfitRequestSchema>;

export const TargetProfitResultSchema = z.object({
  requiredQtyKgOrMachineHours: z.number(),
  requiredShifts: z.number(),
  feasibleWithinNormalCapacity: z.boolean(),
});
export type TargetProfitResult = z.infer<typeof TargetProfitResultSchema>;

// T3 — qua solver; giá thâm nhập (penetration price) là 1 trường hợp con,
// khác NGUỒN GỐC mục tiêu, dùng chung cơ chế (ADR-006).
export const TargetPriceRequestSchema = z.object({
  scenarioId: z.string(),
  productLine: z.enum(['pipe', 'fitting']),
  targetListPriceVnd: z.number().int(),
  freeVarPath: z.string(),
  isPenetrationPrice: z.boolean(),
});
export type TargetPriceRequest = z.infer<typeof TargetPriceRequestSchema>;

export const TargetPriceResultSchema = z.union([
  z.object({ feasible: z.literal(true), value: z.number(), forwardOutput: ScenarioOutputSchema }),
  z.object({
    feasible: z.literal(false),
    reason: z.string(),
    achievableRange: z.tuple([z.number(), z.number()]),
  }),
]);
export type TargetPriceResult = z.infer<typeof TargetPriceResultSchema>;
