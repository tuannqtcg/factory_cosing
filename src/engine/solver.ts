// Nguồn: skill `inverse-solver` + docs/contracts/scenario.md §4 (SolveParams/
// SolveResult, ADR-005/006). M10 (docs/PHASE3_PLAN.md).
//
// Luật #1 skill inverse-solver: KHÔNG BAO GIỜ đảo công thức tay bằng đại số —
// mọi inverse solve chạy bisection trên forward function CÓ SẴN của engine.
// Ngoại lệ DUY NHẤT là T2 (`solveTargetProfit`, dạng đóng) vì công thức đóng
// CHÍNH LÀ forward CVP (Q = (FC+targetProfit)/contributionMargin), không phải
// một công thức ngược được suy diễn riêng.
//
// Generic <TInput, TOutput> thay vì khoá cứng ScenarioInput/ScenarioOutput
// (src/schemas/scenario.ts): chưa có hàm orchestration `calculateScenario()`
// nối toàn bộ pipe/fitting/cvp/price-ladder/price-lock/dual-costing/
// metal-insert thành 1 ScenarioOutput hoàn chỉnh (thuộc phạm vi M11/M12, xem
// PHASE3_PLAN.md) — solve() ở đây hoạt động với BẤT KỲ input/output nào, đúng
// tinh thần "engine pure function độc lập" của mọi module khác trong repo
// (vd pipe.ts không phụ thuộc ScenarioInput). Khi M11/M12 có `calculateScenario`,
// gọi `solve<ScenarioInput, ScenarioOutput>(...)` sẽ khớp đúng contract
// `SolveParams`/`SolveResult` (đã bổ sung field `baseInput` — xem ADR-009,
// bảng bổ sung field, dòng #4).

export interface SolveParams<TInput, TOutput> {
  /** Input gốc — solve() clone rồi set giá trị dò vào theo `freeVarPath` trước mỗi lần gọi forwardFn. */
  baseInput: TInput;
  forwardFn: (input: TInput) => TOutput;
  /** Dot-path field cần dò trong TInput (vd "resource.compoundPricingPriceUsdPerKg"). Biến hợp lệ v1: xem skill inverse-solver mục 5. */
  freeVarPath: string;
  targetSelector: (output: TOutput) => number;
  target: number;
  bounds: [number, number];
  tol: number;
  maxIterations?: number;
}

export type SolveResult<TOutput> =
  | { feasible: true; value: number; residual: number; iterations: number; forwardOutput: TOutput }
  | { feasible: false; reason: string; achievableRange: [number, number] };

/**
 * Clone JSON-sạch (mọi input engine là dữ liệu thuần theo Zod — không Date/Map/
 * hàm — nên JSON round-trip an toàn) rồi set 1 field theo dot-path.
 */
function setAtPath<T>(obj: T, path: string, value: number): T {
  const clone: any = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  const lastKey = keys[keys.length - 1];
  if (keys.length === 0 || lastKey === undefined) {
    throw new Error(`freeVarPath không hợp lệ: "${path}"`);
  }
  let cur: any = clone;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i] as string;
    if (cur == null || !(key in cur)) {
      throw new Error(`freeVarPath không hợp lệ: "${path}" — không tìm thấy "${key}" trong baseInput.`);
    }
    cur = cur[key];
  }
  if (cur == null || !(lastKey in cur)) {
    throw new Error(`freeVarPath không hợp lệ: "${path}" — không tìm thấy "${lastKey}" trong baseInput.`);
  }
  cur[lastKey] = value;
  return clone;
}

/**
 * Bisection thuần cho biến LIÊN TỤC (utilizationFactor, compoundPriceUsd, markup
 * từng tầng — skill inverse-solver mục 5). Luật #3: kiểm tra target bị kẹp giữa
 * f(lo)/f(hi) TRƯỚC KHI chia đôi; không kẹp → infeasible kèm achievableRange
 * (để UI báo "mục tiêu không khả thi, tối đa đạt X" thay vì trả số bừa). Luật
 * #4: forwardOutput luôn được forward-verify lại tại nghiệm cuối cùng.
 */
export function solve<TInput, TOutput>(params: SolveParams<TInput, TOutput>): SolveResult<TOutput> {
  const { baseInput, forwardFn, freeVarPath, targetSelector, target, bounds, tol } = params;
  const maxIterations = params.maxIterations ?? 200;
  let [lo, hi] = bounds;
  if (lo > hi) [lo, hi] = [hi, lo];

  const evalAt = (x: number): number => targetSelector(forwardFn(setAtPath(baseInput, freeVarPath, x)));

  const fLo = evalAt(lo);
  const fHi = evalAt(hi);
  const increasing = fHi >= fLo;
  const achievableLow = increasing ? fLo : fHi;
  const achievableHigh = increasing ? fHi : fLo;

  if (target < achievableLow || target > achievableHigh) {
    return {
      feasible: false,
      reason:
        `Mục tiêu ${target} nằm ngoài khoảng đạt được [${achievableLow}, ${achievableHigh}] khi dò ` +
        `"${freeVarPath}" trong [${bounds[0]}, ${bounds[1]}] — không khả thi với nguồn lực/ràng buộc hiện có.`,
      achievableRange: [achievableLow, achievableHigh],
    };
  }

  let mid = (lo + hi) / 2;
  let fMid = evalAt(mid);
  let iterations = 0;

  while (Math.abs(fMid - target) > tol && iterations < maxIterations && hi - lo > 1e-12) {
    const belowTarget = increasing ? fMid < target : fMid > target;
    if (belowTarget) lo = mid;
    else hi = mid;
    mid = (lo + hi) / 2;
    fMid = evalAt(mid);
    iterations += 1;
  }

  return {
    feasible: true,
    value: mid,
    residual: fMid - target,
    iterations,
    forwardOutput: forwardFn(setAtPath(baseInput, freeVarPath, mid)),
  };
}

/**
 * Quét rời rạc cho biến NGUYÊN (vd `shifts` 1-3) — luật #5 skill inverse-solver:
 * biến nguyên PHẢI quét rời rạc, KHÔNG bisection liên tục.
 */
export function solveDiscrete<TInput, TOutput>(
  params: Pick<SolveParams<TInput, TOutput>, 'baseInput' | 'forwardFn' | 'freeVarPath' | 'targetSelector' | 'target'> & {
    candidates: number[];
    tol?: number;
  },
): SolveResult<TOutput> {
  const { baseInput, forwardFn, freeVarPath, targetSelector, target, candidates, tol = 1e-9 } = params;
  const evaluated = candidates.map((x) => {
    const output = forwardFn(setAtPath(baseInput, freeVarPath, x));
    return { x, output, f: targetSelector(output) };
  });
  const hit = evaluated.find((e) => Math.abs(e.f - target) <= tol);

  if (!hit) {
    const values = evaluated.map((e) => e.f);
    return {
      feasible: false,
      reason: `Không có giá trị rời rạc nào trong [${candidates.join(', ')}] cho "${freeVarPath}" đạt mục tiêu ${target}.`,
      achievableRange: [Math.min(...values), Math.max(...values)],
    };
  }

  return { feasible: true, value: hit.x, residual: hit.f - target, iterations: 0, forwardOutput: hit.output };
}

/**
 * T2 — lợi nhuận mục tiêu → sản lượng + số ca (dạng ĐÓNG, KHÔNG qua solver —
 * đúng skill inverse-solver mục 2, vì đây CHÍNH LÀ forward CVP):
 * Q = (fixedCostPerYear + targetProfitVnd) / contributionMarginPerKg.
 * Tái dùng 2 số ra thẳng từ `cvp.ts` (M8) làm input — không tính lại.
 * Field trả về khớp `TargetProfitResultSchema` (docs/contracts/scenario.md §4).
 */
export interface TargetProfitInputs {
  targetProfitVnd: number;
  fixedCostPerYear: number;
  contributionMarginPerKg: number;
  /** Sản lượng (kg/năm) tại `normalShifts` hiện tại — pipe: capacity.normalCapacityKgYear; fitting: capacity.estimatedProductionKgYear. */
  normalCapacityKgYearAtNormalShifts: number;
  normalShifts: number;
}

export interface TargetProfitOutcome {
  requiredQtyKgOrMachineHours: number;
  requiredShifts: number;
  feasibleWithinNormalCapacity: boolean;
}

export function solveTargetProfit(inputs: TargetProfitInputs): TargetProfitOutcome {
  const {
    targetProfitVnd,
    fixedCostPerYear,
    contributionMarginPerKg,
    normalCapacityKgYearAtNormalShifts,
    normalShifts,
  } = inputs;

  const requiredQtyKgOrMachineHours = (fixedCostPerYear + targetProfitVnd) / contributionMarginPerKg;
  const capacityPerShiftKgYear = normalCapacityKgYearAtNormalShifts / normalShifts;
  const requiredShifts = requiredQtyKgOrMachineHours / capacityPerShiftKgYear;
  const feasibleWithinNormalCapacity = requiredShifts <= 3;

  return { requiredQtyKgOrMachineHours, requiredShifts, feasibleWithinNormalCapacity };
}
