// Nguồn nghiệp vụ: docs/contracts/scenario.md — ADR-005, ADR-006, ADR-007.
// ĐÓNG BĂNG cùng docs/contracts/*.md — sửa cấu trúc field phải có ADR mới.
import { z } from 'zod';
import { ResourceSchema } from './resource.js';
import { ProductSchema } from './product.js';
import { CostPoolSchema } from './cost-pool.js';
import {
  CompoundInventorySchema,
  CompoundPriceLockEvaluationSchema,
  MetalInsertCatalogSchema,
  MetalInsertPriceLockEvaluationSchema,
  PriceLadder5TierSchema,
  SkuPriceChainSchema,
} from './pricing-chain.js';

// ── ScenarioInput — pure input, engine (ScenarioInput) → ScenarioOutput ─────
export const ScenarioInputSchema = z.object({
  id: z.string(),
  asOfYear: z.number().int(), // ADR-007 — mốc thời gian đánh giá khấu hao khuôn động
  resources: z.object({
    pipe: ResourceSchema, // driverType: 'continuous_kg'
    fitting: ResourceSchema, // driverType: 'machine_hour'
  }),
  products: z.array(ProductSchema).min(1),
  costPool: CostPoolSchema,
  inventory: z.object({
    pipe: CompoundInventorySchema,
    fitting: CompoundInventorySchema,
    metalInsert: MetalInsertCatalogSchema, // ADR-008 — theo (renType, ptSize)
  }),
});
export type ScenarioInput = z.infer<typeof ScenarioInputSchema>;

// ── ScenarioOutput — TÍNH RA, không lưu tay ─────────────────────────────────
export const ScenarioOutputSchema = z.object({
  capacity: z.object({
    pipe: z.object({ normalCapacityKgYear: z.number(), batchesPerYear: z.number() }),
    fitting: z.object({ normalMachineHoursUtilized: z.number(), estimatedProductionKgYear: z.number() }),
  }),
  mhrPerMachineHour: z.number(),
  priceLadder: z.object({ pipe: PriceLadder5TierSchema, fitting: PriceLadder5TierSchema }),
  skuPriceChains: z.array(
    z.object({
      productKey: z.object({
        productName: z.string().optional(),
        sizeLabel: z.string().optional(),
        dn: z.string().optional(),
      }),
      managementStatus: z.enum(['active', 'pending_mold']),
      chain: SkuPriceChainSchema,
    }),
  ),
  priceLock: z.object({
    pipe: CompoundPriceLockEvaluationSchema,
    fitting: CompoundPriceLockEvaluationSchema,
    metalInsertByCatalogEntry: z.array(
      z.object({
        renType: z.enum(['trong', 'ngoài']),
        ptSize: z.string(),
        evaluation: MetalInsertPriceLockEvaluationSchema,
      }),
    ),
  }),
  cvp: z.object({
    pipe: z.object({
      variableCostPerKg: z.number(),
      breakEvenKgYear: z.number(),
      pctOfNormalCapacity: z.number(),
    }),
    fitting: z.object({ breakEvenMachineHours: z.number(), pctUtilized: z.number() }),
  }),
  dualCosting: z.object({
    pipe: z.object({
      bookCostPerKg: z.number(),
      holdingGainLossVnd: z.number(),
      provisionWarning: z.string().nullable(),
    }),
    fitting: z.object({
      bookCostPerKg: z.number(),
      holdingGainLossVnd: z.number(),
      provisionWarning: z.string().nullable(),
    }),
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
  pipePlan: z.array(z.object({ dn: z.string(), meters: z.number().nonnegative() })),
  fittingPlan: z.array(
    z.object({ productName: z.string(), sizeLabel: z.string(), qty: z.number().int().nonnegative() }),
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
  materialRequirement: z.object({
    pipe: z.object({ kgToBuy: z.number(), vndValue: z.number(), usdValueAtRawReplacement: z.number() }),
    fitting: z.object({ kgToBuy: z.number(), vndValue: z.number(), usdValueAtRawReplacement: z.number() }),
  }),
  laborToHire: z.object({ pipe: z.number().int().nonnegative(), fitting: z.number().int().nonnegative() }),
  idleCapacityCostPipePerKg: z.number().nullable(),
});
export type PlanResult = z.infer<typeof PlanResultSchema>;

// ── Inverse solver (T2/T3 — tầng CHIẾN LƯỢC, ADR-005/006) ───────────────────
export type SolveParams = {
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
