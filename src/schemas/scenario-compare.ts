// ADR-028 — hợp đồng dữ liệu màn "So Sánh Kịch Bản". CEO đặt tên vài kịch bản (mỗi
// kịch bản = bộ hệ số driver), xem EBIT/doanh thu/biên song song vs cơ sở. Kết quả
// thuần từ engine giá-bán-cố-định (scenario-drivers.ts) — xem engine/scenario-compare.ts.
import { z } from 'zod';

/** Hệ số nhân driver — 1 = giữ nguyên (đối xứng DriverMultipliers engine). */
export const DriverMultipliersSchema = z.object({
  compound: z.number().positive(),
  fx: z.number().positive(),
  wage: z.number().positive(),
  electricity: z.number().positive(),
  overhead: z.number().positive(),
  volume: z.number().positive(),
});
export type DriverMultipliersInput = z.infer<typeof DriverMultipliersSchema>;

export const ScenarioDefinitionSchema = z.object({
  name: z.string(),
  multipliers: DriverMultipliersSchema,
});
export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>;

export const ScenarioOutcomeSchema = z.object({
  name: z.string(),
  multipliers: DriverMultipliersSchema,
  ebitVnd: z.number(),
  revenueVnd: z.number(),
  /** EBIT / doanh thu (giá bán cố định). */
  ebitMarginPct: z.number(),
  /** EBIT − EBIT cơ sở. */
  deltaVsBaseVnd: z.number(),
  /** (EBIT − base) / |base|. */
  deltaVsBasePct: z.number(),
});
export type ScenarioOutcome = z.infer<typeof ScenarioOutcomeSchema>;

export const ScenarioCompareResultSchema = z.object({
  base: ScenarioOutcomeSchema, // multipliers = neutral, delta = 0
  scenarios: z.array(ScenarioOutcomeSchema),
});
export type ScenarioCompareResult = z.infer<typeof ScenarioCompareResultSchema>;
