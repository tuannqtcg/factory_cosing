// Nguồn nghiệp vụ: docs/contracts/resource.md — ADR-001, ADR-003, ADR-007.
// ĐÓNG BĂNG cùng docs/contracts/*.md — sửa cấu trúc field phải có ADR mới.
import { z } from 'zod';

const YieldRate = z.number().min(0).max(1);

// MoldAsset (ADR-007): mỗi khuôn/lô khuôn mua cùng đợt là 1 asset độc lập,
// khấu hao theo NĂM MUA riêng, thay cho moldSetCostTotal66 dạng scalar.
export const MoldAssetSchema = z.object({
  id: z.string(),
  label: z.string(),
  producesSkus: z
    .array(
      z.object({
        productName: z.string(),
        sizeLabel: z.string(),
      }),
    )
    .min(1),
  cavity: z.number().int().positive(),
  costUsd: z.number().nonnegative(),
  // = costUsd × usdVndRate TẠI THỜI ĐIỂM MUA — lưu cứng, không tính lại theo
  // tỷ giá hiện hành (giá vốn tài sản cố định, không phải giao dịch mở).
  costVnd: z.number().int().nonnegative(),
  purchaseYear: z.number().int(),
  usefulLifeYears: z.number().int().positive(),
  maintenancePerYearVnd: z.number().int().nonnegative().optional(),
  source: z.string().optional(),
});
export type MoldAsset = z.infer<typeof MoldAssetSchema>;

export const ContinuousKgResourceSchema = z.object({
  driverType: z.literal('continuous_kg'),
  maxCapacityKgPerHour: z.number().positive(),
  actualCapacityKgPerHour: z.number().positive(),
  continuousRunDaysPerBatch: z.number().int().positive(),
  maintenanceDaysPerBatch: z.number().int().nonnegative(),
  operatingDaysPerYear: z.number().int().positive(),
  hoursPerShift: z.number().positive(),
  normalShifts: z.number().int().min(1).max(3),
  yieldRate: YieldRate,
  packagingCostPerKg: z.number().int().nonnegative(),
  extruderPriceEach: z.number().int().nonnegative(),
  extruderCount: z.number().int().positive(),
  moldPullerCutterCost: z.number().int().nonnegative(),
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

export const MachineHourResourceSchema = z.object({
  driverType: z.literal('machine_hour'),
  machineTypes: z
    .array(
      z.object({
        id: z.string(),
        priceVnd: z.number().int().nonnegative(),
        count: z.number().int().positive(),
      }),
    )
    .min(1),
  moldAssets: z.array(MoldAssetSchema),
  continuousRunDaysPerBatch: z.number().int().positive(),
  maintenanceDaysPerBatch: z.number().int().nonnegative(),
  operatingDaysPerYear: z.number().int().positive(),
  hoursPerShift: z.number().positive(),
  normalShifts: z.number().int().min(1).max(3),
  normalUtilizationFactor: z.number().min(0).max(1),
  yieldRate: YieldRate,
  packagingCostPerKg: z.number().int().nonnegative(),
  avgProductivityKgPerMachineHour: z.number().positive(),
  depreciationYears: z.number().int().positive(), // khấu hao MÁY ép — tách khỏi MoldAsset.usefulLifeYears (khấu hao KHUÔN, ADR-007)
  annualMoldMaintenance: z.number().int().nonnegative(),
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
